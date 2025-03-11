/**
 * Error handling module index
 * 
 * Exports all error handling components for easy importing
 */

const errorHandlingService = require('./errorHandlingService');
const errors = require('./errors');

module.exports = {
  // Error handling service
  getInstance: errorHandlingService.getInstance,
  ErrorCategory: errorHandlingService.ErrorCategory,
  ErrorSeverity: errorHandlingService.ErrorSeverity,
  
  // Error classes
  LandingPadError: errors.LandingPadError,
  ValidationError: errors.ValidationError,
  AuthorizationError: errors.AuthorizationError,
  NotFoundError: errors.NotFoundError,
  ExternalServiceError: errors.ExternalServiceError,
  DatabaseError: errors.DatabaseError,
  TimeoutError: errors.TimeoutError,
  RateLimitError: errors.RateLimitError,
  InternalError: errors.InternalError,
  AgentError: errors.AgentError,
  WorkflowError: errors.WorkflowError,
  MessagingError: errors.MessagingError,
  CriticalError: errors.CriticalError,
  
  // Utility functions
  withErrorHandling: errors.withErrorHandling
};