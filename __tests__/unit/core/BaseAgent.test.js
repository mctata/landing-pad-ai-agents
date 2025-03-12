/**
 * Unit Tests for BaseAgent
 */

const BaseAgent = require('../../../core/BaseAgent');
const { mockServices } = require('../../../testing/testHelpers');

// Create a concrete implementation of BaseAgent for testing
class TestAgent extends BaseAgent {
  _registerCommands() {
    this.commands.set('test-command', this._handleTestCommand.bind(this));
    this.commands.set('fail-command', this._handleFailCommand.bind(this));
  }
  
  async _handleTestCommand(payload) {
    return { message: 'Command executed', payload };
  }
  
  async _handleFailCommand() {
    throw new Error('Command failed');
  }
  
  async _handleEvent(eventType, event) {
    this.lastEvent = { eventType, event };
    return true;
  }
  
  // Fallback method for testing
  async _fallbackAlternateProvider(data) {
    return { source: 'fallback', data };
  }
}

// Mock services
const mockMessaging = {
  publishEvent: jest.fn().mockResolvedValue(true),
  publishCommand: jest.fn().mockResolvedValue({ id: 'cmd-123' }),
  subscribe: jest.fn().mockResolvedValue(true),
  consumeCommands: jest.fn().mockResolvedValue(true),
  stopConsuming: jest.fn().mockResolvedValue(true)
};

const mockConfig = {
  modules: {
    testModule: {
      enabled: true,
      required: false
    },
    requiredModule: {
      enabled: true,
      required: true
    }
  },
  heartbeatInterval: 1000,
  commandTimeout: 5000,
  messaging: {
    subscriptions: {
      'test-agent': [
        { event: 'test.event', description: 'Test event subscription' }
      ]
    }
  }
};

// Mock logger
const mockLogger = mockServices.createLoggerMock();

jest.mock('../../../services/LoggerService', () => ({
  createLogger: jest.fn().mockReturnValue(mockLogger)
}));

// Mock module class
const mockModule = {
  initialize: jest.fn().mockResolvedValue(true),
  start: jest.fn().mockResolvedValue(true),
  stop: jest.fn().mockResolvedValue(true),
  getStatus: jest.fn().mockReturnValue({ status: 'running' }),
  getMetrics: jest.fn().mockResolvedValue({ operations: 10 })
};

// Mock for requiring modules dynamically
jest.mock('../../../agents/test-agent/modules/test-module', () => 
  jest.fn().mockImplementation(() => mockModule),
  { virtual: true }
);

jest.mock('../../../agents/test-agent/modules/required-module', () => 
  jest.fn().mockImplementation(() => mockModule),
  { virtual: true }
);

// Mock failing module
const mockFailingModule = {
  initialize: jest.fn().mockRejectedValue(new Error('Module initialization failed')),
  start: jest.fn().mockRejectedValue(new Error('Module start failed')),
  stop: jest.fn().mockRejectedValue(new Error('Module stop failed'))
};

jest.mock('../../../agents/test-agent/modules/failing-module', () => 
  jest.fn().mockImplementation(() => mockFailingModule),
  { virtual: true }
);

describe('BaseAgent', () => {
  let agent;
  let services;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    services = {
      messaging: mockMessaging,
      config: mockConfig,
      logger: mockLogger
    };
    
    agent = new TestAgent({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent for unit tests',
      modules: {
        testModule: {
          enabled: true,
          required: false
        },
        requiredModule: {
          enabled: true,
          required: true
        }
      }
    }, services);
  });
  
  afterEach(() => {
    // Clean up any interval that might be running
    if (agent.heartbeatIntervalId) {
      clearInterval(agent.heartbeatIntervalId);
      agent.heartbeatIntervalId = null;
    }
  });
  
  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await agent.initialize();
      
      expect(result).toBe(true);
      expect(agent.status).toBe('initialized');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Agent initialized'));
      
      // Should have set up modules
      expect(agent.modules.size).toBe(2);
      
      // Should have registered commands
      expect(agent.commands.size).toBeGreaterThan(0);
      
      // Should have set up messaging
      expect(mockMessaging.subscribe).toHaveBeenCalled();
    });
    
    it('should handle non-critical module initialization failure', async () => {
      // Add a failing module that is not required
      agent.config.modules.failingModule = {
        enabled: true,
        required: false
      };
      
      const result = await agent.initialize();
      
      expect(result).toBe(true);
      expect(agent.status).toBe('initialized');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize module'),
        expect.any(Error)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Continuing initialization without non-critical module')
      );
    });
    
    it('should fail initialization if a required module fails', async () => {
      // Add a failing module that is required
      agent.config.modules.failingModule = {
        enabled: true,
        required: true
      };
      
      await expect(agent.initialize()).rejects.toThrow('Module initialization failed');
      expect(agent.status).toBe('error');
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.failed',
        expect.objectContaining({
          agentId: 'test-agent',
          moduleId: 'failingModule',
          category: 'module_init_failure'
        })
      );
    });
  });
  
  describe('Command Handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    it('should handle commands successfully', async () => {
      const command = {
        id: 'cmd-123',
        type: 'test-command',
        payload: { test: true }
      };
      
      const result = await agent.handleCommand(command);
      
      expect(result).toEqual({
        id: 'cmd-123',
        success: true,
        result: {
          message: 'Command executed',
          payload: { test: true }
        },
        duration: expect.any(Number)
      });
    });
    
    it('should handle command failures', async () => {
      const command = {
        id: 'cmd-123',
        type: 'fail-command',
        payload: {}
      };
      
      const result = await agent.handleCommand(command);
      
      expect(result).toEqual({
        id: 'cmd-123',
        success: false,
        error: 'Command failed',
        duration: expect.any(Number)
      });
      
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.command-failed',
        expect.objectContaining({
          agentId: 'test-agent',
          commandType: 'fail-command',
          commandId: 'cmd-123'
        })
      );
    });
    
    it('should handle unknown command types', async () => {
      const command = {
        id: 'cmd-123',
        type: 'unknown-command',
        payload: {}
      };
      
      const result = await agent.handleCommand(command);
      
      expect(result).toEqual({
        id: 'cmd-123',
        success: false,
        error: 'Unknown command type: unknown-command',
        duration: expect.any(Number)
      });
    });
  });
  
  describe('Lifecycle Management', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    it('should start successfully', async () => {
      const result = await agent.start();
      
      expect(result).toBe(true);
      expect(agent.status).toBe('running');
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.status-changed',
        expect.objectContaining({
          agentId: 'test-agent',
          status: 'running'
        })
      );
      
      // Should have started modules
      expect(mockModule.start).toHaveBeenCalled();
      
      // Should have started command listener
      expect(mockMessaging.consumeCommands).toHaveBeenCalled();
    });
    
    it('should handle non-critical module start failure', async () => {
      // Add a failing module that is not required
      agent.config.modules.failingModule = {
        enabled: true,
        required: false
      };
      
      // Add the module instance
      agent.modules.set('failingModule', mockFailingModule);
      
      const result = await agent.start();
      
      expect(result).toBe(true);
      expect(agent.status).toBe('running');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start module'),
        expect.any(Error)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Continuing startup without non-critical module')
      );
    });
    
    it('should stop successfully', async () => {
      // Start the agent first
      await agent.start();
      
      const result = await agent.stop();
      
      expect(result).toBe(true);
      expect(agent.status).toBe('stopped');
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.status-changed',
        expect.objectContaining({
          agentId: 'test-agent',
          status: 'stopped'
        })
      );
      
      // Should have stopped modules
      expect(mockModule.stop).toHaveBeenCalled();
      
      // Should have stopped command listener
      expect(mockMessaging.stopConsuming).toHaveBeenCalled();
    });
  });
  
  describe('Recovery Commands', () => {
    beforeEach(async () => {
      await agent.initialize();
      await agent.start();
    });
    
    it('should handle restart command', async () => {
      const payload = {};
      
      const result = await agent._handleRestartCommand(payload);
      
      expect(result).toEqual({
        success: true,
        message: 'Agent test-agent restarted successfully'
      });
      
      // Should have stopped and started again
      expect(agent.status).toBe('running');
      
      // Should have published recovery event
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.recovery-completed',
        expect.objectContaining({
          agentId: 'test-agent',
          strategy: 'restart'
        })
      );
    });
    
    it('should handle restart module command', async () => {
      const payload = { moduleId: 'testModule' };
      
      const result = await agent._handleRestartModuleCommand(payload);
      
      expect(result).toEqual({
        success: true,
        message: 'Module testModule restarted successfully'
      });
      
      // Should have stopped and started the module
      expect(mockModule.stop).toHaveBeenCalled();
      expect(mockModule.start).toHaveBeenCalled();
      
      // Should have published recovery event
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.recovery-completed',
        expect.objectContaining({
          agentId: 'test-agent',
          strategy: 'module_restart',
          details: { moduleId: 'testModule' }
        })
      );
    });
    
    it('should handle recover command when agent is running', async () => {
      const payload = { reason: 'test recovery' };
      
      const result = await agent._handleRecoverCommand(payload);
      
      expect(result).toEqual({
        success: true,
        message: 'Agent is already running, no recovery needed'
      });
    });
    
    it('should handle recover command when agent is in error state', async () => {
      // Put agent in error state
      agent.status = 'error';
      
      const payload = { reason: 'test recovery' };
      
      const result = await agent._handleRecoverCommand(payload);
      
      expect(result).toEqual({
        success: true,
        message: 'Agent test-agent restarted successfully'
      });
      
      // Should have restarted
      expect(agent.status).toBe('running');
    });
    
    it('should handle fallback command', async () => {
      const payload = {
        fallbackMethod: 'alternateProvider',
        data: { original: 'data' }
      };
      
      const result = await agent._handleUseFallbackCommand(payload);
      
      expect(result).toEqual({
        success: true,
        message: 'Fallback method alternateProvider executed successfully',
        result: { source: 'fallback', data: { original: 'data' } }
      });
      
      // Should have published recovery event
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.recovery-completed',
        expect.objectContaining({
          agentId: 'test-agent',
          strategy: 'fallback_used',
          details: { fallbackMethod: 'alternateProvider' }
        })
      );
    });
  });
  
  describe('Heartbeat', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    it('should send heartbeat with agent status and metrics', async () => {
      await agent._sendHeartbeat();
      
      expect(mockMessaging.publishEvent).toHaveBeenCalledWith(
        'agent.heartbeat',
        expect.objectContaining({
          agentId: 'test-agent',
          status: 'initialized',
          metrics: expect.objectContaining({
            uptime: expect.any(Number),
            memory: expect.any(Object),
            modules: expect.objectContaining({
              testModule: expect.objectContaining({
                operations: 10
              })
            })
          })
        })
      );
    });
    
    it('should start and stop heartbeat interval', () => {
      // Start interval
      agent._startHeartbeatInterval();
      
      expect(agent.heartbeatIntervalId).toBeDefined();
      
      // Stop interval
      agent._stopHeartbeatInterval();
      
      expect(agent.heartbeatIntervalId).toBeNull();
    });
  });
  
  describe('Status Reporting', () => {
    beforeEach(async () => {
      await agent.initialize();
    });
    
    it('should return agent status with module status', () => {
      const status = agent.getStatus();
      
      expect(status).toEqual({
        id: 'test-agent',
        name: 'Test Agent',
        status: 'initialized',
        modules: expect.objectContaining({
          testModule: expect.any(Object),
          requiredModule: expect.any(Object)
        }),
        uptime: expect.any(Number)
      });
    });
  });
});