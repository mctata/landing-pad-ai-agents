/**
 * Base Module class for all agent modules in the Landing Pad Digital system
 * 
 * This class provides the core functionality for all modules, including:
 * - Configuration validation
 * - Error handling
 * - Lifecycle management
 * - Utility functions
 */

const logger = require('../services/LoggerService');

class BaseModule {
  /**
   * Create a new module
   * @param {Object} config - Module configuration
   * @param {Object} services - Service dependencies
   */
  constructor(config, services) {
    this.config = config;
    this.settings = config.settings || {};
    this.services = services;
    this.status = 'initializing';
    this.logger = logger.createLogger(`module:${this.constructor.name.toLowerCase()}`);
  }

  /**
   * Initialize the module
   */
  async initialize() {
    try {
      this.logger.info(`Initializing module: ${this.constructor.name}`);
      
      // Validate configuration
      this._validateConfig();
      
      // Perform module-specific initialization
      await this._initialize();
      
      this.status = 'initialized';
      this.logger.info(`Module initialized: ${this.constructor.name}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to initialize module: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Start the module
   */
  async start() {
    try {
      this.logger.info(`Starting module: ${this.constructor.name}`);
      
      // Perform module-specific start
      await this._start();
      
      this.status = 'running';
      this.logger.info(`Module started: ${this.constructor.name}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to start module: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Stop the module
   */
  async stop() {
    try {
      this.logger.info(`Stopping module: ${this.constructor.name}`);
      
      // Perform module-specific stop
      await this._stop();
      
      this.status = 'stopped';
      this.logger.info(`Module stopped: ${this.constructor.name}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to stop module: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get module status
   * @returns {Object} - Module status
   */
  getStatus() {
    return {
      name: this.constructor.name,
      status: this.status
    };
  }

  /**
   * Module-specific initialization logic
   * @protected
   */
  async _initialize() {
    // To be implemented by each module subclass
    throw new Error('_initialize must be implemented by subclass');
  }

  /**
   * Module-specific start logic
   * @protected
   */
  async _start() {
    // Default implementation (can be overridden)
    return true;
  }

  /**
   * Module-specific stop logic
   * @protected
   */
  async _stop() {
    // Default implementation (can be overridden)
    return true;
  }

  /**
   * Validate module configuration
   * @protected
   */
  _validateConfig() {
    // Default implementation (can be overridden)
    if (!this.config) {
      throw new Error('Module configuration is required');
    }
    
    if (!this.config.enabled) {
      throw new Error('Module is not enabled');
    }
    
    return true;
  }

  /**
   * Log module activity
   * @protected
   * @param {string} activity - Activity description
   * @param {Object} data - Activity data
   */
  _logActivity(activity, data = {}) {
    this.logger.info(activity, { module: this.constructor.name, ...data });
    
    // Store activity in database if needed
    if (this.services.storage) {
      this.services.storage.storeActivity({
        module: this.constructor.name,
        timestamp: new Date(),
        activity,
        data
      }).catch(error => {
        this.logger.error(`Failed to store activity: ${error.message}`, error);
      });
    }
  }

  /**
   * Handle error
   * @protected
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {boolean} rethrow - Whether to rethrow the error after handling
   */
  async _handleError(error, context, rethrow = true) {
    this.logger.error(`Error in ${context}: ${error.message}`, error);
    
    // Extract error details
    const errorCategory = error.category || 'internal';
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Create error event payload
    const errorEvent = {
      module: this.constructor.name,
      context,
      error: error.message,
      stack: error.stack,
      category: errorCategory,
      code: errorCode,
      timestamp: new Date().toISOString()
    };
    
    // Report error to monitoring service if available
    if (this.services.monitoring) {
      try {
        await this.services.monitoring.reportError(error, {
          module: this.constructor.name,
          context
        });
      } catch (reportError) {
        this.logger.error(`Failed to report error: ${reportError.message}`, reportError);
      }
    }
    
    // Publish error event if messaging is available
    if (this.services.messaging) {
      try {
        await this.services.messaging.publishEvent('module.error', errorEvent);
      } catch (publishError) {
        this.logger.error(`Failed to publish error event: ${publishError.message}`, publishError);
      }
    }
    
    // Set module status to error
    this.status = 'error';
    
    // Rethrow if requested
    if (rethrow) {
      throw error;
    }
  }
  
  /**
   * Execute an operation with circuit breaker pattern
   * @protected
   * @param {Function} operation - Function to execute
   * @param {string} serviceName - Name of the service being called
   * @param {Object} options - Circuit breaker options
   * @returns {Promise<any>} - Result of the operation
   */
  async _executeWithCircuitBreaker(operation, serviceName, options = {}) {
    // Use error handling service if available
    if (this.services.errorHandling) {
      try {
        return await this.services.errorHandling.executeWithRetry(operation, 
          options.policyName || 'default',
          { 
            service: serviceName,
            ...options.context
          }
        );
      } catch (error) {
        // Add service name to error for better tracking
        error.service = serviceName;
        throw error;
      }
    } else {
      // Fallback to direct execution if no error handling service
      try {
        return await operation();
      } catch (error) {
        error.service = serviceName;
        throw error;
      }
    }
  }
  
  /**
   * Get module metrics
   * @returns {Object} - Module metrics
   */
  async getMetrics() {
    // Default implementation
    return {
      status: this.status,
      lastActivity: this._lastActivity || null
    };
  }
  
  /**
   * Check if a service is available (circuit is closed)
   * @protected
   * @param {string} serviceName - Name of the service to check
   * @returns {boolean} - True if service is available
   */
  async _isServiceAvailable(serviceName) {
    if (this.services.errorHandling) {
      try {
        // This will throw if circuit is open
        this.services.errorHandling._checkCircuitBreaker(serviceName);
        return true;
      } catch (error) {
        return false;
      }
    }
    
    // Default to available if no error handling service
    return true;
  }
  
  /**
   * Reset circuit breaker for a service
   * @protected
   * @param {string} serviceName - Name of the service
   */
  async _resetServiceCircuitBreaker(serviceName) {
    if (this.services.errorHandling) {
      await this.services.errorHandling.resetCircuitBreaker(serviceName);
      this.logger.info(`Reset circuit breaker for service: ${serviceName}`);
    }
  }
}

module.exports = BaseModule;
