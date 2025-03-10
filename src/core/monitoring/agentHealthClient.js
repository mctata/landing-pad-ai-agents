// src/core/monitoring/agentHealthClient.js
const { getInstance: getMessageBus } = require('../messaging/messageBus');
const logger = require('../utils/logger');
const config = require('../../config');

class AgentHealthClient {
  constructor(agentId, options = {}) {
    this.agentId = agentId;
    this.messageBus = null;
    this.heartbeatInterval = options.heartbeatInterval || config.monitoring?.heartbeatInterval || 30000; // Default: 30 seconds
    this.metrics = options.metrics || {};
    this.status = 'starting';
    this.intervalId = null;
    this.metadata = options.metadata || {};
    this.isRegistered = false;
  }

  async init() {
    try {
      // Connect to message bus
      this.messageBus = await getMessageBus();
      
      // Register the agent with the health monitoring service
      await this.register();
      
      // Start sending heartbeats
      this.startHeartbeat();
      
      // Update status to online
      await this.updateStatus('online', 'Agent initialized');
      
      logger.info(`Health client initialized for agent ${this.agentId}`);
      return this;
    } catch (error) {
      logger.error(`Failed to initialize health client for agent ${this.agentId}`, error);
      throw error;
    }
  }

  async register() {
    try {
      // Register with health monitoring service via message
      await this.messageBus.publishEvent('agent.register', {
        agentId: this.agentId,
        status: this.status,
        metadata: this.metadata,
        timestamp: new Date().toISOString()
      });
      
      // Also try to register via API if available
      try {
        const response = await fetch(`http://localhost:${config.monitoring?.healthCheckPort || 3001}/health/agents/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agentId: this.agentId,
            metadata: this.metadata
          })
        });
        
        if (!response.ok) {
          logger.warn(`API registration failed for agent ${this.agentId}: ${response.status} ${response.statusText}`);
        }
      } catch (apiError) {
        // API might not be available, continue with message-based registration
        logger.debug(`API registration not available for agent ${this.agentId}: ${apiError.message}`);
      }
      
      this.isRegistered = true;
      logger.info(`Agent ${this.agentId} registered with health monitoring service`);
    } catch (error) {
      logger.error(`Failed to register agent ${this.agentId} with health monitoring service`, error);
      throw error;
    }
  }

  startHeartbeat() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.intervalId = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.heartbeatInterval);
    
    logger.debug(`Started heartbeat for agent ${this.agentId} with interval ${this.heartbeatInterval}ms`);
  }

  async sendHeartbeat() {
    try {
      // Collect current metrics
      const currentMetrics = this.collectMetrics();
      
      // Send heartbeat event
      await this.messageBus.publishEvent('agent.heartbeat', {
        agentId: this.agentId,
        status: this.status,
        metrics: currentMetrics,
        timestamp: new Date().toISOString()
      });
      
      logger.debug(`Sent heartbeat for agent ${this.agentId}`);
    } catch (error) {
      logger.error(`Failed to send heartbeat for agent ${this.agentId}`, error);
    }
  }

  collectMetrics() {
    // Collect basic system metrics
    const metrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString()
    };
    
    // Add custom metrics if available
    if (typeof this.metrics === 'function') {
      try {
        const customMetrics = this.metrics();
        Object.assign(metrics, customMetrics);
      } catch (error) {
        logger.error(`Failed to collect custom metrics for agent ${this.agentId}`, error);
      }
    } else if (typeof this.metrics === 'object') {
      Object.assign(metrics, this.metrics);
    }
    
    return metrics;
  }

  async updateStatus(status, reason = '') {
    if (this.status === status) {
      return; // No change in status
    }
    
    try {
      // Send status change event
      await this.messageBus.publishEvent('agent.status-changed', {
        agentId: this.agentId,
        status,
        previousStatus: this.status,
        reason,
        timestamp: new Date().toISOString()
      });
      
      // Update local status
      this.status = status;
      
      logger.info(`Agent ${this.agentId} status changed to ${status}${reason ? ': ' + reason : ''}`);
    } catch (error) {
      logger.error(`Failed to update status for agent ${this.agentId}`, error);
    }
  }

  updateMetrics(metrics) {
    if (typeof metrics === 'function') {
      this.metrics = metrics;
    } else if (typeof metrics === 'object') {
      this.metrics = { ...this.metrics, ...metrics };
    }
  }

  async stop() {
    try {
      // Stop sending heartbeats
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      // Update status to offline
      await this.updateStatus('offline', 'Agent shutting down');
      
      logger.info(`Health client stopped for agent ${this.agentId}`);
    } catch (error) {
      logger.error(`Error stopping health client for agent ${this.agentId}`, error);
    }
  }
}

module.exports = AgentHealthClient;
