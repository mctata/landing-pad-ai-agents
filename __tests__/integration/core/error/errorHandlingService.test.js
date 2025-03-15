/**
 * Integration tests for Error Handling Service
 * 
 * This tests the error handling service's ability to capture, log,
 * and respond to errors throughout the system.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ErrorHandlingService = require('../../../../src/core/error/errorHandlingService');
const { AgentError, SystemError, ValidationError } = require('../../../../src/core/error/errors');
const { getInstance: getMessageBus } = require('../../../../src/core/messaging/messageBus');

// Mock the message bus
jest.mock('../../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue(true),
    publishCommand: jest.fn().mockResolvedValue(true)
  })
}));

// Mock logger
jest.mock('../../../../src/common/services/logger', () => {
  return class MockLogger {
    getLogger() {
      return {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
      };
    }
  };
});

describe('Error Handling Service Integration', () => {
  let mongoServer;
  let errorHandlingService;
  let messageBus;
  
  beforeAll(async () => {
    // Set up in-memory MongoDB for testing
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Get mock message bus
    messageBus = await getMessageBus();
    
    // Initialize error handling service
    errorHandlingService = new ErrorHandlingService();
    await errorHandlingService.initialize();
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    
    await errorHandlingService.shutdown();
  });
  
  beforeEach(async () => {
    // Clear mocks between tests
    jest.clearAllMocks();
    
    // Clear error collection
    if (errorHandlingService.errorCollection) {
      await errorHandlingService.errorCollection.deleteMany({});
    }
  });
  
  it('should capture and log agent errors', async () => {
    // Arrange
    const agentError = new AgentError({
      message: 'Test agent error',
      agentType: 'content_creation',
      agentId: 'test-agent-123',
      errorCode: 'AGENT_SERVICE_UNAVAILABLE',
      operation: 'generateContent',
      severity: 'high'
    });
    
    // Act
    await errorHandlingService.handleError(agentError);
    
    // Assert
    // Check error was logged to database
    const storedErrors = await errorHandlingService.errorCollection.find({}).toArray();
    expect(storedErrors).toHaveLength(1);
    expect(storedErrors[0].errorType).toBe('AgentError');
    expect(storedErrors[0].agentType).toBe('content_creation');
    expect(storedErrors[0].message).toBe('Test agent error');
    
    // Check event was published
    expect(messageBus.publishEvent).toHaveBeenCalledWith(
      'error.agent',
      expect.objectContaining({
        agentType: 'content_creation',
        errorCode: 'AGENT_SERVICE_UNAVAILABLE'
      })
    );
  });
  
  it('should handle system-level errors and escalate serious issues', async () => {
    // Arrange
    const systemError = new SystemError({
      message: 'Critical system failure',
      errorCode: 'DATABASE_CONNECTION_FAILED',
      severity: 'critical',
      component: 'database'
    });
    
    // Act
    await errorHandlingService.handleError(systemError);
    
    // Assert
    // Check error was logged with correct metadata
    const storedErrors = await errorHandlingService.errorCollection.find({}).toArray();
    expect(storedErrors).toHaveLength(1);
    expect(storedErrors[0].errorType).toBe('SystemError');
    expect(storedErrors[0].severity).toBe('critical');
    expect(storedErrors[0].component).toBe('database');
    
    // Check critical event was published
    expect(messageBus.publishEvent).toHaveBeenCalledWith(
      'system.critical',
      expect.objectContaining({
        errorCode: 'DATABASE_CONNECTION_FAILED',
        severity: 'critical'
      })
    );
  });
  
  it('should aggregate similar errors', async () => {
    // Arrange - Create multiple similar errors
    const errorData = {
      message: 'Rate limit exceeded',
      errorCode: 'API_RATE_LIMIT',
      component: 'ai-provider'
    };
    
    // Act - Log similar errors
    for (let i = 0; i < 5; i++) {
      const error = new SystemError({
        ...errorData,
        data: { attempt: i }
      });
      
      await errorHandlingService.handleError(error);
    }
    
    // Assert
    // Should only create one document with count 5
    const storedErrors = await errorHandlingService.errorCollection.find({}).toArray();
    expect(storedErrors).toHaveLength(1);
    expect(storedErrors[0].count).toBe(5);
    expect(storedErrors[0].lastOccurred).toBeDefined();
    
    // Should only publish the event once for aggregated errors
    expect(messageBus.publishEvent).toHaveBeenCalledTimes(1);
  });
  
  it('should detect error patterns and generate alerts', async () => {
    // Arrange - Set up error handling service with a lower threshold for testing
    errorHandlingService.errorThreshold = 3;
    errorHandlingService.checkInterval = 100;
    
    // Create recurring validation errors
    const validationErrorData = {
      message: 'Invalid input',
      errorCode: 'VALIDATION_ERROR',
      fieldName: 'email',
      severity: 'medium'
    };
    
    // Act - Generate multiple validation errors
    for (let i = 0; i < 5; i++) {
      const error = new ValidationError({
        ...validationErrorData,
        value: `test${i}@example.com`
      });
      
      await errorHandlingService.handleError(error);
    }
    
    // Wait for pattern detection
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Assert
    // Should detect the pattern and publish an alert
    expect(messageBus.publishEvent).toHaveBeenCalledWith(
      'error.pattern',
      expect.objectContaining({
        errorCode: 'VALIDATION_ERROR',
        occurrences: 5,
        fieldName: 'email'
      })
    );
  });
  
  it('should provide error statistics for monitoring', async () => {
    // Arrange - Generate various errors
    const errorTypes = [
      new AgentError({ message: 'Agent error', agentType: 'content_creation', errorCode: 'AGENT_TIMEOUT' }),
      new SystemError({ message: 'System error', component: 'messaging', errorCode: 'QUEUE_OVERFLOW' }),
      new ValidationError({ message: 'Validation error', fieldName: 'title', errorCode: 'REQUIRED_FIELD' }),
      new AgentError({ message: 'Another agent error', agentType: 'brand_consistency', errorCode: 'MODULE_FAILED' })
    ];
    
    // Act - Log all errors
    for (const error of errorTypes) {
      await errorHandlingService.handleError(error);
    }
    
    // Get error statistics
    const statistics = await errorHandlingService.getErrorStatistics();
    
    // Assert
    expect(statistics).toBeDefined();
    expect(statistics.totalErrors).toBe(4);
    expect(statistics.byType.AgentError).toBe(2);
    expect(statistics.byType.SystemError).toBe(1);
    expect(statistics.byType.ValidationError).toBe(1);
    
    // Should include distribution by component
    expect(statistics.byComponent).toBeDefined();
    expect(statistics.byComponent.content_creation).toBe(1);
    expect(statistics.byComponent.brand_consistency).toBe(1);
    expect(statistics.byComponent.messaging).toBe(1);
  });
  
  it('should track error resolution status', async () => {
    // Arrange
    const agentError = new AgentError({
      message: 'Resolvable error',
      agentType: 'content_strategy',
      errorCode: 'API_CONNECTION_ERROR'
    });
    
    // Act - Log error, then resolve it
    const { errorId } = await errorHandlingService.handleError(agentError);
    
    // Mark error as resolved
    await errorHandlingService.resolveError(errorId, {
      resolution: 'API connection restored',
      resolvedBy: 'system'
    });
    
    // Assert
    const storedError = await errorHandlingService.errorCollection.findOne({ _id: mongoose.Types.ObjectId(errorId) });
    expect(storedError).toBeDefined();
    expect(storedError.resolved).toBe(true);
    expect(storedError.resolution).toBe('API connection restored');
    expect(storedError.resolvedBy).toBe('system');
    expect(storedError.resolvedAt).toBeDefined();
  });
});