/**
 * Agent Recovery Service for Landing Pad AI Agents
 * 
 * Provides comprehensive error recovery mechanisms for agent operations, including:
 * - Automatic agent recovery strategies
 * - Failed task retry handling
 * - Dead letter queues for unrecoverable tasks
 * - Agent health monitoring integration
 * - Recovery history tracking
 */

const { getInstance: getMessageBus } = require('../messaging/messageBus');
const { getInstance: getErrorHandlingService } = require('./errorHandlingService');
const logger = require('../../common/services/logger');

// Recovery strategies
const RecoveryStrategy = {
  RESTART: 'restart',           // Restart the agent
  RETRY: 'retry',               // Retry the task
  DELEGATE: 'delegate',         // Delegate to another agent
  SKIP: 'skip',                 // Skip the task and continue
  FALLBACK: 'fallback',         // Use fallback implementation
  MANUAL_INTERVENTION: 'manual' // Require manual intervention
};

class AgentRecoveryService {
  constructor() {
    this.messageBus = null;
    this.errorHandlingService = null;
    this.recoveryStrategies = new Map();
    this.recoveryHistory = new Map();
    this.deadLetterQueue = new Map();
    this.recoveryInProgress = new Set();
    this.maxRecoveryAttempts = 3;
    this.delegationMappings = new Map();
  }

  async init() {
    try {
      // Connect to message bus
      this.messageBus = await getMessageBus();
      
      // Get error handling service
      this.errorHandlingService = await getErrorHandlingService();
      
      // Subscribe to agent failure events
      await this.messageBus.subscribeToEvent('agent.failed', this.handleAgentFailure.bind(this));
      await this.messageBus.subscribeToEvent('agent.task-failed', this.handleTaskFailure.bind(this));
      await this.messageBus.subscribeToEvent('agent.recovery-completed', this.handleRecoveryCompleted.bind(this));
      await this.messageBus.subscribeToEvent('agent.recovery-failed', this.handleRecoveryFailed.bind(this));
      
      // Initialize default recovery strategies
      this._initializeDefaultRecoveryStrategies();
      
      // Initialize delegation mappings
      this._initializeDelegationMappings();
      
      logger.info('Agent Recovery Service initialized');
      return this;
    } catch (error) {
      logger.error('Failed to initialize agent recovery service', error);
      throw error;
    }
  }

  /**
   * Register a recovery strategy for an agent or module
   * @param {string} agentId - Agent ID
   * @param {string} moduleId - Module ID (optional, for module-specific strategies)
   * @param {string} errorType - Error type to handle
   * @param {string} strategy - Recovery strategy to apply
   * @param {Object} config - Strategy-specific configuration
   */
  registerRecoveryStrategy(agentId, moduleId, errorType, strategy, config = {}) {
    const key = moduleId ? `${agentId}:${moduleId}:${errorType}` : `${agentId}:${errorType}`;
    
    this.recoveryStrategies.set(key, {
      strategy,
      config
    });
    
    logger.info(`Registered recovery strategy for ${key}: ${strategy}`);
  }

  /**
   * Handle agent failure event
   * @param {Object} data - Event data
   * @param {Object} metadata - Event metadata
   */
  async handleAgentFailure(data, metadata) {
    const { agentId, error, category, moduleId } = data;
    
    try {
      logger.info(`Handling agent failure for ${agentId}${moduleId ? `:${moduleId}` : ''}`, {
        error,
        category
      });
      
      // Check if recovery is already in progress
      if (this.recoveryInProgress.has(agentId)) {
        logger.info(`Recovery already in progress for agent ${agentId}`);
        return;
      }
      
      // Mark recovery as in progress
      this.recoveryInProgress.add(agentId);
      
      // Get recovery history for this agent
      const history = this.recoveryHistory.get(agentId) || [];
      const attempts = history.filter(h => 
        h.timestamp > Date.now() - 3600000 && // Within the last hour
        h.category === category
      ).length;
      
      // Check if max attempts exceeded
      if (attempts >= this.maxRecoveryAttempts) {
        logger.warn(`Max recovery attempts exceeded for agent ${agentId}`);
        
        // Add to dead letter queue
        this._addToDeadLetterQueue(agentId, moduleId, error, category, data);
        
        // Publish recovery failed event
        await this.messageBus.publishEvent('agent.recovery-failed', {
          agentId,
          moduleId,
          error,
          category,
          reason: 'MAX_ATTEMPTS_EXCEEDED',
          timestamp: new Date().toISOString()
        });
        
        // Remove from in-progress
        this.recoveryInProgress.delete(agentId);
        return;
      }
      
      // Determine recovery strategy
      const strategyKey = moduleId 
        ? `${agentId}:${moduleId}:${category}` 
        : `${agentId}:${category}`;
      
      let strategyConfig = this.recoveryStrategies.get(strategyKey);
      
      // If no specific strategy, try agent-level strategy
      if (!strategyConfig && moduleId) {
        strategyConfig = this.recoveryStrategies.get(`${agentId}:${category}`);
      }
      
      // If still no strategy, try error category strategy
      if (!strategyConfig) {
        strategyConfig = this.recoveryStrategies.get(category);
      }
      
      // If still no strategy, use default
      if (!strategyConfig) {
        strategyConfig = {
          strategy: RecoveryStrategy.RESTART,
          config: {}
        };
      }
      
      // Apply recovery strategy
      await this._applyRecoveryStrategy(agentId, moduleId, error, category, strategyConfig, data);
      
      // Add to recovery history
      history.push({
        timestamp: Date.now(),
        strategy: strategyConfig.strategy,
        error,
        category,
        moduleId
      });
      
      this.recoveryHistory.set(agentId, history);
      
    } catch (error) {
      logger.error(`Failed to handle agent failure for ${agentId}`, error);
      
      // Remove from in-progress
      this.recoveryInProgress.delete(agentId);
      
      // Publish recovery failed event
      await this.messageBus.publishEvent('agent.recovery-failed', {
        agentId,
        moduleId,
        error: error.message,
        category: 'internal',
        reason: 'RECOVERY_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle task failure event
   * @param {Object} data - Event data
   * @param {Object} metadata - Event metadata
   */
  async handleTaskFailure(data, metadata) {
    const { agentId, taskId, workflowId, error, category } = data;
    
    try {
      logger.info(`Handling task failure for ${agentId} (Task: ${taskId}, Workflow: ${workflowId})`, {
        error,
        category
      });
      
      // Check if this is a critical task for workflow
      const isCritical = workflowId ? true : false;
      
      // Determine if we should retry
      const shouldRetry = await this._shouldRetryTask(agentId, taskId, error, category);
      
      if (shouldRetry) {
        // Get retry count
        const retryKey = `${agentId}:${taskId}`;
        const retries = this.recoveryHistory.get(retryKey) || [];
        const attemptCount = retries.length + 1;
        
        // Retry the task with backoff
        const delay = Math.min(
          30000, // 30 seconds max
          1000 * Math.pow(2, attemptCount - 1) // Exponential backoff
        );
        
        logger.info(`Scheduling task retry ${attemptCount} after ${delay}ms for ${taskId}`);
        
        // Record retry attempt
        retries.push({
          timestamp: Date.now(),
          error,
          category,
          attemptCount
        });
        
        this.recoveryHistory.set(retryKey, retries);
        
        // Schedule retry
        setTimeout(async () => {
          await this._retryTask(agentId, taskId, data);
        }, delay);
        
      } else if (isCritical) {
        // Critical task that can't be retried - mark workflow as failed
        if (workflowId) {
          logger.warn(`Critical task ${taskId} failed and cannot be retried, failing workflow ${workflowId}`);
          
          // Publish workflow failed event
          await this.messageBus.publishEvent('workflow.failed', {
            workflowId,
            error,
            stage: taskId,
            agentId,
            timestamp: new Date().toISOString()
          });
        }
        
        // Add to dead letter queue
        this._addToDeadLetterQueue(agentId, null, error, category, data);
        
      } else {
        // Non-critical task that can't be retried
        logger.info(`Non-critical task ${taskId} failed and will not be retried`);
        
        // Add to dead letter queue
        this._addToDeadLetterQueue(agentId, null, error, category, data);
      }
      
    } catch (error) {
      logger.error(`Failed to handle task failure for ${agentId}, task ${taskId}`, error);
    }
  }

  /**
   * Handle recovery completed event
   * @param {Object} data - Event data
   * @param {Object} metadata - Event metadata
   */
  async handleRecoveryCompleted(data, metadata) {
    const { agentId } = data;
    
    // Remove from in-progress
    this.recoveryInProgress.delete(agentId);
    
    logger.info(`Recovery completed for agent ${agentId}`);
  }

  /**
   * Handle recovery failed event
   * @param {Object} data - Event data
   * @param {Object} metadata - Event metadata
   */
  async handleRecoveryFailed(data, metadata) {
    const { agentId, reason } = data;
    
    // Remove from in-progress
    this.recoveryInProgress.delete(agentId);
    
    logger.error(`Recovery failed for agent ${agentId}: ${reason}`);
  }

  /**
   * Get recovery history for an agent
   * @param {string} agentId - Agent ID
   * @returns {Array} - Recovery history
   */
  getRecoveryHistory(agentId) {
    return this.recoveryHistory.get(agentId) || [];
  }

  /**
   * Get dead letter queue entries
   * @param {string} agentId - Agent ID (optional, for filtering by agent)
   * @returns {Array} - Dead letter queue entries
   */
  getDeadLetterQueueEntries(agentId = null) {
    if (agentId) {
      const entries = [];
      
      for (const [key, entry] of this.deadLetterQueue.entries()) {
        if (entry.agentId === agentId) {
          entries.push({ key, ...entry });
        }
      }
      
      return entries;
    }
    
    return Array.from(this.deadLetterQueue.entries()).map(([key, entry]) => ({ key, ...entry }));
  }

  /**
   * Retry a dead letter queue entry
   * @param {string} key - Dead letter queue entry key
   * @returns {boolean} - Success status
   */
  async retryDeadLetterQueueEntry(key) {
    try {
      // Get entry
      const entry = this.deadLetterQueue.get(key);
      
      if (!entry) {
        logger.warn(`Dead letter queue entry ${key} not found`);
        return false;
      }
      
      logger.info(`Retrying dead letter queue entry ${key}`);
      
      // Apply appropriate retry based on entry type
      if (entry.type === 'task') {
        await this._retryTask(entry.agentId, entry.taskId, entry.data);
      } else {
        await this._applyRecoveryStrategy(
          entry.agentId, 
          entry.moduleId, 
          entry.error, 
          entry.category, 
          { strategy: RecoveryStrategy.RESTART }, 
          entry.data
        );
      }
      
      // Remove from dead letter queue
      this.deadLetterQueue.delete(key);
      
      return true;
    } catch (error) {
      logger.error(`Failed to retry dead letter queue entry ${key}`, error);
      return false;
    }
  }

  /**
   * Delete a dead letter queue entry
   * @param {string} key - Dead letter queue entry key
   * @returns {boolean} - Success status
   */
  deleteDeadLetterQueueEntry(key) {
    try {
      // Get entry
      const entry = this.deadLetterQueue.get(key);
      
      if (!entry) {
        logger.warn(`Dead letter queue entry ${key} not found`);
        return false;
      }
      
      logger.info(`Deleting dead letter queue entry ${key}`);
      
      // Remove from dead letter queue
      this.deadLetterQueue.delete(key);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete dead letter queue entry ${key}`, error);
      return false;
    }
  }

  /**
   * Initialize default recovery strategies
   * @private
   */
  _initializeDefaultRecoveryStrategies() {
    // Default strategy for general agent failures
    this.recoveryStrategies.set('agent', {
      strategy: RecoveryStrategy.RESTART,
      config: {}
    });
    
    // Specialized strategies for different error categories
    this.recoveryStrategies.set('timeout', {
      strategy: RecoveryStrategy.RETRY,
      config: {
        maxRetries: 3,
        backoffFactor: 2
      }
    });
    
    this.recoveryStrategies.set('rate_limit', {
      strategy: RecoveryStrategy.RETRY,
      config: {
        maxRetries: 5,
        backoffFactor: 3,
        initialDelay: 5000 // 5 seconds
      }
    });
    
    this.recoveryStrategies.set('external_service', {
      strategy: RecoveryStrategy.FALLBACK,
      config: {
        fallbackMethod: 'alternateProvider'
      }
    });
  }

  /**
   * Initialize delegation mappings for agents
   * @private
   */
  _initializeDelegationMappings() {
    // Map agents to potential delegates for failover
    this.delegationMappings.set('content_creation', ['content_strategy', 'brand_consistency']);
    this.delegationMappings.set('content_strategy', ['content_creation']);
    this.delegationMappings.set('optimisation', ['content_management']);
    this.delegationMappings.set('brand_consistency', ['content_creation']);
    this.delegationMappings.set('content_management', ['content_creation']);
  }

  /**
   * Apply recovery strategy
   * @private
   */
  async _applyRecoveryStrategy(agentId, moduleId, error, category, strategyConfig, data) {
    const { strategy, config } = strategyConfig;
    
    logger.info(`Applying recovery strategy for ${agentId}: ${strategy}`);
    
    switch (strategy) {
      case RecoveryStrategy.RESTART:
        await this._restartAgent(agentId, moduleId);
        break;
        
      case RecoveryStrategy.RETRY:
        await this._retryAgentOperation(agentId, moduleId, data);
        break;
        
      case RecoveryStrategy.DELEGATE:
        await this._delegateToAlternativeAgent(agentId, category, data);
        break;
        
      case RecoveryStrategy.SKIP:
        await this._skipFailedOperation(agentId, data);
        break;
        
      case RecoveryStrategy.FALLBACK:
        await this._useFallbackImplementation(agentId, config.fallbackMethod, data);
        break;
        
      case RecoveryStrategy.MANUAL_INTERVENTION:
        await this._requestManualIntervention(agentId, moduleId, error, category, data);
        break;
        
      default:
        logger.warn(`Unknown recovery strategy: ${strategy}`);
        await this._restartAgent(agentId, moduleId);
        break;
    }
  }

  /**
   * Restart agent or module
   * @private
   */
  async _restartAgent(agentId, moduleId) {
    try {
      if (moduleId) {
        logger.info(`Restarting module ${moduleId} for agent ${agentId}`);
        
        // Send restart module command
        await this.messageBus.publishCommand(`${agentId}.restart-module`, {
          moduleId,
          timestamp: new Date().toISOString()
        });
      } else {
        logger.info(`Restarting agent ${agentId}`);
        
        // Send restart agent command
        await this.messageBus.publishCommand(`${agentId}.restart`, {
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error(`Failed to restart agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Retry agent operation
   * @private
   */
  async _retryAgentOperation(agentId, moduleId, data) {
    try {
      logger.info(`Retrying operation for agent ${agentId}`);
      
      // Extract original command if available
      const originalCommand = data.commandId || data.command;
      
      if (originalCommand) {
        // Resend the original command
        await this.messageBus.publishCommand(`${agentId}.${originalCommand}`, {
          ...data,
          isRetry: true,
          retryTimestamp: new Date().toISOString()
        });
      } else {
        // No specific command to retry, just restart
        await this._restartAgent(agentId, moduleId);
      }
    } catch (error) {
      logger.error(`Failed to retry operation for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Delegate to alternative agent
   * @private
   */
  async _delegateToAlternativeAgent(agentId, category, data) {
    try {
      // Get delegation mapping
      const delegates = this.delegationMappings.get(agentId);
      
      if (!delegates || delegates.length === 0) {
        logger.warn(`No delegation mapping found for agent ${agentId}`);
        throw new Error(`No delegation mapping found for agent ${agentId}`);
      }
      
      // Select delegate - for now, just take the first one
      const delegateAgentId = delegates[0];
      
      logger.info(`Delegating operation from ${agentId} to ${delegateAgentId}`);
      
      // Create delegation command
      await this.messageBus.publishCommand(`${delegateAgentId}.handle-delegation`, {
        originalAgentId: agentId,
        data,
        delegationReason: category,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Failed to delegate operation for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Skip failed operation
   * @private
   */
  async _skipFailedOperation(agentId, data) {
    try {
      logger.info(`Skipping failed operation for agent ${agentId}`);
      
      // If it's a workflow task, transition to next state
      if (data.workflowId) {
        // Publish workflow state change event
        await this.messageBus.publishEvent('workflow.state-changed', {
          workflowId: data.workflowId,
          fromState: data.taskType || 'unknown',
          toState: 'skip_recovery',
          transitionType: 'skip',
          timestamp: new Date().toISOString()
        });
      }
      
      // Publish recovery completed event
      await this.messageBus.publishEvent('agent.recovery-completed', {
        agentId,
        strategy: RecoveryStrategy.SKIP,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Failed to skip operation for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Use fallback implementation
   * @private
   */
  async _useFallbackImplementation(agentId, fallbackMethod, data) {
    try {
      logger.info(`Using fallback implementation for agent ${agentId}: ${fallbackMethod}`);
      
      // Send command to use fallback implementation
      await this.messageBus.publishCommand(`${agentId}.use-fallback`, {
        fallbackMethod,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Failed to use fallback implementation for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Request manual intervention
   * @private
   */
  async _requestManualIntervention(agentId, moduleId, error, category, data) {
    try {
      logger.info(`Requesting manual intervention for agent ${agentId}`);
      
      // Add to dead letter queue
      const key = this._addToDeadLetterQueue(agentId, moduleId, error, category, data);
      
      // Publish notification event
      await this.messageBus.publishEvent('system.notification', {
        type: 'agent_failure',
        level: 'critical',
        message: `Agent ${agentId} requires manual intervention`,
        details: {
          agentId,
          moduleId,
          error,
          category,
          deadLetterQueueKey: key,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error(`Failed to request manual intervention for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Retry a specific task
   * @private
   */
  async _retryTask(agentId, taskId, data) {
    try {
      logger.info(`Retrying task ${taskId} for agent ${agentId}`);
      
      // Create command for retrying the task
      const command = `${agentId}.retry-task`;
      
      // Publish command
      await this.messageBus.publishCommand(command, {
        taskId,
        originalData: data,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to retry task ${taskId} for agent ${agentId}`, error);
      return false;
    }
  }

  /**
   * Determine if a task should be retried
   * @private
   */
  async _shouldRetryTask(agentId, taskId, error, category) {
    // Get retry count
    const retryKey = `${agentId}:${taskId}`;
    const retries = this.recoveryHistory.get(retryKey) || [];
    
    // Check retry count
    if (retries.length >= 3) {
      logger.info(`Max retries exceeded for task ${taskId}`);
      return false;
    }
    
    // Check if error category is retryable
    const retryableCategories = [
      'timeout', 
      'rate_limit', 
      'external_service', 
      'database'
    ];
    
    if (!retryableCategories.includes(category)) {
      logger.info(`Error category ${category} is not retryable`);
      return false;
    }
    
    return true;
  }

  /**
   * Add an entry to the dead letter queue
   * @private
   */
  _addToDeadLetterQueue(agentId, moduleId, error, category, data) {
    const key = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    
    const entry = {
      key,
      agentId,
      moduleId,
      error,
      category,
      data,
      timestamp: new Date(),
      type: data.taskId ? 'task' : 'agent',
      taskId: data.taskId,
      workflowId: data.workflowId
    };
    
    this.deadLetterQueue.set(key, entry);
    
    logger.info(`Added entry to dead letter queue: ${key} (${agentId})`);
    
    return key;
  }
}

// Singleton instance
let agentRecoveryServiceInstance = null;

module.exports = {
  RecoveryStrategy,
  getInstance: async () => {
    if (!agentRecoveryServiceInstance) {
      agentRecoveryServiceInstance = new AgentRecoveryService();
      await agentRecoveryServiceInstance.init();
    }
    return agentRecoveryServiceInstance;
  }
};