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
          await this._initializeModule(moduleName, moduleConfig);
        }
      }
      
      // Set up command handlers
      this._registerCommands();
      
      // Set up messaging
      await this._setupMessaging();
      
      this.status = 'initialized';
      this.logger.info(`Agent initialized: ${this.name}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to initialize agent: ${error.message}`, error);
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
        await module.start();
        this.logger.info(`Started module: ${moduleName}`);
      }
      
      // Start listening for commands
      await this._startCommandListener();
      
      this.status = 'running';
      this.logger.info(`Agent started: ${this.name}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
      this.logger.error(`Failed to start agent: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop() {
    try {
      this.logger.info(`Stopping agent: ${this.name}`);
      
      // Stop all modules
      for (const [moduleName, module] of this.modules.entries()) {
        await module.stop();
        this.logger.info(`Stopped module: ${moduleName}`);
      }
      
      // Stop listening for commands
      await this._stopCommandListener();
      
      this.status = 'stopped';
      this.logger.info(`Agent stopped: ${this.name}`);
      
      return true;
    } catch (error) {
      this.status = 'error';
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
    try {
      const { id, type, payload } = command;
      
      this.logger.info(`Handling command: ${type} (${id})`);
      
      // Check if command handler exists
      if (!this.commands.has(type)) {
        throw new Error(`Unknown command type: ${type}`);
      }
      
      // Execute command handler
      const handler = this.commands.get(type);
      const result = await handler(payload);
      
      this.logger.info(`Command completed: ${type} (${id})`);
      
      return {
        id,
        success: true,
        result
      };
    } catch (error) {
      this.logger.error(`Command failed: ${error.message}`, error);
      
      return {
        id: command.id,
        success: false,
        error: error.message
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
}

module.exports = BaseAgent;
