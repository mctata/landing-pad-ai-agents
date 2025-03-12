/**
 * Unit Tests for Agent Recovery Service
 */

const { RecoveryStrategy, getInstance } = require('../../../../src/core/error/agentRecoveryService');
const { mockServices, performanceHelpers } = require('../../../../testing/testHelpers');

// Mock dependencies
jest.mock('../../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue({}),
    publishCommand: jest.fn().mockResolvedValue({}),
    isConnected: true
  })
}));

jest.mock('../../../../src/core/error/errorHandlingService', () => ({
  getInstance: jest.fn().mockResolvedValue({
    executeWithRetry: jest.fn().mockImplementation(async (operation) => {
      return await operation();
    })
  })
}));

jest.mock('../../../../src/common/services/logger', () => mockServices.createLoggerMock());

describe('AgentRecoveryService', () => {
  let recoveryService;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    recoveryService = await getInstance();
  });
  
  describe('Initialization', () => {
    it('should initialize with default strategies', async () => {
      expect(recoveryService.recoveryStrategies.size).toBeGreaterThan(0);
      expect(recoveryService.delegationMappings.size).toBeGreaterThan(0);
    });
    
    it('should subscribe to error events', async () => {
      const messageBus = await require('../../../../src/core/messaging/messageBus').getInstance();
      expect(messageBus.subscribeToEvent).toHaveBeenCalledWith('agent.failed', expect.any(Function));
      expect(messageBus.subscribeToEvent).toHaveBeenCalledWith('agent.task-failed', expect.any(Function));
    });
  });
  
  describe('Strategy Registration', () => {
    it('should register a recovery strategy', () => {
      recoveryService.registerRecoveryStrategy(
        'test-agent', 
        'test-module', 
        'timeout', 
        RecoveryStrategy.RETRY, 
        { maxRetries: 5 }
      );
      
      expect(recoveryService.recoveryStrategies.get('test-agent:test-module:timeout')).toEqual({
        strategy: RecoveryStrategy.RETRY,
        config: { maxRetries: 5 }
      });
    });
    
    it('should register an agent-level strategy', () => {
      recoveryService.registerRecoveryStrategy(
        'test-agent', 
        null, 
        'database', 
        RecoveryStrategy.RESTART, 
        {}
      );
      
      expect(recoveryService.recoveryStrategies.get('test-agent:database')).toEqual({
        strategy: RecoveryStrategy.RESTART,
        config: {}
      });
    });
  });
  
  describe('Dead Letter Queue', () => {
    it('should add entry to dead letter queue', () => {
      const key = recoveryService._addToDeadLetterQueue(
        'test-agent',
        'test-module',
        'Test error',
        'timeout',
        { someData: true }
      );
      
      expect(key).toBeDefined();
      expect(recoveryService.deadLetterQueue.has(key)).toBe(true);
      
      const entry = recoveryService.deadLetterQueue.get(key);
      expect(entry.agentId).toBe('test-agent');
      expect(entry.moduleId).toBe('test-module');
      expect(entry.error).toBe('Test error');
      expect(entry.category).toBe('timeout');
      expect(entry.data).toEqual({ someData: true });
    });
    
    it('should retrieve dead letter queue entries for specific agent', () => {
      // Add two entries for different agents
      recoveryService._addToDeadLetterQueue(
        'agent1',
        null,
        'Error 1',
        'timeout',
        {}
      );
      
      recoveryService._addToDeadLetterQueue(
        'agent2',
        null,
        'Error 2',
        'database',
        {}
      );
      
      const agent1Entries = recoveryService.getDeadLetterQueueEntries('agent1');
      expect(agent1Entries.length).toBe(1);
      expect(agent1Entries[0].agentId).toBe('agent1');
      
      const agent2Entries = recoveryService.getDeadLetterQueueEntries('agent2');
      expect(agent2Entries.length).toBe(1);
      expect(agent2Entries[0].agentId).toBe('agent2');
      
      const allEntries = recoveryService.getDeadLetterQueueEntries();
      expect(allEntries.length).toBe(2);
    });
    
    it('should delete dead letter queue entry', () => {
      const key = recoveryService._addToDeadLetterQueue(
        'test-agent',
        null,
        'Test error',
        'timeout',
        {}
      );
      
      const result = recoveryService.deleteDeadLetterQueueEntry(key);
      expect(result).toBe(true);
      expect(recoveryService.deadLetterQueue.has(key)).toBe(false);
    });
  });
  
  describe('Agent Failure Handling', () => {
    it('should handle agent failure with appropriate strategy', async () => {
      // Set up a spy on _applyRecoveryStrategy
      const applySpy = jest.spyOn(recoveryService, '_applyRecoveryStrategy').mockResolvedValue(undefined);
      
      // Call handleAgentFailure
      await recoveryService.handleAgentFailure({
        agentId: 'test-agent',
        error: 'Test error',
        category: 'timeout',
        moduleId: null
      });
      
      // Check that strategy was applied
      expect(applySpy).toHaveBeenCalledWith(
        'test-agent',
        null,
        'Test error',
        'timeout',
        expect.any(Object),
        expect.any(Object)
      );
      
      // Check that recovery history was updated
      const history = recoveryService.getRecoveryHistory('test-agent');
      expect(history.length).toBe(1);
      expect(history[0].category).toBe('timeout');
    });
    
    it('should not proceed if recovery is already in progress', async () => {
      // Set recovery in progress
      recoveryService.recoveryInProgress.add('busy-agent');
      
      // Set up a spy on _applyRecoveryStrategy
      const applySpy = jest.spyOn(recoveryService, '_applyRecoveryStrategy');
      
      // Call handleAgentFailure
      await recoveryService.handleAgentFailure({
        agentId: 'busy-agent',
        error: 'Test error',
        category: 'timeout'
      });
      
      // Check that strategy was not applied
      expect(applySpy).not.toHaveBeenCalled();
    });
  });
  
  describe('Task Failure Handling', () => {
    it('should handle task failure with retry for retryable error', async () => {
      // Mock shouldRetryTask to return true
      jest.spyOn(recoveryService, '_shouldRetryTask').mockResolvedValue(true);
      
      // Mock setTimeout
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 123;
      });
      
      // Set up a spy on _retryTask
      const retrySpy = jest.spyOn(recoveryService, '_retryTask').mockResolvedValue(true);
      
      // Call handleTaskFailure
      await recoveryService.handleTaskFailure({
        agentId: 'test-agent',
        taskId: 'test-task',
        workflowId: 'test-workflow',
        error: 'Test error',
        category: 'timeout'
      });
      
      // Check that task was retried
      expect(retrySpy).toHaveBeenCalledWith('test-agent', 'test-task', expect.any(Object));
      
      // Clean up
      global.setTimeout = originalSetTimeout;
    });
    
    it('should not retry non-retryable task errors', async () => {
      // Mock shouldRetryTask to return false
      jest.spyOn(recoveryService, '_shouldRetryTask').mockResolvedValue(false);
      
      // Set up a spy on _retryTask
      const retrySpy = jest.spyOn(recoveryService, '_retryTask');
      
      // Mock messageBus
      const messageBus = await require('../../../../src/core/messaging/messageBus').getInstance();
      
      // Call handleTaskFailure with a critical workflow task
      await recoveryService.handleTaskFailure({
        agentId: 'test-agent',
        taskId: 'test-task',
        workflowId: 'test-workflow',
        error: 'Test error',
        category: 'validation'
      });
      
      // Check that task was not retried
      expect(retrySpy).not.toHaveBeenCalled();
      
      // Check that workflow failure event was published
      expect(messageBus.publishEvent).toHaveBeenCalledWith('workflow.failed', expect.objectContaining({
        workflowId: 'test-workflow'
      }));
    });
  });
  
  describe('Recovery Strategy Determination', () => {
    it('should select most specific strategy available', async () => {
      // Register strategies at different levels of specificity
      recoveryService.registerRecoveryStrategy(
        'test-agent', 
        'test-module', 
        'timeout', 
        RecoveryStrategy.RETRY, 
        { maxRetries: 5 }
      );
      
      recoveryService.registerRecoveryStrategy(
        'test-agent', 
        null, 
        'timeout', 
        RecoveryStrategy.RESTART, 
        {}
      );
      
      recoveryService.registerRecoveryStrategy(
        null, 
        null, 
        'timeout', 
        RecoveryStrategy.SKIP, 
        {}
      );
      
      // Set up a spy on _applyRecoveryStrategy
      const applySpy = jest.spyOn(recoveryService, '_applyRecoveryStrategy').mockResolvedValue(undefined);
      
      // Call handleAgentFailure with module
      await recoveryService.handleAgentFailure({
        agentId: 'test-agent',
        moduleId: 'test-module',
        error: 'Test error',
        category: 'timeout'
      });
      
      // Check that the most specific strategy was applied
      expect(applySpy).toHaveBeenCalledWith(
        'test-agent',
        'test-module',
        'Test error',
        'timeout',
        expect.objectContaining({
          strategy: RecoveryStrategy.RETRY,
          config: { maxRetries: 5 }
        }),
        expect.any(Object)
      );
    });
    
    it('should fall back to less specific strategies if needed', async () => {
      // Register only agent level strategy
      recoveryService.registerRecoveryStrategy(
        'test-agent', 
        null, 
        'timeout', 
        RecoveryStrategy.RESTART, 
        {}
      );
      
      // Set up a spy on _applyRecoveryStrategy
      const applySpy = jest.spyOn(recoveryService, '_applyRecoveryStrategy').mockResolvedValue(undefined);
      
      // Call handleAgentFailure with module (no specific strategy exists)
      await recoveryService.handleAgentFailure({
        agentId: 'test-agent',
        moduleId: 'test-module',
        error: 'Test error',
        category: 'timeout'
      });
      
      // Check that the agent-level strategy was applied
      expect(applySpy).toHaveBeenCalledWith(
        'test-agent',
        'test-module',
        'Test error',
        'timeout',
        expect.objectContaining({
          strategy: RecoveryStrategy.RESTART
        }),
        expect.any(Object)
      );
    });
  });
});