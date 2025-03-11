/**
 * Unit tests for Error Handling Service
 */

const { ErrorCategory, ErrorSeverity, getInstance } = require('../../../../src/core/error/errorHandlingService');

// Mock dependencies
jest.mock('../../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue(true),
    isConnected: true
  })
}));

jest.mock('../../../../src/core/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('ErrorHandlingService', () => {
  let errorHandler;
  let messageBus;
  let logger;
  
  beforeAll(async () => {
    // Get service instance
    errorHandler = await getInstance();
    
    // Extract mocked dependencies
    messageBus = require('../../../../src/core/messaging/messageBus').getInstance();
    logger = require('../../../../src/core/utils/logger');
  });
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('Error Handling', () => {
    it('should handle errors and return standardized response', () => {
      // Arrange
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      
      const context = { operation: 'test' };
      
      // Act
      const response = errorHandler.handleError(error, context);
      
      // Assert
      expect(response).toEqual({
        success: false,
        error: {
          message: 'Test error',
          code: 'TEST_ERROR',
          reference: expect.any(String)
        }
      });
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should extract error details from different error formats', () => {
      // Arrange - Standard error
      const standardError = new Error('Standard error');
      
      // Arrange - Error with HTTP status
      const httpError = new Error('HTTP error');
      httpError.status = 400;
      
      // Arrange - Error with category
      const categoryError = new Error('Categorized error');
      categoryError.category = ErrorCategory.VALIDATION;
      categoryError.code = 'VALIDATION_FAILED';
      categoryError.severity = ErrorSeverity.WARNING;
      
      // Act
      const standardResponse = errorHandler.handleError(standardError);
      const httpResponse = errorHandler.handleError(httpError);
      const categoryResponse = errorHandler.handleError(categoryError);
      
      // Assert
      expect(standardResponse.error.code).toBe('UNKNOWN_ERROR');
      expect(httpResponse.error.code).toBe('UNKNOWN_ERROR');
      expect(categoryResponse.error.code).toBe('VALIDATION_FAILED');
    });
    
    it('should publish error events to message bus', () => {
      // Arrange
      const error = new Error('Event test error');
      error.category = ErrorCategory.DATABASE;
      error.code = 'DB_CONNECTION_FAILED';
      
      // Act
      errorHandler.handleError(error);
      
      // Assert - Verify message bus was called
      expect(messageBus.publishEvent).toHaveBeenCalledWith(
        'error.database',
        expect.objectContaining({
          message: 'Event test error',
          code: 'DB_CONNECTION_FAILED'
        })
      );
    });
    
    it('should handle errors that occur during error handling', () => {
      // Arrange - Mock error in message bus
      messageBus.publishEvent.mockImplementationOnce(() => {
        throw new Error('Message bus error');
      });
      
      const error = new Error('Problematic error');
      
      // Act - This should not throw despite message bus failure
      const response = errorHandler.handleError(error);
      
      // Assert
      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error while handling error'),
        expect.any(Error)
      );
    });
  });
  
  describe('Retry Policies', () => {
    it('should check if an error should be retried', () => {
      // Test privately accessible methods
      const shouldRetry = errorHandler._shouldRetry.bind(errorHandler);
      
      // Default policy
      const policy = errorHandler.retryPolicies.get('default');
      
      // Test retryable error
      const timeoutError = new Error('Timeout');
      timeoutError.code = 'TIMEOUT';
      
      expect(shouldRetry(timeoutError, policy, 1)).toBe(true);
      expect(shouldRetry(timeoutError, policy, 3)).toBe(true);
      expect(shouldRetry(timeoutError, policy, 4)).toBe(false); // Exceeds maxRetries
      
      // Test non-retryable error
      const validationError = new Error('Validation');
      validationError.code = 'VALIDATION';
      
      expect(shouldRetry(validationError, policy, 1)).toBe(false);
      
      // Test by category
      const categoryError = new Error('Category');
      categoryError.category = ErrorCategory.DATABASE;
      
      expect(shouldRetry(categoryError, policy, 1)).toBe(true);
    });
    
    it('should calculate retry delay with exponential backoff', () => {
      // Test privately accessible methods
      const calculateDelay = errorHandler._calculateRetryDelay.bind(errorHandler);
      
      // Default policy
      const policy = {
        baseDelay: 1000,
        maxDelay: 10000,
        factor: 2,
        jitter: false
      };
      
      // First attempt: baseDelay
      expect(calculateDelay(policy, 1)).toBe(1000);
      
      // Second attempt: baseDelay * factor
      expect(calculateDelay(policy, 2)).toBe(2000);
      
      // Third attempt: baseDelay * factor^2
      expect(calculateDelay(policy, 3)).toBe(4000);
      
      // Fourth attempt: baseDelay * factor^3
      expect(calculateDelay(policy, 4)).toBe(8000);
      
      // Fifth attempt: maxDelay (capped)
      expect(calculateDelay(policy, 5)).toBe(10000);
    });
    
    it('should apply jitter to retry delays when enabled', () => {
      // Test privately accessible methods
      const calculateDelay = errorHandler._calculateRetryDelay.bind(errorHandler);
      
      // Policy with jitter
      const policy = {
        baseDelay: 1000,
        maxDelay: 10000,
        factor: 2,
        jitter: true
      };
      
      // Multiple calculations should give different results due to jitter
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(calculateDelay(policy, 1));
      }
      
      // Expect at least some variation due to jitter
      expect(results.size).toBeGreaterThan(1);
      
      // All results should be within jitter range
      const jitterFactor = 0.25; // 25% jitter
      for (const delay of results) {
        expect(delay).toBeGreaterThanOrEqual(1000 - (1000 * jitterFactor));
        expect(delay).toBeLessThanOrEqual(1000 + (1000 * jitterFactor));
      }
    });
  });
  
  describe('executeWithRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      // Arrange
      const operation = jest.fn().mockResolvedValue('success');
      
      // Act
      const result = await errorHandler.executeWithRetry(operation);
      
      // Assert
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should retry operation after failure with default policy', async () => {
      // Arrange
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Retry me'))
        .mockRejectedValueOnce(new Error('Retry me again'))
        .mockResolvedValue('success after retries');
      
      // Add category to make it retryable
      operation.mockRejectedValue = (error) => {
        error.category = ErrorCategory.TIMEOUT;
        return operation;
      };
      
      // Override delay calculation to speed up test
      jest.spyOn(errorHandler, '_calculateRetryDelay').mockReturnValue(1);
      
      // Act
      const result = await errorHandler.executeWithRetry(operation);
      
      // Assert
      expect(result).toBe('success after retries');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retry attempt'),
        expect.any(Object)
      );
    });
    
    it('should throw error after exhausting all retry attempts', async () => {
      // Arrange
      const testError = new Error('Persistent failure');
      testError.category = ErrorCategory.EXTERNAL_SERVICE;
      
      const operation = jest.fn().mockRejectedValue(testError);
      
      // Override delay calculation to speed up test
      jest.spyOn(errorHandler, '_calculateRetryDelay').mockReturnValue(1);
      
      // Act & Assert
      await expect(errorHandler.executeWithRetry(operation, 'quick')).rejects.toThrow('Persistent failure');
      
      // Default retries in 'quick' policy is 2, plus initial attempt = 3 total calls
      expect(operation).toHaveBeenCalledTimes(3);
    });
    
    it('should not retry errors with non-retryable categories', async () => {
      // Arrange
      const validationError = new Error('Validation error');
      validationError.category = ErrorCategory.VALIDATION;
      
      const operation = jest.fn().mockRejectedValue(validationError);
      
      // Act & Assert
      await expect(errorHandler.executeWithRetry(operation)).rejects.toThrow('Validation error');
      
      // Should not retry for validation errors
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should use specified retry policy', async () => {
      // Arrange
      const timeoutError = new Error('Timeout error');
      timeoutError.category = ErrorCategory.TIMEOUT;
      
      const operation = jest.fn()
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue('success with ai-service policy');
      
      // Override delay calculation to speed up test
      jest.spyOn(errorHandler, '_calculateRetryDelay').mockReturnValue(1);
      
      // Act
      const result = await errorHandler.executeWithRetry(operation, 'ai-service');
      
      // Assert
      expect(result).toBe('success with ai-service policy');
      
      // ai-service policy has 5 max retries, but we succeed on the 5th attempt (4 failures)
      expect(operation).toHaveBeenCalledTimes(5);
    });
  });
  
  describe('Circuit Breaker', () => {
    it('should record failures and open circuit after threshold', () => {
      // Arrange
      const serviceName = 'test-service-circuit';
      
      // Mock the private methods
      const recordFailure = errorHandler._recordFailure.bind(errorHandler);
      const checkCircuitBreaker = errorHandler._checkCircuitBreaker.bind(errorHandler);
      
      // Initialize circuit breaker
      checkCircuitBreaker(serviceName);
      
      // Circuit should start closed
      const initialBreaker = errorHandler.circuitBreakers.get(serviceName);
      expect(initialBreaker.state).toBe('closed');
      
      // Act - Record failures up to threshold
      for (let i = 0; i < initialBreaker.threshold; i++) {
        recordFailure(serviceName, new Error(`Failure ${i}`));
      }
      
      // Assert - Circuit should now be open
      const breaker = errorHandler.circuitBreakers.get(serviceName);
      expect(breaker.state).toBe('open');
      expect(breaker.nextAttempt).toBeGreaterThan(Date.now());
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit opened'),
        expect.any(Object)
      );
    });
    
    it('should throw error when circuit is open', () => {
      // Arrange
      const serviceName = 'open-circuit-service';
      
      // Setup open circuit
      errorHandler.circuitBreakers.set(serviceName, {
        state: 'open',
        failures: 5,
        lastFailure: Date.now(),
        nextAttempt: Date.now() + 30000, // 30 seconds in the future
        threshold: 5,
        resetTimeout: 30000
      });
      
      // Act & Assert
      expect(() => {
        errorHandler._checkCircuitBreaker(serviceName);
      }).toThrow('Service open-circuit-service is unavailable');
    });
    
    it('should set circuit to half-open after reset timeout', () => {
      // Arrange
      const serviceName = 'timeout-circuit-service';
      
      // Setup open circuit with expired nextAttempt
      errorHandler.circuitBreakers.set(serviceName, {
        state: 'open',
        failures: 5,
        lastFailure: Date.now() - 60000, // 60 seconds ago
        nextAttempt: Date.now() - 1000, // 1 second ago (expired)
        threshold: 5,
        resetTimeout: 30000
      });
      
      // Act
      errorHandler._checkCircuitBreaker(serviceName);
      
      // Assert
      const breaker = errorHandler.circuitBreakers.get(serviceName);
      expect(breaker.state).toBe('half-open');
    });
    
    it('should close circuit after successful operation in half-open state', () => {
      // Arrange
      const serviceName = 'half-open-circuit-service';
      
      // Setup half-open circuit
      errorHandler.circuitBreakers.set(serviceName, {
        state: 'half-open',
        failures: 5,
        lastFailure: Date.now() - 60000,
        nextAttempt: null,
        threshold: 5,
        resetTimeout: 30000
      });
      
      // Act
      errorHandler._recordSuccess(serviceName);
      
      // Assert
      const breaker = errorHandler.circuitBreakers.get(serviceName);
      expect(breaker.state).toBe('closed');
      expect(breaker.failures).toBe(0);
    });
  });
  
  describe('Custom Error Creation', () => {
    it('should create errors with specified properties', () => {
      // Act
      const error = errorHandler.createError(
        'Custom error message',
        ErrorCategory.WORKFLOW,
        'WORKFLOW_FAILED',
        ErrorSeverity.ERROR,
        { workflowId: '123', stepId: '456' }
      );
      
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Custom error message');
      expect(error.category).toBe(ErrorCategory.WORKFLOW);
      expect(error.code).toBe('WORKFLOW_FAILED');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.details).toEqual({ workflowId: '123', stepId: '456' });
    });
  });
});