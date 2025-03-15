/**
 * Health Monitoring Service
 * Monitors agent health and system status
 */

const { Sequelize, Op } = require('sequelize');
const config = require('../../config');
const logger = require('../utils/logger');
const { getInstance: getMessageBus } = require('../messaging/messageBus');
const DatabaseMonitor = require('./databaseMonitor');

class HealthMonitoringService {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.isConnected = !!sequelize;
    this.agentHealth = null;
    this.messageBus = null;
    this.agents = new Map();
    this.checkInterval = config.monitoring?.checkInterval || 30000; // Default: 30 seconds
    this.heartbeatTimeout = config.monitoring?.heartbeatTimeout || 90000; // Default: 90 seconds
    this.intervalId = null;
    this.databaseMonitor = null;
  }

  async connect() {
    if (!this.sequelize) {
      logger.error('HealthMonitoringService requires a Sequelize instance');
      throw new Error('Missing Sequelize instance');
    }

    try {
      // Create agent_health table if it doesn't exist
      await this.sequelize.query(`
        CREATE TABLE IF NOT EXISTS agent_health (
          id SERIAL PRIMARY KEY,
          agent_id VARCHAR(255) NOT NULL UNIQUE,
          status VARCHAR(50) NOT NULL DEFAULT 'unknown',
          status_reason TEXT,
          last_heartbeat TIMESTAMP,
          last_status_change TIMESTAMP,
          last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
          registered TIMESTAMP NOT NULL DEFAULT NOW(),
          metrics JSONB,
          last_recovery_attempt TIMESTAMP,
          recovery_attempts INT DEFAULT 0,
          metadata JSONB
        );
        
        CREATE INDEX IF NOT EXISTS idx_agent_health_agent_id ON agent_health(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_health_status ON agent_health(status);
        CREATE INDEX IF NOT EXISTS idx_agent_health_last_heartbeat ON agent_health(last_heartbeat);
      `);
      
      this.agentHealth = 'agent_health'; // Table name for raw queries
      this.isConnected = true;
      
      // Set up database monitoring
      this.databaseMonitor = new DatabaseMonitor(this.sequelize);
      this.databaseMonitor.start();
      
      logger.info('HealthMonitoringService connected to PostgreSQL');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect HealthMonitoringService to PostgreSQL', error);
      throw error;
    }
  }

  async init() {
    // Connect to database if not already connected
    if (!this.isConnected) {
      await this.connect();
    }
    
    // Connect to message bus
    this.messageBus = await getMessageBus();
    
    // Subscribe to agent heartbeats
    await this.messageBus.subscribeToEvent('agent.heartbeat', this.handleHeartbeat.bind(this));
    
    // Subscribe to agent status changes
    await this.messageBus.subscribeToEvent('agent.status-changed', this.handleStatusChange.bind(this));
    
    // Start monitoring agents
    this.startMonitoring();
    
    logger.info('Health Monitoring Service initialized');
    return this;
  }

  async handleHeartbeat(data, metadata) {
    const { agentId, status, metrics } = data;
    
    try {
      // Update agent status in the database
      await this.sequelize.query(`
        UPDATE agent_health 
        SET 
          last_heartbeat = NOW(),
          status = :status,
          metrics = :metrics,
          last_updated = NOW()
        WHERE agent_id = :agentId;
        
        INSERT INTO agent_health (agent_id, status, metrics, last_heartbeat, last_updated, registered)
        SELECT :agentId, :status, :metrics, NOW(), NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM agent_health WHERE agent_id = :agentId);
      `, {
        replacements: {
          agentId,
          status: status || 'online',
          metrics: JSON.stringify(metrics || {})
        }
      });
      
      // Update in-memory map
      this.agents.set(agentId, {
        agentId,
        status: status || 'online',
        lastHeartbeat: new Date(),
        metrics: metrics || {}
      });
      
      logger.debug(`Received heartbeat from agent ${agentId}`);
    } catch (error) {
      logger.error(`Failed to update heartbeat for agent ${agentId}`, error);
    }
  }

  async handleStatusChange(data, metadata) {
    const { agentId, status, reason } = data;
    
    try {
      // Update agent status in the database
      await this.sequelize.query(`
        UPDATE agent_health 
        SET 
          status = :status,
          status_reason = :reason,
          last_status_change = NOW(),
          last_updated = NOW()
        WHERE agent_id = :agentId;
        
        INSERT INTO agent_health (agent_id, status, status_reason, last_status_change, last_updated, registered)
        SELECT :agentId, :status, :reason, NOW(), NOW(), NOW()
        WHERE NOT EXISTS (SELECT 1 FROM agent_health WHERE agent_id = :agentId);
      `, {
        replacements: {
          agentId,
          status,
          reason: reason || null
        }
      });
      
      // Update in-memory map
      const agent = this.agents.get(agentId) || { agentId };
      agent.status = status;
      agent.statusReason = reason;
      agent.lastStatusChange = new Date();
      this.agents.set(agentId, agent);
      
      logger.info(`Agent ${agentId} status changed to ${status}${reason ? ': ' + reason : ''}`);
      
      // If the agent has failed, attempt recovery
      if (status === 'failed' || status === 'unresponsive') {
        this.attemptAgentRecovery(agentId, reason);
      }
    } catch (error) {
      logger.error(`Failed to update status for agent ${agentId}`, error);
    }
  }

  async attemptAgentRecovery(agentId, reason) {
    logger.info(`Attempting to recover agent ${agentId}`);
    
    try {
      // Publish recovery command
      await this.messageBus.publishCommand(`${agentId}.recover`, {
        agentId,
        reason,
        timestamp: new Date().toISOString()
      });
      
      // Update recovery attempt in the database
      await this.sequelize.query(`
        UPDATE agent_health 
        SET 
          last_recovery_attempt = NOW(),
          recovery_attempts = recovery_attempts + 1
        WHERE agent_id = :agentId
      `, {
        replacements: { agentId }
      });
      
      logger.info(`Recovery command sent to agent ${agentId}`);
    } catch (error) {
      logger.error(`Failed to initiate recovery for agent ${agentId}`, error);
    }
  }

  startMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.intervalId = setInterval(async () => {
      await this.checkAgentsHealth();
      await this.checkSystemHealth();
    }, this.checkInterval);
    
    logger.info(`Health monitoring started with check interval of ${this.checkInterval}ms`);
  }

  async checkAgentsHealth() {
    try {
      // Calculate timeout threshold
      const timeoutThreshold = new Date(Date.now() - this.heartbeatTimeout);
      
      // Find agents that haven't reported a heartbeat recently
      const [unresponsiveAgents] = await this.sequelize.query(`
        SELECT agent_id, status, last_heartbeat
        FROM agent_health
        WHERE 
          status NOT IN ('failed', 'unresponsive') 
          AND last_heartbeat < :timeoutThreshold
      `, {
        replacements: { 
          timeoutThreshold 
        }
      });
      
      // Mark unresponsive agents
      for (const agent of unresponsiveAgents) {
        await this.messageBus.publishEvent('agent.status-changed', {
          agentId: agent.agent_id,
          status: 'unresponsive',
          reason: `No heartbeat received since ${agent.last_heartbeat}`
        });
      }
    } catch (error) {
      logger.error('Failed to check agents health', error);
    }
  }
  
  async checkSystemHealth() {
    try {
      // Check database health
      if (this.databaseMonitor) {
        const dbHealth = await this.databaseMonitor.runHealthCheck();
        
        // Publish database health status
        await this.messageBus.publishEvent('system.health', {
          component: 'database',
          status: dbHealth.status,
          metrics: {
            queryLatency: dbHealth.queryLatency,
            connections: dbHealth.poolStats,
            dbSize: dbHealth.dbSize
          },
          timestamp: new Date().toISOString()
        });
        
        // Log any issues
        if (dbHealth.status !== 'healthy') {
          logger.warn('Database health issues detected:', dbHealth.errors);
        }
      }
      
      // Check message bus health
      if (this.messageBus) {
        const messageBusHealth = await this.messageBus.getStatus();
        
        await this.messageBus.publishEvent('system.health', {
          component: 'messageBus',
          status: messageBusHealth.connected ? 'healthy' : 'unhealthy',
          metrics: messageBusHealth,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Failed to check system health', error);
    }
  }

  async registerAgent(agentId, metadata = {}) {
    try {
      // Create agent record in the database
      await this.sequelize.query(`
        INSERT INTO agent_health (
          agent_id, status, registered, last_updated, metadata
        ) VALUES (
          :agentId, 'starting', NOW(), NOW(), :metadata
        )
        ON CONFLICT (agent_id) 
        DO UPDATE SET
          status = 'starting',
          last_updated = NOW(),
          metadata = :metadata
      `, {
        replacements: {
          agentId,
          metadata: JSON.stringify(metadata || {})
        }
      });
      
      // Add to in-memory map
      this.agents.set(agentId, {
        agentId,
        status: 'starting',
        registered: new Date(),
        metadata
      });
      
      logger.info(`Agent ${agentId} registered with health monitoring service`);
      return true;
    } catch (error) {
      logger.error(`Failed to register agent ${agentId}`, error);
      return false;
    }
  }

  async getAgentStatus(agentId) {
    try {
      const [results] = await this.sequelize.query(`
        SELECT * FROM agent_health WHERE agent_id = :agentId
      `, {
        replacements: { agentId }
      });
      
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error(`Failed to get status for agent ${agentId}`, error);
      return null;
    }
  }

  async getAllAgentsStatus() {
    try {
      const [agents] = await this.sequelize.query(`
        SELECT * FROM agent_health
        ORDER BY last_updated DESC
      `);
      
      return agents;
    } catch (error) {
      logger.error('Failed to get all agents status', error);
      return [];
    }
  }
  
  async getDatabaseHealth() {
    if (this.databaseMonitor) {
      return await this.databaseMonitor.runHealthCheck();
    }
    return { status: 'unknown' };
  }

  async stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Health monitoring stopped');
    }
    
    if (this.databaseMonitor) {
      this.databaseMonitor.stop();
    }
  }

  async close() {
    await this.stopMonitoring();
    
    if (this.databaseMonitor) {
      this.databaseMonitor.stop();
    }
    
    // Note: We don't close the Sequelize connection since it might be shared
    this.isConnected = false;
    logger.info('HealthMonitoringService stopped');
  }
}

// Singleton instance
let healthMonitoringServiceInstance = null;

module.exports = {
  getInstance: async (sequelize) => {
    if (!healthMonitoringServiceInstance) {
      healthMonitoringServiceInstance = new HealthMonitoringService(sequelize);
      await healthMonitoringServiceInstance.init();
    }
    return healthMonitoringServiceInstance;
  }
};