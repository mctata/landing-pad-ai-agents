/**
 * Error Handling Service for Landing Pad AI Agents
 * 
 * Provides centralized error handling, logging, and recovery strategies
 * for the agent system. Features include:
 * - Error categorization and prioritization
 * - Standardized error responses
 * - Retry policies
 * - Circuit breaker pattern implementation
 * - Error reporting and monitoring integration
 */

const { getInstance: getMessageBus } = require('../messaging/messageBus');
const logger = require('../utils/logger');

// Error categories
const ErrorCategory = {
  VALIDATION: 'validation',
  AUTHORIZATION: 'authorization',
  RESOURCE_NOT_FOUND: 'resource_not_found',
  EXTERNAL_SERVICE: 'external_service',
  DATABASE: 'database',
  TIMEOUT: 'timeout',
  RATE_LIMIT: 'rate_limit',
  INTERNAL: 'internal',
  AGENT: 'agent',
  WORKFLOW: 'workflow',
  MESSAGING: 'messaging'
};

// Error severities
const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

class ErrorHandlingService {
  constructor() {
    this.messageBus = null;
    this.circuitBreakers = new Map();
    this.retryPolicies = new Map();
    
    // Default retry policies
    this._initializeDefaultRetryPolicies();
  }

  async init() {
    try {
      // Connect to message bus for error events
      this.messageBus = await getMessageBus();
      
      // Subscribe to error events
      await this.messageBus.subscribeToEvent('error.*', this._handleErrorEvent.bind(this));
      
      logger.info('Error handling service initialized');
      return this;
    } catch (error) {
      logger.error('Failed to initialize error handling service', error);
      throw error;
    }
  }

  /**
   * Handle and process an error
   * @param {Error} error - The error object
   * @param {Object} context - Additional context about the error
   * @returns {Object} - Standardized error response
   */
  handleError(error, context = {}) {
    try {
      // Extract error details
      const errorDetails = this._extractErrorDetails(error, context);
      
      // Log the error
      this._logError(errorDetails);
      
      // Publish error event if message bus is available
      this._publishErrorEvent(errorDetails);
      
      // Create standardized error response
      const errorResponse = this._createErrorResponse(errorDetails);
      
      // Apply recovery strategy if applicable
      this._applyRecoveryStrategy(errorDetails);
      
      return errorResponse;
    } catch (handlingError) {
      logger.error('Error while handling error', handlingError);
      
      // Fallback error response
      return {
        success: false,
        error: {
          message: error.message || 'An unexpected error occurred',
          code: 'INTERNAL_ERROR',
          reference: Date.now().toString(36)
        }
      };
    }
  }

  /**
   * Create a categorized error
   * @param {string} message - Error message
   * @param {string} category - Error category
   * @param {string} code - Error code
   * @param {string} severity - Error severity
   * @param {Object} details - Additional error details
   * @returns {Error} - Categorized error object
   */
  createError(message, category = ErrorCategory.INTERNAL, code = 'UNKNOWN_ERROR', severity = ErrorSeverity.ERROR, details = {}) {
    const error = new Error(message);
    
    error.category = category;
    error.code = code;
    error.severity = severity;
    error.details = details;
    error.timestamp = new Date();
    error.reference = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    return error;
  }

  /**
   * Execute with retry policy
   * @param {Function} operation - Async function to execute
   * @param {string} policyName - Name of retry policy to use
   * @param {Object} context - Operation context
   * @returns {Promise<any>} - Result of operation
   */
  async executeWithRetry(operation, policyName = 'default', context = {}) {
    const policy = this.retryPolicies.get(policyName) || this.retryPolicies.get('default');
    
    if (!policy) {
      throw new Error(`Retry policy '${policyName}' not found`);
    }
    
    let lastError = null;
    let attempt = 0;
    
    while (attempt < policy.maxRetries + 1) {
      try {
        // Check circuit breaker if service is specified
        if (context.service) {
          this._checkCircuitBreaker(context.service);
        }
        
        // Execute operation
        const result = await operation();
        
        // Record successful attempt if service is specified
        if (context.service) {
          this._recordSuccess(context.service);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        attempt++;
        
        // Record failure if service is specified
        if (context.service) {
          this._recordFailure(context.service, error);
        }
        
        // Check if we should retry based on error
        if (!this._shouldRetry(error, policy, attempt)) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this._calculateRetryDelay(policy, attempt);
        
        // Log retry attempt
        logger.info(`Retry attempt ${attempt}/${policy.maxRetries} for operation after ${delay}ms delay`, {
          service: context.service,
          error: error.message,
          attempt,
          delay
        });
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
  }

  /**
   * Set custom retry policy
   * @param {string} name - Policy name
   * @param {Object} policy - Retry policy configuration
   */
  setRetryPolicy(name, policy) {
    this.retryPolicies.set(name, {
      maxRetries: policy.maxRetries || 3,
      baseDelay: policy.baseDelay || 1000,
      maxDelay: policy.maxDelay || 30000,
      factor: policy.factor || 2,
      jitter: policy.jitter !== undefined ? policy.jitter : true,
      retryableErrors: policy.retryableErrors || ['TIMEOUT', 'RATE_LIMIT', 'EXTERNAL_SERVICE'],
      nonRetryableErrors: policy.nonRetryableErrors || ['VALIDATION', 'AUTHORIZATION']
    });
  }

  /**
   * Reset circuit breaker for a service
   * @param {string} service - Service name
   */
  resetCircuitBreaker(service) {
    if (this.circuitBreakers.has(service)) {
      const breaker = this.circuitBreakers.get(service);
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.lastFailure = null;
      breaker.nextAttempt = null;
      
      logger.info(`Circuit breaker reset for service: ${service}`);
    }
  }

  /**
   * Extract details from error object
   * @private
   */
  _extractErrorDetails(error, context) {
    // Create base error details
    const details = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      category: error.category || ErrorCategory.INTERNAL,
      code: error.code || 'UNKNOWN_ERROR',
      severity: error.severity || ErrorSeverity.ERROR,
      timestamp: error.timestamp || new Date(),
      reference: error.reference || Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      context: {
        ...context,
        ...error.details
      }
    };
    
    // Extract HTTP details if available
    if (error.status || error.statusCode) {
      details.http = {
        status: error.status || error.statusCode
      };
    }
    
    // Extract service details if available
    if (error.service || context.service) {
      details.service = error.service || context.service;
    }
    
    return details;
  }

  /**
   * Log error with appropriate level
   * @private
   */
  _logError(errorDetails) {
    const logData = {
      reference: errorDetails.reference,
      category: errorDetails.category,
      code: errorDetails.code,
      context: errorDetails.context
    };
    
    switch (errorDetails.severity) {
      case ErrorSeverity.INFO:
        logger.info(errorDetails.message, logData);
        break;
      case ErrorSeverity.WARNING:
        logger.warn(errorDetails.message, logData);
        break;
      case ErrorSeverity.CRITICAL:
        logger.error(`CRITICAL: ${errorDetails.message}`, {
          ...logData,
          stack: errorDetails.stack
        });
        break;
      case ErrorSeverity.ERROR:
      default:
        logger.error(errorDetails.message, {
          ...logData,
          stack: errorDetails.stack
        });
        break;
    }
  }

  /**
   * Publish error event to message bus
   * @private
   */
  _publishErrorEvent(errorDetails) {
    if (!this.messageBus || !this.messageBus.isConnected) {
      return;
    }
    
    try {
      const eventType = `error.${errorDetails.category}`;
      
      this.messageBus.publishEvent(eventType, {
        reference: errorDetails.reference,
        message: errorDetails.message,
        code: errorDetails.code,
        severity: errorDetails.severity,
        timestamp: errorDetails.timestamp,
        service: errorDetails.service,
        context: errorDetails.context
      });
    } catch (error) {
      logger.error('Failed to publish error event', error);
    }
  }

  /**
   * Create standardized error response
   * @private
   */
  _createErrorResponse(errorDetails) {
    const response = {
      success: false,
      error: {
        message: errorDetails.message,
        code: errorDetails.code,
        reference: errorDetails.reference
      }
    };
    
    // Add additional details for non-production environments
    if (process.env.NODE_ENV !== 'production') {
      response.error.details = errorDetails.context;
      response.error.stack = errorDetails.stack;
    }
    
    return response;
  }

  /**
   * Apply recovery strategy based on error
   * @private
   */
  _applyRecoveryStrategy(errorDetails) {
    // Implement recovery strategies based on error category
    switch (errorDetails.category) {
      case ErrorCategory.EXTERNAL_SERVICE:
        // Could trigger status check or alternative provider selection
        break;
      case ErrorCategory.DATABASE:
        // Could trigger connection refresh
        break;
      case ErrorCategory.WORKFLOW:
        // Could trigger workflow recovery process
        break;
      default:
        // No specific recovery strategy
        break;
    }
  }

  /**
   * Handle error event from message bus
   * @private
   */
  async _handleErrorEvent(data, metadata) {
    logger.debug('Received error event', { 
      category: metadata.type.split('.')[1],
      reference: data.reference 
    });
    
    // Process error events, e.g., aggregate for reporting
    // or trigger specific actions based on error patterns
  }

  /**
   * Initialize default retry policies
   * @private
   */
  _initializeDefaultRetryPolicies() {
    // Default policy
    this.retryPolicies.set('default', {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      factor: 2,
      jitter: true,
      retryableErrors: [
        'TIMEOUT', 
        'RATE_LIMIT', 
        'EXTERNAL_SERVICE', 
        'DATABASE'
      ],
      nonRetryableErrors: [
        'VALIDATION', 
        'AUTHORIZATION', 
        'RESOURCE_NOT_FOUND'
      ]
    });
    
    // AI service policy (more retries, longer delays)
    this.retryPolicies.set('ai-service', {
      maxRetries: 5,
      baseDelay: 2000,
      maxDelay: 60000,
      factor: 2,
      jitter: true,
      retryableErrors: [
        'TIMEOUT', 
        'RATE_LIMIT', 
        'EXTERNAL_SERVICE'
      ],
      nonRetryableErrors: [
        'VALIDATION', 
        'AUTHORIZATION'
      ]
    });
    
    // Quick retry policy
    this.retryPolicies.set('quick', {
      maxRetries: 2,
      baseDelay: 500,
      maxDelay: 5000,
      factor: 2,
      jitter: true,
      retryableErrors: [
        'TIMEOUT', 
        'EXTERNAL_SERVICE'
      ],
      nonRetryableErrors: [
        'VALIDATION',
        'AUTHORIZATION',
        'RESOURCE_NOT_FOUND',
        'RATE_LIMIT'
      ]
    });
  }

  /**
   * Check if error should be retried
   * @private
   */
  _shouldRetry(error, policy, attempt) {
    // Don't retry if we've hit max retries
    if (attempt > policy.maxRetries) {
      return false;
    }
    
    // Check error code against policy
    const errorCode = error.code || 'UNKNOWN_ERROR';
    
    // Don't retry if error is in non-retryable list
    if (policy.nonRetryableErrors.includes(errorCode)) {
      return false;
    }
    
    // Retry if error is in retryable list
    if (policy.retryableErrors.includes(errorCode)) {
      return true;
    }
    
    // Check error category against policy
    const errorCategory = error.category || ErrorCategory.INTERNAL;
    
    // Don't retry if category is in non-retryable list
    if (policy.nonRetryableErrors.includes(errorCategory)) {
      return false;
    }
    
    // Retry if category is in retryable list
    if (policy.retryableErrors.includes(errorCategory)) {
      return true;
    }
    
    // Default to not retrying
    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   * @private
   */
  _calculateRetryDelay(policy, attempt) {
    // Calculate base delay with exponential backoff
    let delay = Math.min(
      policy.maxDelay,
      policy.baseDelay * Math.pow(policy.factor, attempt - 1)
    );
    
    // Add jitter to avoid thundering herd problem
    if (policy.jitter) {
      const jitterFactor = 0.25; // 25% jitter
      const jitterAmount = delay * jitterFactor;
      delay = delay - jitterAmount + (Math.random() * jitterAmount * 2);
    }
    
    return Math.floor(delay);
  }

  /**
   * Check circuit breaker before operation
   * @private
   */
  _checkCircuitBreaker(service) {
    // Initialize circuit breaker if it doesn't exist
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, {
        state: 'closed',
        failures: 0,
        lastFailure: null,
        nextAttempt: null,
        threshold: 5,
        resetTimeout: 30000 // 30 seconds
      });
    }
    
    const breaker = this.circuitBreakers.get(service);
    
    // If circuit is open, check if we should try again
    if (breaker.state === 'open') {
      const now = Date.now();
      
      if (!breaker.nextAttempt || now >= breaker.nextAttempt) {
        // Allow a single trial request to go through
        breaker.state = 'half-open';
        logger.info(`Circuit half-open for service: ${service}`);
        return;
      }
      
      // Circuit is open and reset timeout hasn't elapsed
      throw this.createError(
        `Service ${service} is unavailable (circuit open)`,
        ErrorCategory.EXTERNAL_SERVICE,
        'SERVICE_UNAVAILABLE',
        ErrorSeverity.ERROR
      );
    }
  }

  /**
   * Record successful operation for circuit breaker
   * @private
   */
  _recordSuccess(service) {
    if (!this.circuitBreakers.has(service)) {
      return;
    }
    
    const breaker = this.circuitBreakers.get(service);
    
    // If circuit was half-open, close it
    if (breaker.state === 'half-open') {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.lastFailure = null;
      breaker.nextAttempt = null;
      
      logger.info(`Circuit closed for service: ${service}`);
    }
  }

  /**
   * Record operation failure for circuit breaker
   * @private
   */
  _recordFailure(service, error) {
    if (!this.circuitBreakers.has(service)) {
      this.circuitBreakers.set(service, {
        state: 'closed',
        failures: 0,
        lastFailure: null,
        nextAttempt: null,
        threshold: 5,
        resetTimeout: 30000 // 30 seconds
      });
    }
    
    const breaker = this.circuitBreakers.get(service);
    const now = Date.now();
    
    // Update circuit breaker state
    breaker.failures++;
    breaker.lastFailure = now;
    
    // If circuit was half-open, open it again
    if (breaker.state === 'half-open') {
      breaker.state = 'open';
      breaker.nextAttempt = now + breaker.resetTimeout;
      
      logger.warn(`Circuit opened for service: ${service} after failed test`);
      return;
    }
    
    // If failures exceed threshold, open the circuit
    if (breaker.state === 'closed' && breaker.failures >= breaker.threshold) {
      breaker.state = 'open';
      breaker.nextAttempt = now + breaker.resetTimeout;
      
      logger.warn(`Circuit opened for service: ${service} after ${breaker.failures} failures`);
    }
  }
}

// Error category and severity exports
module.exports.ErrorCategory = ErrorCategory;
module.exports.ErrorSeverity = ErrorSeverity;

// Singleton instance
let errorHandlingServiceInstance = null;

module.exports.getInstance = async () => {
  if (!errorHandlingServiceInstance) {
    errorHandlingServiceInstance = new ErrorHandlingService();
    await errorHandlingServiceInstance.init();
  }
  return errorHandlingServiceInstance;
};