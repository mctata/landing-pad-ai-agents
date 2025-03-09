/**
 * Base Module Class
 * Provides common functionality for all agent modules
 */

class BaseModule {
  constructor(config, storage, logger) {
    this.config = config;
    this.storage = storage;
    this.logger = logger;
    this.isRunning = false;
    this.name = 'base_module';
  }

  async initialize() {
    this.logger.debug(`Initializing module: ${this.name}`);
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn(`Module already running: ${this.name}`);
      return;
    }
    
    this.logger.debug(`Starting module: ${this.name}`);
    this.isRunning = true;
  }

  async stop() {
    if (!this.isRunning) {
      this.logger.warn(`Module not running: ${this.name}`);
      return;
    }
    
    this.logger.debug(`Stopping module: ${this.name}`);
    this.isRunning = false;
  }

  /**
   * Validate configuration and set defaults
   * @param {Object} config - Module configuration
   * @param {Object} schema - Validation schema with default values
   * @returns {Object} Validated configuration with defaults applied
   */
  validateConfig(config, schema) {
    // Start with defaults
    const result = { ...schema.defaults };
    
    // Apply provided values
    for (const [key, value] of Object.entries(config)) {
      if (schema.properties[key]) {
        const propertyType = schema.properties[key].type;
        
        // Type validation
        if (propertyType === 'string' && typeof value === 'string') {
          result[key] = value;
        } else if (propertyType === 'number' && typeof value === 'number') {
          result[key] = value;
        } else if (propertyType === 'boolean' && typeof value === 'boolean') {
          result[key] = value;
        } else if (propertyType === 'array' && Array.isArray(value)) {
          result[key] = value;
        } else if (propertyType === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = value;
        } else {
          this.logger.warn(`Invalid type for config property ${key}, expected ${propertyType}`);
        }
      }
    }
    
    // Check required properties
    for (const required of schema.required || []) {
      if (result[required] === undefined) {
        throw new Error(`Missing required configuration property: ${required}`);
      }
    }
    
    return result;
  }

  /**
   * Safe wrapper for async operations with error handling
   * @param {Function} operation - Async function to execute
   * @param {string} errorMessage - Message to log on error
   * @param {any} defaultValue - Default value to return on error
   * @returns {Promise<any>} Result of operation or default value on error
   */
  async safeExecute(operation, errorMessage, defaultValue = null) {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`${errorMessage}: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * Create a debounced version of a function
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} Debounced function
   */
  debounce(func, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Create a throttled version of a function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Limit in milliseconds
   * @returns {Function} Throttled function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Calculate time difference in a human-readable format
   * @param {Date} date1 - First date
   * @param {Date} date2 - Second date (defaults to now)
   * @returns {string} Human-readable time difference
   */
  getTimeDifference(date1, date2 = new Date()) {
    const diff = Math.abs(date2 - date1);
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''}`;
  }
}

module.exports = BaseModule;