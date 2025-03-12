/**
 * System Controller
 * Handles system-level API endpoints
 */

// Import dependencies
const os = require('os');
const { version } = require('../../../package.json');
const { getInstance: getHealthMonitoringService } = require('../../core/monitoring/healthMonitoringService');
const { getRecoveryService } = require('../../core/error');
const logger = require('../../common/services/logger');

/**
 * Health check endpoint
 */
exports.healthCheck = (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version
  });
};

/**
 * Get detailed system status
 */
exports.getSystemStatus = async (req, res, next) => {
  try {
    // Get agent statuses from container
    const agentContainer = req.app.locals.agentContainer;
    
    // If agent container not available, return basic status
    if (!agentContainer) {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version,
        uptime: process.uptime(),
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
          },
          cpu: os.cpus().length
        }
      });
    }
    
    // Get agent statuses
    const agentStatuses = {};
    for (const [name, agent] of Object.entries(agentContainer.agents)) {
      agentStatuses[name] = {
        isRunning: agent.isRunning,
        moduleCount: agent.modules ? agent.modules.size : 0
      };
    }
    
    // Get database status
    let dbStatus = 'unknown';
    try {
      const ping = await agentContainer.storage.db.command({ ping: 1 });
      dbStatus = ping.ok === 1 ? 'connected' : 'error';
    } catch (error) {
      dbStatus = 'disconnected';
    }
    
    // Get messaging status
    let messagingStatus = 'unknown';
    try {
      messagingStatus = agentContainer.messaging.isConnected() ? 'connected' : 'disconnected';
    } catch (error) {
      messagingStatus = 'error';
    }
    
    // Get healthMonitoring agent status if available
    let detailedAgentStatus = {};
    try {
      const healthService = await getHealthMonitoringService();
      detailedAgentStatus = await healthService.getAllAgentsStatus();
    } catch (error) {
      logger.warn('Failed to get detailed agent status from health monitoring service', error);
    }
    
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
      uptime: process.uptime(),
      agents: agentStatuses,
      agentHealth: detailedAgentStatus,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        cpu: os.cpus().length
      },
      services: {
        database: dbStatus,
        messaging: messagingStatus
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agent health status
 */
exports.getAgentHealth = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Agent ID is required'
      });
    }
    
    const healthService = await getHealthMonitoringService();
    const agentStatus = await healthService.getAgentStatus(agentId);
    
    if (!agentStatus) {
      return res.status(404).json({
        status: 'error',
        message: `Agent ${agentId} not found`
      });
    }
    
    return res.json({
      status: 'ok',
      agent: agentStatus
    });
  } catch (error) {
    logger.error(`Failed to get agent health for ${req.params.agentId}`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve agent health',
      error: error.message
    });
  }
};

/**
 * Get dead letter queue entries
 */
exports.getDeadLetterQueue = async (req, res) => {
  try {
    const { agentId } = req.query;
    
    const recoveryService = await getRecoveryService();
    const entries = recoveryService.getDeadLetterQueueEntries(agentId);
    
    return res.json({
      status: 'ok',
      count: entries.length,
      entries
    });
  } catch (error) {
    logger.error('Failed to get dead letter queue entries', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve dead letter queue entries',
      error: error.message
    });
  }
};

/**
 * Retry a dead letter queue entry
 */
exports.retryDeadLetterQueueEntry = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({
        status: 'error',
        message: 'Entry key is required'
      });
    }
    
    const recoveryService = await getRecoveryService();
    const result = await recoveryService.retryDeadLetterQueueEntry(key);
    
    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: `Entry with key ${key} not found or retry failed`
      });
    }
    
    return res.json({
      status: 'ok',
      message: `Successfully retried entry ${key}`
    });
  } catch (error) {
    logger.error(`Failed to retry dead letter queue entry ${req.params.key}`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retry dead letter queue entry',
      error: error.message
    });
  }
};

/**
 * Delete a dead letter queue entry
 */
exports.deleteDeadLetterQueueEntry = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({
        status: 'error',
        message: 'Entry key is required'
      });
    }
    
    const recoveryService = await getRecoveryService();
    const result = recoveryService.deleteDeadLetterQueueEntry(key);
    
    if (!result) {
      return res.status(404).json({
        status: 'error',
        message: `Entry with key ${key} not found or delete failed`
      });
    }
    
    return res.json({
      status: 'ok',
      message: `Successfully deleted entry ${key}`
    });
  } catch (error) {
    logger.error(`Failed to delete dead letter queue entry ${req.params.key}`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete dead letter queue entry',
      error: error.message
    });
  }
};

/**
 * Get recovery history for an agent
 */
exports.getAgentRecoveryHistory = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Agent ID is required'
      });
    }
    
    const recoveryService = await getRecoveryService();
    const history = recoveryService.getRecoveryHistory(agentId);
    
    return res.json({
      status: 'ok',
      agentId,
      history
    });
  } catch (error) {
    logger.error(`Failed to get recovery history for agent ${req.params.agentId}`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve recovery history',
      error: error.message
    });
  }
};

/**
 * Restart an agent
 */
exports.restartAgent = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Agent ID is required'
      });
    }
    
    const { getInstance: getMessageBus } = require('../../core/messaging/messageBus');
    const messageBus = await getMessageBus();
    
    // Send restart command to agent
    const result = await messageBus.publishCommand(`${agentId}.restart`, {
      timestamp: new Date().toISOString(),
      requestedBy: req.user?.id || 'system'
    });
    
    return res.json({
      status: 'ok',
      message: `Restart command sent to agent ${agentId}`,
      commandId: result.id
    });
  } catch (error) {
    logger.error(`Failed to restart agent ${req.params.agentId}`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to restart agent',
      error: error.message
    });
  }
};

/**
 * Register an agent with the health monitoring service
 */
exports.registerAgent = async (req, res) => {
  try {
    const { agentId, metadata } = req.body;
    
    if (!agentId) {
      return res.status(400).json({
        status: 'error',
        message: 'Agent ID is required'
      });
    }
    
    const healthService = await getHealthMonitoringService();
    const result = await healthService.registerAgent(agentId, metadata);
    
    if (!result) {
      return res.status(500).json({
        status: 'error',
        message: `Failed to register agent ${agentId}`
      });
    }
    
    return res.json({
      status: 'ok',
      message: `Agent ${agentId} registered successfully`
    });
  } catch (error) {
    logger.error(`Failed to register agent ${req.body.agentId}`, error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to register agent',
      error: error.message
    });
  }
};