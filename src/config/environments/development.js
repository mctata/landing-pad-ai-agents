// src/config/environments/development.js

/**
 * Development environment configuration
 */
module.exports = {
  // Monitoring settings
  monitoring: {
    // Health check API port
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3001', 10),
    
    // Dashboard port
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3002', 10),
    
    // Health check interval (ms)
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    
    // Heartbeat interval (ms)
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    
    // Heartbeat timeout (ms) - time after which an agent is considered unresponsive
    heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '90000', 10),
    
    // Maximum recovery attempts
    maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3', 10),
    
    // Enable auto-recovery
    autoRecovery: process.env.AUTO_RECOVERY !== 'false',
    
    // Metrics retention period (days)
    metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '7', 10)
  }
};
