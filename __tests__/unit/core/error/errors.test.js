/**
 * Unit tests for Error utilities
 */

const {
  LandingPadError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
  RateLimitError,
  InternalError,
  AgentError,
  WorkflowError,
  MessagingError,
  CriticalError,
  withErrorHandling
} = require('../../../../src/core/error/errors');
const { ErrorCategory, ErrorSeverity } = require('../../../../src/core/error/errorHandlingService');

// Mock the error handling service
jest.mock('../../../../src/core/error/errorHandlingService', () => {
  const originalModule = jest.requireActual('../../../../src/core/error/errorHandlingService');
  
  return {
    ...originalModule,
    getInstance: jest.fn().mockResolvedValue({
      handleError: jest.fn((error, context) => ({
        success: false,
        error: {
          message: error.message,
          code: error.code || 'UNKNOWN_ERROR',
          reference: error.reference || 'mock-reference'
        }
      }))
    })
  };
});

describe('Error Classes', () => {
  describe('LandingPadError base class', () => {
    it('should create a base error with all properties', () => {
      // Arrange
      const message = 'Test base error';
      const category = ErrorCategory.INTERNAL;
      const code = 'TEST_ERROR';
      const severity = ErrorSeverity.ERROR;
      const details = { param: 'value' };
      
      // Act
      const error = new LandingPadError(message, category, code, severity, details);
      
      // Assert
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('LandingPadError');
      expect(error.message).toBe(message);
      expect(error.category).toBe(category);
      expect(error.code).toBe(code);
      expect(error.severity).toBe(severity);
      expect(error.details).toEqual(details);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.reference).toBeDefined();
      expect(error.stack).toBeDefined();
    });
  });

  describe('Specific error classes', () => {
    it('should create ValidationError with correct properties', () => {
      // Act
      const error = new ValidationError('Invalid input');
      
      // Assert
      expect(error).toBeInstanceOf(LandingPadError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });

    it('should create AuthorizationError with correct properties', () => {
      // Act
      const error = new AuthorizationError('Not authorized');
      
      // Assert
      expect(error).toBeInstanceOf(LandingPadError);
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });

    it('should create NotFoundError with correct properties', () => {
      // Act
      const error = new NotFoundError('Resource not found');
      
      // Assert
      expect(error).toBeInstanceOf(LandingPadError);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.category).toBe(ErrorCategory.RESOURCE_NOT_FOUND);
      expect(error.code).toBe('RESOURCE_NOT_FOUND');
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });

    it('should create DatabaseError with correct properties', () => {
      // Act
      const error = new DatabaseError('Database connection failed');
      
      // Assert
      expect(error).toBeInstanceOf(LandingPadError);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.category).toBe(ErrorCategory.DATABASE);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
    });

    it('should create ExternalServiceError with correct properties', () => {
      // Act
      const error = new ExternalServiceError('API call failed');
      
      // Assert
      expect(error).toBeInstanceOf(LandingPadError);
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(error.category).toBe(ErrorCategory.EXTERNAL_SERVICE);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
    });

    it('should create CriticalError with correct properties', () => {
      // Act
      const error = new CriticalError('System failure');
      
      // Assert
      expect(error).toBeInstanceOf(LandingPadError);
      expect(error).toBeInstanceOf(CriticalError);
      expect(error.category).toBe(ErrorCategory.INTERNAL);
      expect(error.code).toBe('CRITICAL_ERROR');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should allow custom error codes', () => {
      // Act
      const error = new DatabaseError('Custom database error', 'DB_CONSTRAINT_VIOLATION');
      
      // Assert
      expect(error.code).toBe('DB_CONSTRAINT_VIOLATION');
    });

    it('should allow custom details', () => {
      // Arrange
      const details = {
        table: 'users',
        operation: 'insert',
        constraint: 'unique_email'
      };
      
      // Act
      const error = new DatabaseError('Database constraint violation', 'DB_CONSTRAINT_VIOLATION', details);
      
      // Assert
      expect(error.details).toEqual(details);
    });
  });
});

describe('withErrorHandling utility', () => {
  it('should return result from wrapped function when successful', async () => {
    // Arrange
    const mockFn = jest.fn().mockResolvedValue({ success: true, data: 'test' });
    const wrappedFn = withErrorHandling(mockFn);
    
    // Act
    const result = await wrappedFn('arg1', 'arg2');
    
    // Assert
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    expect(result).toEqual({ success: true, data: 'test' });
  });

  it('should handle errors and return standardized response', async () => {
    // Arrange
    const mockError = new ValidationError('Invalid input');
    const mockFn = jest.fn().mockRejectedValue(mockError);
    const wrappedFn = withErrorHandling(mockFn);
    
    // Act
    const result = await wrappedFn('arg1');
    
    // Assert
    expect(mockFn).toHaveBeenCalledWith('arg1');
    expect(result).toEqual({
      success: false,
      error: {
        message: 'Invalid input',
        code: 'VALIDATION_ERROR',
        reference: 'mock-reference'
      }
    });
  });

  it('should include function context in error handling', async () => {
    // Arrange
    const { getInstance } = require('../../../../src/core/error/errorHandlingService');
    const mockErrorHandler = await getInstance();
    const mockError = new Error('Test error');
    const mockFn = jest.fn().mockRejectedValue(mockError);
    
    // Provide context in options
    const options = { 
      context: { 
        service: 'test-service',
        operation: 'test-operation'
      } 
    };
    
    const wrappedFn = withErrorHandling(mockFn, options);
    
    // Act
    await wrappedFn();
    
    // Assert
    expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
      mockError,
      expect.objectContaining({
        functionName: 'mockConstructor',
        service: 'test-service',
        operation: 'test-operation'
      })
    );
  });

  it('should include arguments in context when logArgs is true', async () => {
    // Arrange
    const { getInstance } = require('../../../../src/core/error/errorHandlingService');
    const mockErrorHandler = await getInstance();
    const mockError = new Error('Test error');
    const mockFn = jest.fn().mockRejectedValue(mockError);
    
    // Enable logArgs
    const options = { logArgs: true };
    const wrappedFn = withErrorHandling(mockFn, options);
    
    // Act
    await wrappedFn('arg1', { sensitive: 'data' });
    
    // Assert
    expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
      mockError,
      expect.objectContaining({
        arguments: ['arg1', { sensitive: 'data' }]
      })
    );
  });

  it('should preserve this context in wrapped function', async () => {
    // Arrange
    const mockObject = {
      value: 'test',
      regularMethod() {
        return this.value;
      },
      asyncMethod: withErrorHandling(async function() {
        return this.value;
      })
    };
    
    // Act
    const result = await mockObject.asyncMethod();
    
    // Assert
    expect(result).toBe('test');
  });
});