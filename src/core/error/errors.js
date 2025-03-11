/**
 * Standard error definitions and utilities for Landing Pad AI Agents
 * 
 * Provides a set of standard error classes and utilities for error handling
 * throughout the application.
 */

const { ErrorCategory, ErrorSeverity } = require('./errorHandlingService');

/**
 * Base error class for Landing Pad AI Agents
 */
class LandingPadError extends Error {
  constructor(message, category, code, severity, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.category = category;
    this.code = code;
    this.severity = severity;
    this.details = details;
    this.timestamp = new Date();
    this.reference = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error - for invalid input parameters or data
 */
class ValidationError extends LandingPadError {
  constructor(message, code = 'VALIDATION_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.VALIDATION,
      code,
      ErrorSeverity.WARNING,
      details
    );
  }
}

/**
 * Authorization error - for unauthorized access attempts
 */
class AuthorizationError extends LandingPadError {
  constructor(message, code = 'UNAUTHORIZED', details = {}) {
    super(
      message,
      ErrorCategory.AUTHORIZATION,
      code,
      ErrorSeverity.WARNING,
      details
    );
  }
}

/**
 * Resource not found error - for requested resources that don't exist
 */
class NotFoundError extends LandingPadError {
  constructor(message, code = 'RESOURCE_NOT_FOUND', details = {}) {
    super(
      message,
      ErrorCategory.RESOURCE_NOT_FOUND,
      code,
      ErrorSeverity.WARNING,
      details
    );
  }
}

/**
 * External service error - for failures in external service requests
 */
class ExternalServiceError extends LandingPadError {
  constructor(message, code = 'EXTERNAL_SERVICE_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.EXTERNAL_SERVICE,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Database error - for database operation failures
 */
class DatabaseError extends LandingPadError {
  constructor(message, code = 'DATABASE_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.DATABASE,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Timeout error - for operations that time out
 */
class TimeoutError extends LandingPadError {
  constructor(message, code = 'TIMEOUT', details = {}) {
    super(
      message,
      ErrorCategory.TIMEOUT,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Rate limit error - for rate-limited operations
 */
class RateLimitError extends LandingPadError {
  constructor(message, code = 'RATE_LIMIT_EXCEEDED', details = {}) {
    super(
      message,
      ErrorCategory.RATE_LIMIT,
      code,
      ErrorSeverity.WARNING,
      details
    );
  }
}

/**
 * Internal error - for unexpected internal failures
 */
class InternalError extends LandingPadError {
  constructor(message, code = 'INTERNAL_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.INTERNAL,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Agent error - for agent-specific failures
 */
class AgentError extends LandingPadError {
  constructor(message, code = 'AGENT_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.AGENT,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Workflow error - for workflow-specific failures
 */
class WorkflowError extends LandingPadError {
  constructor(message, code = 'WORKFLOW_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.WORKFLOW,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Messaging error - for message bus failures
 */
class MessagingError extends LandingPadError {
  constructor(message, code = 'MESSAGING_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.MESSAGING,
      code,
      ErrorSeverity.ERROR,
      details
    );
  }
}

/**
 * Critical error - for severe failures that require immediate attention
 */
class CriticalError extends LandingPadError {
  constructor(message, code = 'CRITICAL_ERROR', details = {}) {
    super(
      message,
      ErrorCategory.INTERNAL,
      code,
      ErrorSeverity.CRITICAL,
      details
    );
  }
}

/**
 * Utility function to wrap an async function with error handling
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Options for error handling
 * @returns {Function} - Wrapped function
 */
function withErrorHandling(fn, options = {}) {
  return async function(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      // Get error handling service
      const { getInstance } = require('./errorHandlingService');
      const errorHandler = await getInstance();
      
      // Handle the error
      const context = {
        functionName: fn.name || 'anonymous',
        arguments: options.logArgs ? args : undefined,
        ...options.context
      };
      
      return errorHandler.handleError(error, context);
    }
  };
}

module.exports = {
  LandingPadError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ExternalServiceError,
  DatabaseError,
  TimeoutError,
  RateLimitError,
  InternalError,
  AgentError,
  WorkflowError,
  MessagingError,
  CriticalError,
  withErrorHandling
};