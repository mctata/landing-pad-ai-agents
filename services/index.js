/**
 * Services index for Landing Pad Digital AI Content Agents
 * 
 * This file exports all services for easy import in other modules.
 */

const LoggerService = require('./LoggerService');
const ConfigService = require('./ConfigService');
const MessagingService = require('./MessagingService');
const StorageService = require('./StorageService');
const AIProviderService = require('./AIProviderService');

/**
 * Initialize all services
 */
async function initializeServices() {
  try {
    // Services should be initialized in this specific order
    await ConfigService; // This is already initialized when required
    await LoggerService.logger.info('Initializing services');
    await StorageService.initialize();
    await MessagingService.initialize();
    
    // AIProviderService depends on having API keys, which might not be available in dev
    try {
      // This will initialize itself when imported
      await AIProviderService;
    } catch (error) {
      LoggerService.logger.warn(`AIProviderService not initialized: ${error.message}`);
    }
    
    LoggerService.logger.info('All services initialized');
    return true;
  } catch (error) {
    LoggerService.logger.error(`Failed to initialize services: ${error.message}`, error);
    throw error;
  }
}

/**
 * Shutdown all services
 */
async function shutdownServices() {
  try {
    LoggerService.logger.info('Shutting down services');
    await MessagingService.shutdown();
    await StorageService.shutdown();
    LoggerService.logger.info('All services shut down');
    return true;
  } catch (error) {
    LoggerService.logger.error(`Failed to shut down services: ${error.message}`, error);
    throw error;
  }
}

// Export all services and utilities
module.exports = {
  logger: LoggerService.logger,
  createLogger: LoggerService.createLogger,
  config: ConfigService,
  messaging: MessagingService,
  storage: StorageService,
  ai: AIProviderService,
  initialize: initializeServices,
  shutdown: shutdownServices
};
