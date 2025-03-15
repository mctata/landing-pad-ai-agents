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
    let dbDetails = null;
    try {
      // Try to get detailed health from our health monitoring service
      const healthService = await getHealthMonitoringService();
      const dbHealth = await healthService.getDatabaseHealth();
      
      dbStatus = dbHealth.status;
      dbDetails = {
        queryLatency: dbHealth.queryLatency,
        poolStats: dbHealth.poolStats,
        dbSize: dbHealth.dbSize
      };
    } catch (error) {
      dbStatus = 'disconnected';
      logger.warn('Failed to get database health details', error);
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
        database: {
          status: dbStatus,
          details: dbDetails
        },
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

/**
 * Get database health metrics
 */
exports.getDatabaseHealth = async (req, res) => {
  try {
    const healthService = await getHealthMonitoringService();
    const dbHealth = await healthService.getDatabaseHealth();
    
    return res.json({
      status: 'ok',
      database: dbHealth
    });
  } catch (error) {
    logger.error('Failed to get database health metrics', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve database health metrics',
      error: error.message
    });
  }
};

/**
 * Get Prometheus metrics
 */
exports.getPrometheusMetrics = async (req, res) => {
  try {
    const healthService = await getHealthMonitoringService();
    const metrics = await healthService.databaseMonitor.getMetrics();
    
    // Set content type for Prometheus
    res.setHeader('Content-Type', 'text/plain');
    return res.send(metrics);
  } catch (error) {
    logger.error('Failed to get Prometheus metrics', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve Prometheus metrics',
      error: error.message
    });
  }
};

/**
 * Change a user's password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const User = require('../../models/userModel');
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Current password and new password are required',
          code: 'missing_password'
        }
      });
    }
    
    // Get user from database
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: {
          message: 'User not found',
          code: 'user_not_found'
        }
      });
    }
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          message: 'Current password is incorrect',
          code: 'incorrect_password'
        }
      });
    }
    
    // Set new password
    user.password = newPassword;
    user.requiresPasswordChange = false;
    await user.save();
    
    return res.json({
      status: 'ok',
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Failed to change password', error);
    
    return res.status(500).json({
      error: {
        message: 'Failed to change password',
        code: 'password_change_failed'
      }
    });
  }
};

/**
 * Request a password reset
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const User = require('../../models/userModel');
    
    if (!email) {
      return res.status(400).json({
        error: {
          message: 'Email is required',
          code: 'missing_email'
        }
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Don't reveal whether a user exists or not for security reasons
    // Always return success even if no user is found
    if (user) {
      // Generate reset token
      const resetToken = await user.generatePasswordResetToken();
      
      // In a real application, send an email with the reset link
      // For now, just log it
      logger.info(`Password reset token for ${email}: ${resetToken}`);
    }
    
    return res.json({
      status: 'ok',
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    logger.error('Failed to request password reset', error);
    
    return res.status(500).json({
      error: {
        message: 'Failed to request password reset',
        code: 'password_reset_request_failed'
      }
    });
  }
};

/**
 * Reset a password using a reset token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const User = require('../../models/userModel');
    
    if (!token || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Token and new password are required',
          code: 'missing_parameters'
        }
      });
    }
    
    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        error: {
          message: 'Password reset token is invalid or has expired',
          code: 'invalid_token'
        }
      });
    }
    
    // Set new password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.requiresPasswordChange = false;
    await user.save();
    
    return res.json({
      status: 'ok',
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    logger.error('Failed to reset password', error);
    
    return res.status(500).json({
      error: {
        message: 'Failed to reset password',
        code: 'password_reset_failed'
      }
    });
  }
};