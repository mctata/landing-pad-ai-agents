/**
 * Base Agent Class
 * Provides common functionality for all agent types
 */

class BaseAgent {
  constructor(config) {
    // Extract services from config object
    this.messaging = config.messageBus;
    this.storage = config.storage;
    this.logger = config.logger;
    this.dataStore = config.dataStore;
    this.errorHandling = config.errorHandling;
    this.aiProvider = config.aiProvider;
    
    // Get the agent name from the config
    this.name = config.name || 'unknown';
    
    // Try to get the specific agent configuration
    if (config.agentConfigs) {
      this.config = config.agentConfigs[this.name] || {};
      
      // If not found, log a warning
      if (!config.agentConfigs[this.name]) {
        if (config.logger) {
          config.logger.warn(`Missing configuration for agent: ${this.name}. It may not be available.`);
        }
      }
    } else {
      this.config = {}; // Default empty config
    }
    
    // Initialize modules map
    this.modules = new Map();
    this.isRunning = false;
  }

  async initialize() {
    this.logger.info(`Initializing agent: ${this.name}`);
    
    // Skip module initialization if no modules are defined or this is a base agent
    if (this.config.modules) {
      // Initialize modules
      for (const [moduleName, moduleConfig] of Object.entries(this.config.modules)) {
        if (moduleConfig.enabled) {
          try {
            const ModuleClass = require(`../../agents/${this.name}/modules/${this._kebabCase(moduleName)}`);
            const moduleInstance = new ModuleClass(moduleConfig, this.storage, this.logger);
            await moduleInstance.initialize();
            this.modules.set(moduleName, moduleInstance);
            this.logger.info(`Module initialized: ${moduleName}`);
          } catch (error) {
            this.logger.error(`Failed to initialize module ${moduleName}:`, error);
            // Log error but don't throw - allows agent to start even if module fails
            this.logger.warn(`Continuing without module: ${moduleName}`);
          }
        }
      }
    } else {
      this.logger.warn(`No modules configured for agent: ${this.name}`);
    }
    
    // Messaging setup - if messaging is available
    if (this.messaging) {
      try {
        // Connect to message broker
        if (!this.messaging.isConnected()) {
          await this.messaging.connect();
        }
        
        // Subscribe to command queue
        await this.messaging.subscribe(
          `${this.name}_commands`,
          this.handleCommand.bind(this)
        );
      } catch (error) {
        this.logger.error(`Error setting up messaging for agent ${this.name}:`, error);
        this.logger.warn(`Agent ${this.name} will operate with limited functionality`);
      }
    }
    
    this.logger.info(`Agent initialized: ${this.name}`);
  }

  async start() {
    if (this.isRunning) {
      this.logger.warn(`Agent already running: ${this.name}`);
      return;
    }
    
    this.logger.info(`Starting agent: ${this.name}`);
    this.isRunning = true;
    
    // Start all modules
    for (const [moduleName, module] of this.modules.entries()) {
      await module.start();
      this.logger.info(`Module started: ${moduleName}`);
    }
    
    this.logger.info(`Agent started: ${this.name}`);
  }

  async stop() {
    if (!this.isRunning) {
      this.logger.warn(`Agent not running: ${this.name}`);
      return;
    }
    
    this.logger.info(`Stopping agent: ${this.name}`);
    
    // Stop all modules
    for (const [moduleName, module] of this.modules.entries()) {
      await module.stop();
      this.logger.info(`Module stopped: ${moduleName}`);
    }
    
    this.isRunning = false;
    this.logger.info(`Agent stopped: ${this.name}`);
  }

  async handleCommand(command) {
    this.logger.info(`Received command: ${command.type}`, { commandId: command.id });
    
    try {
      // Check if command method exists
      const handlerName = `handle${this._camelCase(command.type)}Command`;
      
      if (typeof this[handlerName] === 'function') {
        const result = await this[handlerName](command);
        
        // Publish success event
        await this.messaging.publish(
          'agent_events',
          `${this.config.name}.${command.type}.success`,
          {
            id: this._generateId(),
            type: `${command.type}_success`,
            agent: this.config.name,
            payload: result,
            timestamp: new Date().toISOString(),
            correlation_id: command.id
          }
        );
        
        return result;
      } else {
        throw new Error(`Unsupported command type: ${command.type}`);
      }
    } catch (error) {
      this.logger.error(`Error handling command ${command.type}:`, error);
      
      // Publish failure event
      await this.messaging.publish(
        'agent_events',
        `${this.config.name}.${command.type}.failure`,
        {
          id: this._generateId(),
          type: `${command.type}_failure`,
          agent: this.config.name,
          payload: {
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
          },
          timestamp: new Date().toISOString(),
          correlation_id: command.id
        }
      );
      
      throw error;
    }
  }

  async publishEvent(type, payload, correlationId = null) {
    const event = {
      id: this._generateId(),
      type,
      agent: this.config.name,
      payload,
      timestamp: new Date().toISOString(),
      correlation_id: correlationId
    };
    
    await this.messaging.publish(
      'agent_events',
      `${this.config.name}.${type}`,
      event
    );
    
    return event;
  }

  _generateId() {
    return `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _camelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
  }

  _kebabCase(str) {
    return str.replace(/_/g, '-');
  }
}

module.exports = BaseAgent;