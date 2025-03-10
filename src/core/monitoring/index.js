// src/core/monitoring/index.js
const { getInstance: getHealthMonitoringService } = require('./healthMonitoringService');
const { getInstance: getHealthCheckApi } = require('./healthCheckApi');
const logger = require('../utils/logger');

/**
 * Initialize all monitoring services
 */
async function initializeMonitoring() {
  try {
    // Initialize health monitoring service
    logger.info('Initializing health monitoring service...');
    const healthMonitoringService = await getHealthMonitoringService();
    
    // Initialize health check API
    logger.info('Initializing health check API...');
    const healthCheckApi = await getHealthCheckApi();
    await healthCheckApi.start();
    
    logger.info('All monitoring services initialized successfully');
    
    return {
      healthMonitoringService,
      healthCheckApi,
      
      // Shutdown function to gracefully stop all services
      shutdown: async () => {
        logger.info('Shutting down monitoring services...');
        
        try {
          // Stop health check API
          await healthCheckApi.stop();
          
          // Stop health monitoring service
          await healthMonitoringService.close();
          
          logger.info('All monitoring services shut down successfully');
        } catch (error) {
          logger.error('Error shutting down monitoring services', error);
        }
      }
    };
  } catch (error) {
    logger.error('Failed to initialize monitoring services', error);
    throw error;
  }
}

module.exports = {
  initializeMonitoring
};
