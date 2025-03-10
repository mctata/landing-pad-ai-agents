// src/core/monitoring/healthMonitoringService.js
const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../utils/logger');
const { getInstance: getMessageBus } = require('../messaging/messageBus');

class HealthMonitoringService {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.messageBus = null;
    this.isConnected = false;
    this.agents = new Map();
    this.checkInterval = config.monitoring?.checkInterval || 30000; // Default: 30 seconds
    this.heartbeatTimeout = config.monitoring?.heartbeatTimeout || 90000; // Default: 90 seconds
    this.intervalId = null;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.database.url, config.database.options);
      await this.client.connect();
      
      this.db = this.client.db(config.database.name);
      this.collection = this.db.collection('agent_health');
      
      // Create indexes for efficient lookups
      await this.collection.createIndex({ agentId: 1 }, { unique: true });
      await this.collection.createIndex({ lastHeartbeat: 1 });
      await this.collection.createIndex({ status: 1 });
      
      this.isConnected = true;
      logger.info('HealthMonitoringService connected to MongoDB');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect HealthMonitoringService to MongoDB', error);
      throw error;
    }
  }

  async init() {
    // Connect to MongoDB if not already connected
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
      await this.collection.updateOne(
        { agentId },
        {
          $set: {
            lastHeartbeat: new Date(),
            status: status || 'online',
            metrics: metrics || {},
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
      
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
      await this.collection.updateOne(
        { agentId },
        {
          $set: {
            status,
            statusReason: reason,
            lastStatusChange: new Date(),
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
      
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
      await this.collection.updateOne(
        { agentId },
        {
          $set: {
            lastRecoveryAttempt: new Date()
          },
          $inc: {
            recoveryAttempts: 1
          }
        }
      );
      
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
    }, this.checkInterval);
    
    logger.info(`Health monitoring started with check interval of ${this.checkInterval}ms`);
  }

  async checkAgentsHealth() {
    try {
      // Get all agents from the database
      const agents = await this.collection.find({}).toArray();
      
      const now = new Date();
      const timeoutThreshold = new Date(now.getTime() - this.heartbeatTimeout);
      
      for (const agent of agents) {
        // Skip agents that are already marked as failed or unresponsive
        if (agent.status === 'failed' || agent.status === 'unresponsive') {
          continue;
        }
        
        // Check if the agent has missed too many heartbeats
        if (agent.lastHeartbeat && agent.lastHeartbeat < timeoutThreshold) {
          // Mark agent as unresponsive
          await this.messageBus.publishEvent('agent.status-changed', {
            agentId: agent.agentId,
            status: 'unresponsive',
            reason: `No heartbeat received since ${agent.lastHeartbeat.toISOString()}`
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check agents health', error);
    }
  }

  async registerAgent(agentId, metadata = {}) {
    try {
      const now = new Date();
      
      // Create agent record in the database
      await this.collection.updateOne(
        { agentId },
        {
          $set: {
            agentId,
            status: 'starting',
            registered: now,
            lastUpdated: now,
            metadata
          }
        },
        { upsert: true }
      );
      
      // Add to in-memory map
      this.agents.set(agentId, {
        agentId,
        status: 'starting',
        registered: now,
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
      const agent = await this.collection.findOne({ agentId });
      return agent;
    } catch (error) {
      logger.error(`Failed to get status for agent ${agentId}`, error);
      return null;
    }
  }

  async getAllAgentsStatus() {
    try {
      const agents = await this.collection.find({}).toArray();
      return agents;
    } catch (error) {
      logger.error('Failed to get all agents status', error);
      return [];
    }
  }

  async stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Health monitoring stopped');
    }
  }

  async close() {
    await this.stopMonitoring();
    
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('HealthMonitoringService disconnected from MongoDB');
    }
  }
}

// Singleton instance
let healthMonitoringServiceInstance = null;

module.exports = {
  getInstance: async () => {
    if (!healthMonitoringServiceInstance) {
      healthMonitoringServiceInstance = new HealthMonitoringService();
      await healthMonitoringServiceInstance.init();
    }
    return healthMonitoringServiceInstance;
  }
};
