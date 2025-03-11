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
   */
  _handleError(error, context) {
    this.logger.error(`Error in ${context}: ${error.message}`, error);
    
    // Report error to monitoring service if needed
    if (this.services.monitoring) {
      this.services.monitoring.reportError(error, {
        module: this.constructor.name,
        context
      }).catch(err => {
        this.logger.error(`Failed to report error: ${err.message}`, err);
      });
    }
    
    // Set module status to error
    this.status = 'error';
    
    throw error;
  }
}

module.exports = BaseModule;
