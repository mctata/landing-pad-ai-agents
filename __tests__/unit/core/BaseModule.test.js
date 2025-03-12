/**
 * Unit Tests for BaseModule
 */

const BaseModule = require('../../../core/BaseModule');
const { mockServices } = require('../../../testing/testHelpers');

// Create a concrete implementation of BaseModule for testing
class TestModule extends BaseModule {
  async _initialize() {
    // Initialize module-specific resources
    this._initialized = true;
    return true;
  }
  
  async _start() {
    if (!this._initialized) {
      throw new Error('Cannot start uninitialized module');
    }
    this._running = true;
    return true;
  }
  
  async _stop() {
    this._running = false;
    return true;
  }
  
  async testOperation(params) {
    return { success: true, params };
  }
  
  async failingOperation() {
    throw new Error('Operation failed');
  }
  
  async getMetrics() {
    return {
      operations: 42,
      errors: 0,
      lastOperation: Date.now()
    };
  }
}

// Mock services
const mockMessaging = {
  publishEvent: jest.fn().mockResolvedValue(true)
};

const mockStorage = {
  storeActivity: jest.fn().mockResolvedValue(true)
};

const mockErrorHandling = {
  executeWithRetry: jest.fn().mockImplementation(async (fn) => fn()),
  resetCircuitBreaker: jest.fn().mockResolvedValue(true),
  _checkCircuitBreaker: jest.fn()
};

const mockMonitoring = {
  reportError: jest.fn().mockResolvedValue(true)
};

// Mock logger
const mockLogger = mockServices.createLoggerMock();

jest.mock('../../../services/LoggerService', () => ({
  createLogger: jest.fn().mockReturnValue(mockLogger)
}));

describe('BaseModule', () => {
  let module;
  let services;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    services = {
      messaging: mockMessaging,
      storage: mockStorage,
      errorHandling: mockErrorHandling,
      monitoring: mockMonitoring,
      logger: mockLogger
    };
    
    module = new TestModule({
      enabled: true,
      settings: {
        testSetting: 'value'
      }
    }, services);
  });
  
  describe('Lifecycle Management', () => {
    it('should initialize successfully', async () => {
      const result = await module.initialize();
      
      expect(result).toBe(true);
      expect(module.status).toBe('initialized');
      expect(module._initialized).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Module initialized'));
    });
    
    it('should fail initialization if _initialize throws', async () => {
      // Override _initialize to throw
      jest.spyOn(module, '_initialize').mockRejectedValueOnce(new Error('Initialization failed'));
      
      await expect(module.initialize()).rejects.toThrow('Initialization failed');
      expect(module.status).toBe('error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize module'),
        expect.any(Error)
      );
    });
    
    it('should start successfully after initialization', async () => {
      await module.initialize();
      const result = await module.start();
      
      expect(result).toBe(true);
      expect(module.status).toBe('running');
      expect(module._running).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Module started'));
    });
    
    it('should stop successfully', async () => {
      await module.initialize();
      await module.start();
      
      const result = await module.stop();
      
      expect(result).toBe(true);
      expect(module.status).toBe('stopped');
      expect(module._running).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Module stopped'));
    });
  });
  
  describe('Config Validation', () => {
    it('should validate config correctly', () => {
      const result = module._validateConfig();
      expect(result).toBe(true);
    });
    
    it('should throw error if module is not enabled', () => {
      module.config.enabled = false;
      expect(() => module._validateConfig()).toThrow('Module is not enabled');
    });
    
    it('should throw error if config is missing', () => {
      module.config = undefined;
      expect(() => module._validateConfig()).toThrow('Module configuration is required');
    });
  });
  
  describe('Activity Logging', () => {
    beforeEach(async () => {
      await module.initialize();
    });
    
    it('should log activity', () => {
      module._logActivity('Test activity', { param: 'value' });
      
      expect(mockLogger.info).toHaveBeenCalledWith('Test activity', {
        module: 'TestModule',
        param: 'value'
      });
    });
    
    it('should store activity in storage if available', async () => {
      module._logActivity('Test activity', { param: 'value' });
      
      expect(mockStorage.storeActivity).toHaveBeenCalledWith(expect.objectContaining({
        module: 'TestModule',
        activity: 'Test activity',
        data: expect.objectContaining({ param: 'value' })
      }));
    });
  });
  
  describe('Error Handling', () => {
    beforeEach(async () => {
      await module.initialize();
    });
    
    it('should handle errors properly', async () => {
      const error = new Error('Test error');
      
      await expect(module._handleError(error, 'test context')).rejects.toThrow('Test error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in test context'),
        error
      );
      expect(module.status).toBe('error');
    });
    
    it('should report errors to monitoring service if available', async () => {
      const error = new Error('Test error');
      
      try {
        await module._handleError(error, 'test context');
      } catch (err) {
        // Expected
      }
      
      expect(mockMonitoring.reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          module: 'TestModule',
          context: 'test context'
        })
      );
    });
    
    it('should publish error event if messaging is available', async () => {
      const error = new Error('Test error');
      error.category = 'test_category';
      error.code = 'TEST_ERROR';
      
      try {
        await module._handleError(error, 'test context');
      } catch (err) {
        // Expected
      }
      
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'module.error',
        expect.objectContaining({
          module: 'TestModule',
          context: 'test context',
          error: 'Test error',
          category: 'test_category',
          code: 'TEST_ERROR'
        })
      );
    });
    
    it('should not rethrow error if rethrow is false', async () => {
      const error = new Error('Test error');
      
      await module._handleError(error, 'test context', false);
      
      // Should set status to error
      expect(module.status).toBe('error');
      
      // Should log error
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in test context'),
        error
      );
    });
  });
  
  describe('Circuit Breaker Integration', () => {
    beforeEach(async () => {
      await module.initialize();
    });
    
    it('should execute with circuit breaker if error handling service available', async () => {
      const testFn = jest.fn().mockResolvedValue('result');
      
      const result = await module._executeWithCircuitBreaker(testFn, 'test-service');
      
      expect(result).toBe('result');
      expect(mockErrorHandling.executeWithRetry).toHaveBeenCalledWith(
        testFn,
        'default',
        expect.objectContaining({ service: 'test-service' })
      );
    });
    
    it('should execute directly if error handling service not available', async () => {
      // Remove error handling service
      delete module.services.errorHandling;
      
      const testFn = jest.fn().mockResolvedValue('result');
      
      const result = await module._executeWithCircuitBreaker(testFn, 'test-service');
      
      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalled();
    });
    
    it('should check service availability', async () => {
      // Service is available
      mockErrorHandling._checkCircuitBreaker.mockImplementationOnce(() => {});
      const available = await module._isServiceAvailable('test-service');
      expect(available).toBe(true);
      
      // Service is not available
      mockErrorHandling._checkCircuitBreaker.mockImplementationOnce(() => {
        throw new Error('Circuit open');
      });
      const notAvailable = await module._isServiceAvailable('error-service');
      expect(notAvailable).toBe(false);
    });
    
    it('should reset circuit breaker', async () => {
      await module._resetServiceCircuitBreaker('test-service');
      
      expect(mockErrorHandling.resetCircuitBreaker).toHaveBeenCalledWith('test-service');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Reset circuit breaker for service: test-service')
      );
    });
  });
  
  describe('Status Reporting', () => {
    it('should return module status', () => {
      const status = module.getStatus();
      
      expect(status).toEqual({
        name: 'TestModule',
        status: 'initializing'
      });
    });
    
    it('should return metrics', async () => {
      const metrics = await module.getMetrics();
      
      expect(metrics).toEqual({
        status: 'initializing',
        lastActivity: null
      });
    });
  });
});