/**
 * Base Agent class for all AI agents in the Landing Pad Digital system
 * 
 * This class provides the core functionality for all agents, including:
 * - Command handling
 * - Event publishing
 * - Module management
 * - Lifecycle management
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../services/LoggerService');

class BaseAgent extends EventEmitter {
  /**
   * Create a new agent
   * @param {Object} config - Agent configuration
   * @param {Object} services - Service dependencies
   */
  constructor(config, services) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.modules = new Map();
    this.services = services;
    this.status = 'initializing';
    this.commands = new Map();
    this.logger = logger.createLogger(`agent:${this.id}`);
  }

  /**
   * Initialize the agent and its modules
   */
  async initialize() {
    try {
      this.logger.info(`Initializing agent: ${this.name}`);
      
      // Initialize all modules
      for (const [moduleName, moduleConfig] of Object.entries(this.config.modules)) {
        if (moduleConfig.enabled) {
          try {
            await this._initializeModule(moduleName, moduleConfig);
          } catch (moduleError) {
            this.logger.error(`Failed to initialize module ${moduleName}: ${moduleError.message}`, moduleError);
            
            // Publish module initialization failure event
            await this._publishFailureEvent('module_init_failure', moduleError, moduleName);
            
            // Check if module is required
            if (moduleConfig.required) {
              throw moduleError; // Re-throw if module is required
            } else {
              this.logger.warn(`Continuing initialization without non-critical module: ${moduleName}`);
            }
          }
        }
      }
      
      // Set up command handlers
      this._registerCommands();
      
      // Set up messaging
      await this._setupMessaging();
      
      // Set up error recovery command handlers
      await this._setupRecoveryHandlers();
      
      this.status = 'initialized';
      this.logger.info(`Agent initialized: ${this.name}`);
      
      // Send initial heartbeat
      await this._sendHeartbeat();
      
      // Start heartbeat interval
      this._startHeartbeatInterval();
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to initialize agent: ${error.message}`, error);
      
      // Publish agent initialization failure event
      await this._publishFailureEvent('agent_init_failure', error);
      
      throw error;
    }
  }

  /**
   * Start the agent
   */
  async start() {
    try {
      this.logger.info(`Starting agent: ${this.name}`);
      
      // Start all modules
      for (const [moduleName, module] of this.modules.entries()) {
        try {
          await module.start();
          this.logger.info(`Started module: ${moduleName}`);
        } catch (moduleError) {
          this.logger.error(`Failed to start module ${moduleName}: ${moduleError.message}`, moduleError);
          
          // Publish module start failure event
          await this._publishFailureEvent('module_start_failure', moduleError, moduleName);
          
          // Check if module is required for operation
          const moduleConfig = this.config.modules[moduleName];
          if (moduleConfig?.required) {
            throw moduleError; // Re-throw if module is required
          } else {
            this.logger.warn(`Continuing startup without non-critical module: ${moduleName}`);
          }
        }
      }
      
      // Start listening for commands
      await this._startCommandListener();
      
      // Update status and publish status change event
      this.status = 'running';
      await this._publishStatusChange('running');
      
      this.logger.info(`Agent started: ${this.name}`);
      
      return true;
    } catch (error) {
      // Update status and publish status change event
      this.status = 'error';
      await this._publishStatusChange('error', error.message);
      
      this.logger.error(`Failed to start agent: ${error.message}`, error);
      
      // Publish agent start failure event
      await this._publishFailureEvent('agent_start_failure', error);
      
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop() {
    try {
      this.logger.info(`Stopping agent: ${this.name}`);
      
      // Stop heartbeat interval
      this._stopHeartbeatInterval();
      
      // Stop all modules
      const moduleStopPromises = [];
      for (const [moduleName, module] of this.modules.entries()) {
        try {
          // Wrap in try/catch to prevent one module failure from blocking others
          const stopPromise = module.stop()
            .then(() => {
              this.logger.info(`Stopped module: ${moduleName}`);
              return { moduleName, success: true };
            })
            .catch(error => {
              this.logger.error(`Failed to stop module ${moduleName}: ${error.message}`, error);
              return { moduleName, success: false, error };
            });
          
          moduleStopPromises.push(stopPromise);
        } catch (error) {
          this.logger.error(`Error preparing to stop module ${moduleName}: ${error.message}`, error);
        }
      }
      
      // Wait for all modules to stop, but don't fail if some don't stop properly
      const moduleResults = await Promise.all(moduleStopPromises);
      const failedModules = moduleResults.filter(result => !result.success);
      
      if (failedModules.length > 0) {
        this.logger.warn(`Some modules failed to stop properly: ${failedModules.map(m => m.moduleName).join(', ')}`);
      }
      
      // Stop listening for commands
      await this._stopCommandListener();
      
      // Update status and publish status change event
      this.status = 'stopped';
      await this._publishStatusChange('stopped');
      
      this.logger.info(`Agent stopped: ${this.name}`);
      
      return true;
    } catch (error) {
      // Update status
      this.status = 'error';
      await this._publishStatusChange('error', error.message);
      
      this.logger.error(`Failed to stop agent: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Handle a command
   * @param {Object} command - Command to handle
   * @returns {Promise<Object>} - Command result
   */
  async handleCommand(command) {
    const startTime = Date.now();
    const { id, type, payload } = command;
    let commandMetrics = { type, startTime };
    
    try {
      this.logger.info(`Handling command: ${type} (${id})`);
      
      // Check if command handler exists
      if (!this.commands.has(type)) {
        throw new Error(`Unknown command type: ${type}`);
      }
      
      // Check agent status
      if (this.status === 'error' && !type.startsWith('restart') && !type.startsWith('recover')) {
        throw new Error(`Agent is in error state and cannot process command: ${type}`);
      }
      
      if (this.status === 'stopped' && !type.startsWith('start') && !type.startsWith('restart')) {
        throw new Error(`Agent is stopped and cannot process command: ${type}`);
      }
      
      // Execute command handler with timeout if specified
      const handler = this.commands.get(type);
      
      // Check if command has timeout specified
      const timeout = payload?.timeout || this.config.commandTimeout || 60000; // Default 60s timeout
      
      // Create a promise that will resolve with the handler result or reject after timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Command timed out after ${timeout}ms: ${type}`));
        }, timeout);
      });
      
      // Race between handler execution and timeout
      const result = await Promise.race([
        handler(payload),
        timeoutPromise
      ]);
      
      // Calculate command duration
      const duration = Date.now() - startTime;
      commandMetrics.duration = duration;
      commandMetrics.success = true;
      
      this.logger.info(`Command completed: ${type} (${id}) in ${duration}ms`);
      
      // Record command metrics
      await this._recordCommandMetrics(commandMetrics);
      
      // Send heartbeat after command execution
      await this._sendHeartbeat();
      
      return {
        id,
        success: true,
        result,
        duration
      };
    } catch (error) {
      // Calculate command duration
      const duration = Date.now() - startTime;
      commandMetrics.duration = duration;
      commandMetrics.success = false;
      commandMetrics.error = error.message;
      
      this.logger.error(`Command failed: ${type} (${id}) after ${duration}ms: ${error.message}`, error);
      
      // Publish command failure event
      await this._publishCommandFailure(type, id, error, payload);
      
      // Record command metrics
      await this._recordCommandMetrics(commandMetrics);
      
      // Send heartbeat after failed command
      await this._sendHeartbeat();
      
      return {
        id: command.id,
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Publish an event
   * @param {string} type - Event type
   * @param {Object} payload - Event payload
   */
  async publishEvent(type, payload) {
    try {
      const event = {
        id: uuidv4(),
        type,
        source: this.id,
        timestamp: new Date().toISOString(),
        payload
      };
      
      this.logger.info(`Publishing event: ${type}`);
      
      // Emit locally
      this.emit(type, event);
      
      // Publish to message bus
      await this.services.messaging.publishEvent(this.id, type, event);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get agent status
   * @returns {Object} - Agent status
   */
  getStatus() {
    const moduleStatus = {};
    
    for (const [moduleName, module] of this.modules.entries()) {
      moduleStatus[moduleName] = module.getStatus();
    }
    
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      modules: moduleStatus,
      uptime: process.uptime()
    };
  }

  /**
   * Initialize a module
   * @private
   * @param {string} moduleName - Module name
   * @param {Object} moduleConfig - Module configuration
   */
  async _initializeModule(moduleName, moduleConfig) {
    try {
      // Convert module name from camelCase to kebab-case for file path
      const moduleFileName = moduleName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      
      // Dynamically import module
      const ModuleClass = require(`../agents/${this.id}/modules/${moduleFileName}`);
      
      // Create module instance
      const module = new ModuleClass(moduleConfig, this.services);
      
      // Initialize module
      await module.initialize();
      
      // Add to modules map
      this.modules.set(moduleName, module);
      
      this.logger.info(`Initialized module: ${moduleName}`);
      
      return module;
    } catch (error) {
      this.logger.error(`Failed to initialize module ${moduleName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Register command handlers
   * @private
   */
  _registerCommands() {
    // To be implemented by each agent subclass
    throw new Error('_registerCommands must be implemented by subclass');
  }

  /**
   * Set up messaging for the agent
   * @private
   */
  async _setupMessaging() {
    try {
      // Set up event subscriptions based on configuration
      const subscriptions = this.services.config.messaging.subscriptions[this.id] || [];
      
      for (const subscription of subscriptions) {
        const { event, description } = subscription;
        
        this.logger.info(`Subscribing to event: ${event} (${description})`);
        
        await this.services.messaging.subscribe(event, async (message) => {
          this.logger.info(`Received event: ${event}`);
          await this._handleEvent(event, message);
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set up messaging: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Start listening for commands
   * @private
   */
  async _startCommandListener() {
    try {
      const queueName = `${this.id}-commands`;
      
      this.logger.info(`Starting command listener on queue: ${queueName}`);
      
      await this.services.messaging.consumeCommands(queueName, async (command) => {
        return await this.handleCommand(command);
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to start command listener: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Stop listening for commands
   * @private
   */
  async _stopCommandListener() {
    try {
      const queueName = `${this.id}-commands`;
      
      this.logger.info(`Stopping command listener on queue: ${queueName}`);
      
      await this.services.messaging.stopConsuming(queueName);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop command listener: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Handle an incoming event
   * @private
   * @param {string} eventType - Event type
   * @param {Object} event - Event data
   */
  async _handleEvent(eventType, event) {
    // To be implemented by each agent subclass
    throw new Error('_handleEvent must be implemented by subclass');
  }

  /**
   * Set up error recovery command handlers
   * @private
   */
  async _setupRecoveryHandlers() {
    // Register recovery command handlers
    this.commands.set('restart', this._handleRestartCommand.bind(this));
    this.commands.set('restart-module', this._handleRestartModuleCommand.bind(this));
    this.commands.set('recover', this._handleRecoverCommand.bind(this));
    this.commands.set('retry-task', this._handleRetryTaskCommand.bind(this));
    this.commands.set('use-fallback', this._handleUseFallbackCommand.bind(this));
    
    this.logger.info('Registered recovery command handlers');
  }

  /**
   * Handle agent restart command
   * @private
   */
  async _handleRestartCommand(payload) {
    this.logger.info('Handling restart command');
    
    try {
      // Stop the agent
      await this.stop();
      
      // Start the agent
      await this.start();
      
      // Publish recovery completed event
      await this._publishRecoveryCompleted('restart');
      
      return {
        success: true,
        message: `Agent ${this.id} restarted successfully`
      };
    } catch (error) {
      this.logger.error(`Failed to restart agent: ${error.message}`, error);
      
      // Publish recovery failed event
      await this._publishRecoveryFailed('restart', error);
      
      throw error;
    }
  }

  /**
   * Handle module restart command
   * @private
   */
  async _handleRestartModuleCommand(payload) {
    const { moduleId } = payload;
    
    if (!moduleId) {
      throw new Error('Module ID is required for restart-module command');
    }
    
    this.logger.info(`Handling restart-module command for ${moduleId}`);
    
    try {
      // Get module
      const module = this.modules.get(moduleId);
      
      if (!module) {
        throw new Error(`Module not found: ${moduleId}`);
      }
      
      // Stop module
      await module.stop();
      
      // Start module
      await module.start();
      
      // Publish recovery completed event
      await this._publishRecoveryCompleted('module_restart', { moduleId });
      
      return {
        success: true,
        message: `Module ${moduleId} restarted successfully`
      };
    } catch (error) {
      this.logger.error(`Failed to restart module ${moduleId}: ${error.message}`, error);
      
      // Publish recovery failed event
      await this._publishRecoveryFailed('module_restart', error, { moduleId });
      
      throw error;
    }
  }

  /**
   * Handle agent recover command
   * @private
   */
  async _handleRecoverCommand(payload) {
    const { reason } = payload;
    
    this.logger.info(`Handling recover command (reason: ${reason || 'unknown'})`);
    
    try {
      // Check current status
      if (this.status === 'running') {
        this.logger.info('Agent is already running, no recovery needed');
        return {
          success: true,
          message: 'Agent is already running, no recovery needed'
        };
      }
      
      // If agent is in error state, attempt to restart
      if (this.status === 'error' || this.status === 'unresponsive') {
        // Attempt to restart the agent
        return await this._handleRestartCommand(payload);
      }
      
      // If agent is stopped, attempt to start
      if (this.status === 'stopped') {
        try {
          await this.start();
          
          // Publish recovery completed event
          await this._publishRecoveryCompleted('recover_from_stopped');
          
          return {
            success: true,
            message: `Agent ${this.id} recovered successfully from stopped state`
          };
        } catch (error) {
          this.logger.error(`Failed to recover agent from stopped state: ${error.message}`, error);
          
          // Publish recovery failed event
          await this._publishRecoveryFailed('recover_from_stopped', error);
          
          throw error;
        }
      }
      
      // If agent is in any other state, record recovery attempt but take no action
      this.logger.warn(`Cannot recover agent from current state: ${this.status}`);
      
      // Publish recovery failed event
      await this._publishRecoveryFailed(
        'recover_invalid_state', 
        new Error(`Cannot recover from ${this.status} state`),
        { currentState: this.status }
      );
      
      return {
        success: false,
        message: `Cannot recover agent from ${this.status} state`
      };
    } catch (error) {
      this.logger.error(`Failed to recover agent: ${error.message}`, error);
      
      // Publish recovery failed event
      await this._publishRecoveryFailed('recover', error);
      
      throw error;
    }
  }

  /**
   * Handle retry task command
   * @private
   */
  async _handleRetryTaskCommand(payload) {
    const { taskId, originalData } = payload;
    
    if (!taskId || !originalData) {
      throw new Error('Task ID and original data are required for retry-task command');
    }
    
    this.logger.info(`Handling retry-task command for task ${taskId}`);
    
    try {
      // Extract task type from original data
      const taskType = originalData.taskType || originalData.type;
      
      if (!taskType) {
        throw new Error('Task type not found in original data');
      }
      
      // Check if task handler exists
      const taskHandlerName = `_handle${this._pascalCase(taskType)}Task`;
      
      if (typeof this[taskHandlerName] !== 'function') {
        throw new Error(`Task handler not found for ${taskType}`);
      }
      
      // Add retry flag to data
      const retryData = {
        ...originalData,
        isRetry: true,
        retryTimestamp: new Date().toISOString(),
        retryTaskId: taskId
      };
      
      // Execute task handler
      const result = await this[taskHandlerName](retryData);
      
      // Publish task completed event
      await this.messageBus.publishEvent('agent.task-completed', {
        agentId: this.id,
        taskId: `${taskId}-retry-${Date.now()}`,
        originalTaskId: taskId,
        workflowId: originalData.workflowId,
        result,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        message: `Task ${taskId} retried successfully`,
        result
      };
    } catch (error) {
      this.logger.error(`Failed to retry task ${taskId}: ${error.message}`, error);
      
      // Publish task failed event
      await this.messageBus.publishEvent('agent.task-failed', {
        agentId: this.id,
        taskId: `${taskId}-retry-${Date.now()}`,
        originalTaskId: taskId,
        workflowId: originalData.workflowId,
        error: error.message,
        category: error.category || 'task_retry_failure',
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Handle use fallback command
   * @private
   */
  async _handleUseFallbackCommand(payload) {
    const { fallbackMethod, data } = payload;
    
    if (!fallbackMethod) {
      throw new Error('Fallback method is required for use-fallback command');
    }
    
    this.logger.info(`Handling use-fallback command with method ${fallbackMethod}`);
    
    try {
      // Check if fallback method exists
      const fallbackMethodName = `_fallback${this._pascalCase(fallbackMethod)}`;
      
      if (typeof this[fallbackMethodName] !== 'function') {
        throw new Error(`Fallback method not found: ${fallbackMethod}`);
      }
      
      // Execute fallback method
      const result = await this[fallbackMethodName](data);
      
      // Publish recovery completed event
      await this._publishRecoveryCompleted('fallback_used', { 
        fallbackMethod,
        taskId: data.taskId,
        workflowId: data.workflowId
      });
      
      return {
        success: true,
        message: `Fallback method ${fallbackMethod} executed successfully`,
        result
      };
    } catch (error) {
      this.logger.error(`Failed to execute fallback method ${fallbackMethod}: ${error.message}`, error);
      
      // Publish recovery failed event
      await this._publishRecoveryFailed('fallback_failed', error, { fallbackMethod });
      
      throw error;
    }
  }

  /**
   * Start heartbeat interval
   * @private
   */
  _startHeartbeatInterval() {
    // Cancel existing interval if any
    this._stopHeartbeatInterval();
    
    // Default heartbeat interval: 30 seconds
    const interval = this.config.heartbeatInterval || 30000;
    
    this.heartbeatIntervalId = setInterval(() => {
      this._sendHeartbeat().catch(error => {
        this.logger.error(`Failed to send heartbeat: ${error.message}`, error);
      });
    }, interval);
    
    this.logger.debug(`Started heartbeat interval (${interval}ms)`);
  }

  /**
   * Stop heartbeat interval
   * @private
   */
  _stopHeartbeatInterval() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
      this.logger.debug('Stopped heartbeat interval');
    }
  }

  /**
   * Send agent heartbeat
   * @private
   */
  async _sendHeartbeat() {
    try {
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        modules: {}
      };
      
      // Collect metrics from modules
      for (const [moduleName, module] of this.modules.entries()) {
        if (typeof module.getMetrics === 'function') {
          try {
            metrics.modules[moduleName] = await module.getMetrics();
          } catch (error) {
            this.logger.debug(`Failed to get metrics from module ${moduleName}: ${error.message}`);
            metrics.modules[moduleName] = { error: error.message };
          }
        }
      }
      
      // Publish heartbeat event
      await this.messageBus.publishEvent('agent.heartbeat', {
        agentId: this.id,
        status: this.status,
        metrics,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send heartbeat: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Publish status change event
   * @private
   */
  async _publishStatusChange(status, reason = null) {
    try {
      await this.messageBus.publishEvent('agent.status-changed', {
        agentId: this.id,
        status,
        reason,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish status change event: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Publish agent failure event
   * @private
   */
  async _publishFailureEvent(category, error, moduleId = null) {
    try {
      await this.messageBus.publishEvent('agent.failed', {
        agentId: this.id,
        moduleId,
        error: error.message,
        stack: error.stack,
        category,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (publishError) {
      this.logger.error(`Failed to publish failure event: ${publishError.message}`, publishError);
      return false;
    }
  }

  /**
   * Publish command failure event
   * @private
   */
  async _publishCommandFailure(commandType, commandId, error, payload) {
    try {
      await this.messageBus.publishEvent('agent.command-failed', {
        agentId: this.id,
        commandType,
        commandId,
        error: error.message,
        category: error.category || 'command_failure',
        payload,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (publishError) {
      this.logger.error(`Failed to publish command failure event: ${publishError.message}`, publishError);
      return false;
    }
  }

  /**
   * Publish recovery completed event
   * @private
   */
  async _publishRecoveryCompleted(strategy, details = {}) {
    try {
      await this.messageBus.publishEvent('agent.recovery-completed', {
        agentId: this.id,
        strategy,
        details,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to publish recovery completed event: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Publish recovery failed event
   * @private
   */
  async _publishRecoveryFailed(strategy, error, details = {}) {
    try {
      await this.messageBus.publishEvent('agent.recovery-failed', {
        agentId: this.id,
        strategy,
        error: error.message,
        details,
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (publishError) {
      this.logger.error(`Failed to publish recovery failed event: ${publishError.message}`, publishError);
      return false;
    }
  }

  /**
   * Record command metrics
   * @private
   */
  async _recordCommandMetrics(metrics) {
    try {
      // Send metrics to monitoring system
      if (this.services.monitoring) {
        await this.services.monitoring.recordAgentCommand({
          agentId: this.id,
          ...metrics
        });
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to record command metrics: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Convert string to pascal case (for handler method naming)
   * @private
   */
  _pascalCase(str) {
    return str
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }
}

module.exports = BaseAgent;
