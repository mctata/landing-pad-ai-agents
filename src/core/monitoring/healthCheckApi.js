// src/core/monitoring/healthCheckApi.js
const express = require('express');
const { getInstance: getHealthMonitoringService } = require('./healthMonitoringService');
const logger = require('../utils/logger');
const config = require('../../config');

class HealthCheckApi {
  constructor() {
    this.app = express();
    this.healthMonitoringService = null;
    this.server = null;
    this.port = config.monitoring?.healthCheckPort || 3001;
  }

  async init() {
    // Get the health monitoring service
    this.healthMonitoringService = await getHealthMonitoringService();
    
    // Configure Express middleware
    this.setupMiddleware();
    
    // Configure routes
    this.setupRoutes();
    
    return this;
  }

  setupMiddleware() {
    // JSON parsing middleware
    this.app.use(express.json());
    
    // Simple request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.url}`);
      next();
    });
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      logger.error('API Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
  }

  setupRoutes() {
    // Get health status for all agents
    this.app.get('/health/agents', async (req, res) => {
      try {
        const agents = await this.healthMonitoringService.getAllAgentsStatus();
        res.json(agents);
      } catch (error) {
        logger.error('Failed to get agents health status', error);
        res.status(500).json({ error: 'Failed to get agents health status' });
      }
    });
    
    // Get health status for a specific agent
    this.app.get('/health/agents/:agentId', async (req, res) => {
      try {
        const { agentId } = req.params;
        const agent = await this.healthMonitoringService.getAgentStatus(agentId);
        
        if (!agent) {
          return res.status(404).json({ error: `Agent ${agentId} not found` });
        }
        
        res.json(agent);
      } catch (error) {
        logger.error(`Failed to get agent health status for ${req.params.agentId}`, error);
        res.status(500).json({ error: 'Failed to get agent health status' });
      }
    });
    
    // Manually trigger a recovery attempt for an agent
    this.app.post('/health/agents/:agentId/recover', async (req, res) => {
      try {
        const { agentId } = req.params;
        const agent = await this.healthMonitoringService.getAgentStatus(agentId);
        
        if (!agent) {
          return res.status(404).json({ error: `Agent ${agentId} not found` });
        }
        
        await this.healthMonitoringService.attemptAgentRecovery(agentId, 'Manual recovery request');
        
        res.json({ success: true, message: `Recovery attempt initiated for agent ${agentId}` });
      } catch (error) {
        logger.error(`Failed to trigger recovery for agent ${req.params.agentId}`, error);
        res.status(500).json({ error: 'Failed to trigger recovery' });
      }
    });
    
    // Overall system health check
    this.app.get('/health', async (req, res) => {
      try {
        const agents = await this.healthMonitoringService.getAllAgentsStatus();
        
        // Check if any critical agents are down
        const criticalAgentsDown = agents.filter(
          agent => (agent.status === 'failed' || agent.status === 'unresponsive') &&
                   agent.metadata?.critical === true
        );
        
        // Calculate overall health status
        const totalAgents = agents.length;
        const onlineAgents = agents.filter(agent => agent.status === 'online').length;
        const healthPercentage = totalAgents > 0 ? (onlineAgents / totalAgents) * 100 : 0;
        
        const systemHealth = {
          status: criticalAgentsDown.length > 0 ? 'degraded' : 'healthy',
          healthPercentage,
          agentCount: {
            total: totalAgents,
            online: onlineAgents,
            offline: totalAgents - onlineAgents
          },
          criticalAgentsDown: criticalAgentsDown.map(agent => agent.agentId)
        };
        
        res.json(systemHealth);
      } catch (error) {
        logger.error('Failed to get system health', error);
        res.status(500).json({ error: 'Failed to get system health' });
      }
    });
    
    // Register an agent with the health monitoring service
    this.app.post('/health/agents/register', async (req, res) => {
      try {
        const { agentId, metadata } = req.body;
        
        if (!agentId) {
          return res.status(400).json({ error: 'Agent ID is required' });
        }
        
        const result = await this.healthMonitoringService.registerAgent(agentId, metadata);
        
        if (result) {
          res.json({ success: true, message: `Agent ${agentId} registered successfully` });
        } else {
          res.status(500).json({ error: 'Failed to register agent' });
        }
      } catch (error) {
        logger.error('Failed to register agent', error);
        res.status(500).json({ error: 'Failed to register agent' });
      }
    });
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`Health Check API server listening on port ${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        logger.error('Failed to start Health Check API server', error);
        reject(error);
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('Health Check API server stopped');
          resolve();
        });
      });
    }
  }
}

// Singleton instance
let healthCheckApiInstance = null;

module.exports = {
  getInstance: async () => {
    if (!healthCheckApiInstance) {
      healthCheckApiInstance = new HealthCheckApi();
      await healthCheckApiInstance.init();
    }
    return healthCheckApiInstance;
  }
};
