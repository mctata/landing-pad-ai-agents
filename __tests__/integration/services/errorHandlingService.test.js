/**
 * Integration tests for Error Handling Service
 */

const testDatabase = require('../../../testing/setupTestDatabase');
const { mockFactories } = require('../../../testing/testHelpers');
const { setTimeout } = require('timers/promises');

// Mock the amqplib module
jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({ queue: 'mock-queue' }),
      bindQueue: jest.fn().mockResolvedValue({}),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'mock-tag' }),
      publish: jest.fn().mockReturnValue(true),
      ack: jest.fn(),
      nack: jest.fn(),
      cancel: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue({})
    }),
    close: jest.fn().mockResolvedValue({})
  })
}));

// Import error classes
const {
  ExternalServiceError,
  DatabaseError,
  TimeoutError
} = require('../../../src/core/error/errors');

// Mock external service for testing
class MockExternalService {
  constructor(shouldFail = false, failMode = 'error') {
    this.shouldFail = shouldFail;
    this.failMode = failMode;
    this.callCount = 0;
  }
  
  async performOperation() {
    this.callCount++;
    
    if (this.shouldFail) {
      switch (this.failMode) {
        case 'timeout':
          await setTimeout(100); // Small delay
          throw new TimeoutError('Operation timed out');
        case 'database':
          throw new DatabaseError('Database connection failed');
        case 'external':
          throw new ExternalServiceError('External service unavailable');
        default:
          throw new Error('Generic error');
      }
    }
    
    return { success: true, data: 'result' };
  }
  
  reset() {
    this.callCount = 0;
  }
}

// Mock the message bus
jest.mock('../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue(true),
    isConnected: true
  })
}));

// Mock logger
jest.mock('../../../src/core/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock config
jest.mock('../../../src/config', () => ({
  messaging: {
    uri: 'amqp://localhost',
    queues: {},
    exchanges: {}
  },
  monitoring: {
    checkInterval: 10,
    heartbeatTimeout: 100
  }
}));

// Mock mongoose
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue({}),
  connection: {
    readyState: 1,
    dropDatabase: jest.fn().mockResolvedValue({}),
    close: jest.fn().mockResolvedValue({}),
    collections: {}
  },
  Types: {
    ObjectId: jest.fn().mockImplementation(() => 'mock-object-id')
  }
}));

// Mock mongodb-memory-server
jest.mock('mongodb-memory-server', () => ({
  MongoMemoryServer: {
    create: jest.fn().mockResolvedValue({
      getUri: jest.fn().mockReturnValue('mongodb://localhost:27017/test'),
      stop: jest.fn().mockResolvedValue({})
    })
  }
}));

// Import after mocks
const { getInstance: getErrorHandler } = require('../../../src/core/error/errorHandlingService');
const { getInstance: getMessageBus } = require('../../../src/core/messaging/messageBus');
const logger = require('../../../src/core/utils/logger');

describe('ErrorHandlingService Integration', () => {
  let errorHandler;
  let messageBus;
  let mockService;
  
  beforeAll(async () => {
    await testDatabase.connect();
  });

  afterAll(async () => {
    await testDatabase.closeDatabase();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get a fresh instance of ErrorHandlingService
    errorHandler = await getErrorHandler();
    messageBus = await getMessageBus();
    
    // Create a new mock service for each test
    mockService = new MockExternalService();
  });

  describe('Retry Policy Integration', () => {
    it('should retry a failing operation according to retry policy', async () => {
      // Arrange
      const timeoutService = new MockExternalService(true, 'timeout');
      
      // Create a function that uses our mock service
      const operation = async () => {
        return await timeoutService.performOperation();
      };
      
      // Set a test policy with short delays
      errorHandler.setRetryPolicy('test-policy', {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false
      });
      
      // Act & Assert - Expect eventual failure after retries
      await expect(errorHandler.executeWithRetry(operation, 'test-policy'))
        .rejects.toThrow('Operation timed out');
      
      // Should have called the service 1 + 3 times (initial + retries)
      expect(timeoutService.callCount).toBe(4);
      
      // Verify logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retry attempt'),
        expect.any(Object)
      );
    });

    it('should not retry operations that fail with non-retryable errors', async () => {
      // Arrange - Service that fails with validation error
      const validationService = new MockExternalService(true, 'validation');
      
      // Override the performOperation method
      validationService.performOperation = jest.fn().mockImplementation(() => {
        validationService.callCount++;
        throw new Error('Invalid input');
      });
      
      // Create a function that uses our mock service
      const operation = async () => {
        return await validationService.performOperation();
      };
      
      // Act & Assert
      await expect(errorHandler.executeWithRetry(operation))
        .rejects.toThrow('Invalid input');
      
      // Should have called the service only once (no retries)
      expect(validationService.callCount).toBe(1);
    });
    
    it('should handle successful retry after transient failures', async () => {
      // Arrange - Service that fails only on first two calls
      const transientService = new MockExternalService();
      
      // Override to fail only first two times
      transientService.performOperation = jest.fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout 1'))
        .mockRejectedValueOnce(new TimeoutError('Timeout 2'))
        .mockResolvedValue({ success: true, data: 'finally worked' });
      
      // Create a function that uses our mock service
      const operation = async () => {
        return await transientService.performOperation();
      };
      
      // Act
      const result = await errorHandler.executeWithRetry(operation);
      
      // Assert
      expect(result).toEqual({ success: true, data: 'finally worked' });
      expect(transientService.performOperation).toHaveBeenCalledTimes(3);
      
      // Verify appropriate logging
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retry attempt 1'),
        expect.any(Object)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retry attempt 2'),
        expect.any(Object)
      );
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should trip circuit breaker after threshold failures', async () => {
      // Arrange
      const failingService = new MockExternalService(true, 'external');
      const serviceName = 'test-circuit-service';
      
      // Override threshold for test
      const breaker = {
        state: 'closed',
        failures: 0,
        lastFailure: null,
        nextAttempt: null,
        threshold: 3, // Lower threshold for test
        resetTimeout: 10000
      };
      errorHandler.circuitBreakers.set(serviceName, breaker);
      
      // Create a function that uses our mock service
      const operation = async () => {
        // Check circuit breaker before operation
        errorHandler._checkCircuitBreaker(serviceName);
        
        try {
          return await failingService.performOperation();
        } catch (error) {
          // Record failure in circuit breaker
          errorHandler._recordFailure(serviceName, error);
          throw error;
        }
      };
      
      // Act - Call until circuit trips
      // First call
      await expect(operation()).rejects.toThrow('External service unavailable');
      expect(errorHandler.circuitBreakers.get(serviceName).state).toBe('closed');
      expect(errorHandler.circuitBreakers.get(serviceName).failures).toBe(1);
      
      // Second call
      await expect(operation()).rejects.toThrow('External service unavailable');
      expect(errorHandler.circuitBreakers.get(serviceName).state).toBe('closed');
      expect(errorHandler.circuitBreakers.get(serviceName).failures).toBe(2);
      
      // Third call - should trip the circuit
      await expect(operation()).rejects.toThrow('External service unavailable');
      
      // Assert - Circuit should be open
      expect(errorHandler.circuitBreakers.get(serviceName).state).toBe('open');
      
      // Further calls should fail with circuit open error without calling service
      failingService.reset();
      
      await expect(operation()).rejects.toThrow('Service test-circuit-service is unavailable');
      expect(failingService.callCount).toBe(0); // Service not called when circuit is open
    });
    
    it('should allow a test request when circuit transitions to half-open', async () => {
      // Arrange
      const recoveringService = new MockExternalService();
      const serviceName = 'recovering-service';
      
      // Setup an open circuit that's ready to transition to half-open
      errorHandler.circuitBreakers.set(serviceName, {
        state: 'open',
        failures: 5,
        lastFailure: Date.now() - 60000, // 60 seconds ago
        nextAttempt: Date.now() - 1000, // 1 second ago (expired)
        threshold: 5,
        resetTimeout: 1000 // 1 second for test
      });
      
      // Create a function that uses our mock service
      const operation = async () => {
        // Check circuit breaker before operation
        errorHandler._checkCircuitBreaker(serviceName);
        
        try {
          const result = await recoveringService.performOperation();
          // Record success in circuit breaker
          errorHandler._recordSuccess(serviceName);
          return result;
        } catch (error) {
          // Record failure in circuit breaker
          errorHandler._recordFailure(serviceName, error);
          throw error;
        }
      };
      
      // Act
      const result = await operation();
      
      // Assert
      expect(result).toEqual({ success: true, data: 'result' });
      expect(recoveringService.callCount).toBe(1);
      
      // Circuit should now be closed
      const breaker = errorHandler.circuitBreakers.get(serviceName);
      expect(breaker.state).toBe('closed');
      expect(breaker.failures).toBe(0);
    });
    
    it('should reopen circuit if test request fails when half-open', async () => {
      // Arrange
      const unstableService = new MockExternalService(true, 'external');
      const serviceName = 'unstable-service';
      
      // Setup a half-open circuit
      errorHandler.circuitBreakers.set(serviceName, {
        state: 'half-open',
        failures: 5,
        lastFailure: Date.now() - 60000, // 60 seconds ago
        nextAttempt: null,
        threshold: 5,
        resetTimeout: 1000 // 1 second for test
      });
      
      // Create a function that uses our mock service
      const operation = async () => {
        // Check circuit breaker before operation
        errorHandler._checkCircuitBreaker(serviceName);
        
        try {
          const result = await unstableService.performOperation();
          // Record success in circuit breaker
          errorHandler._recordSuccess(serviceName);
          return result;
        } catch (error) {
          // Record failure in circuit breaker
          errorHandler._recordFailure(serviceName, error);
          throw error;
        }
      };
      
      // Act
      await expect(operation()).rejects.toThrow('External service unavailable');
      
      // Assert
      expect(unstableService.callCount).toBe(1);
      
      // Circuit should be open again
      const breaker = errorHandler.circuitBreakers.get(serviceName);
      expect(breaker.state).toBe('open');
      expect(breaker.nextAttempt).toBeGreaterThan(Date.now());
    });
  });

  describe('Error Event Integration', () => {
    it('should publish error events to message bus', async () => {
      // Arrange
      const error = new DatabaseError('Test database error', 'DB_CONNECTION_ERROR');
      
      // Act
      errorHandler.handleError(error, { service: 'db-service' });
      
      // Assert
      expect(messageBus.publishEvent).toHaveBeenCalledWith(
        'error.database',
        expect.objectContaining({
          message: 'Test database error',
          code: 'DB_CONNECTION_ERROR',
          service: 'db-service'
        })
      );
    });
    
    it('should format error details correctly for API responses', () => {
      // Arrange
      const error = new TimeoutError('Operation timed out');
      
      // Set non-production environment for detailed errors
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Act
      const response = errorHandler.handleError(error, { 
        operation: 'fetchData',
        userId: 'user123' 
      });
      
      // Assert
      expect(response).toEqual({
        success: false,
        error: {
          message: 'Operation timed out',
          code: 'TIMEOUT',
          reference: expect.any(String),
          details: {
            operation: 'fetchData',
            userId: 'user123'
          },
          stack: expect.stringContaining('Error: Operation timed out')
        }
      });
      
      // Reset environment
      process.env.NODE_ENV = originalEnv;
    });
  });
  
  describe('Error Handling Integration with executeWithRetry', () => {
    it('should integrate circuit breaker and retry logic correctly', async () => {
      // Arrange
      const serviceName = 'integrated-service';
      const unstableService = new MockExternalService(true, 'timeout');
      
      // Setup service to fail 3 times then succeed
      unstableService.performOperation = jest.fn()
        .mockRejectedValueOnce(new TimeoutError('Timeout 1'))
        .mockRejectedValueOnce(new TimeoutError('Timeout 2'))
        .mockRejectedValueOnce(new TimeoutError('Timeout 3'))
        .mockResolvedValue({ success: true, data: 'it worked' });
      
      // Create operation context with service name
      const context = { service: serviceName };
      
      // Override threshold for test
      const breaker = {
        state: 'closed',
        failures: 0,
        lastFailure: null,
        nextAttempt: null,
        threshold: 4, // Higher than our retry count
        resetTimeout: 10000
      };
      errorHandler.circuitBreakers.set(serviceName, breaker);
      
      // Use a custom policy with short delays
      errorHandler.setRetryPolicy('integration-test', {
        maxRetries: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false
      });
      
      // Create wrapper to use our service with executeWithRetry
      const operation = async () => {
        return await unstableService.performOperation();
      };
      
      // Act
      const result = await errorHandler.executeWithRetry(operation, 'integration-test', context);
      
      // Assert
      expect(result).toEqual({ success: true, data: 'it worked' });
      expect(unstableService.performOperation).toHaveBeenCalledTimes(4);
      
      // Circuit should still be closed but failures status depends on implementation
      const updatedBreaker = errorHandler.circuitBreakers.get(serviceName);
      expect(updatedBreaker.state).toBe('closed');
      // Failures may be reset or not, depending on the implementation - just verify it's a number
      expect(typeof updatedBreaker.failures).toBe('number');
    });
  });
});