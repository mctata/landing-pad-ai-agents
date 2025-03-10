/**
 * System Controller
 * Handles system-level API endpoints
 */

// Import dependencies
const os = require('os');
const { version } = require('../../../package.json');

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
    
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version,
      uptime: process.uptime(),
      agents: agentStatuses,
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