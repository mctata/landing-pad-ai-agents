/**
 * Messaging Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides a unified interface for agent communication via RabbitMQ.
 * It handles:
 * - Command publishing and consumption
 * - Event publishing and subscription
 * - Connection management and reconnection
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const logger = require('./LoggerService');
const ConfigService = require('./ConfigService');

class MessagingService {
  constructor() {
    this.config = ConfigService.getConfig('messaging');
    this.logger = logger.createLogger('messaging');
    this.connection = null;
    this.channel = null;
    this.consumers = new Map();
    this.connected = false;
    this.reconnecting = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Initialize the messaging service
   */
  async initialize() {
    try {
      this.logger.info('Initializing messaging service');
      
      // Connect to RabbitMQ
      await this._connect();
      
      // Set up exchanges and queues
      await this._setupTopology();
      
      this.logger.info('Messaging service initialized');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize messaging service: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Publish a command to an agent
   * @param {string} agentId - Target agent ID
   * @param {string} commandType - Command type
   * @param {Object} payload - Command payload
   * @returns {Promise<string>} - Command ID
   */
  async publishCommand(agentId, commandType, payload) {
    try {
      const commandId = uuidv4();
      
      const command = {
        id: commandId,
        type: commandType,
        timestamp: new Date().toISOString(),
        payload
      };
      
      this.logger.info(`Publishing command: ${commandType} to ${agentId}`);
      
      // Ensure we have a connection
      await this._ensureConnection();
      
      // Publish to the command exchange with the agent ID as routing key
      await this.channel.publish(
        'agent-commands',
        agentId,
        Buffer.from(JSON.stringify(command)),
        {
          persistent: true,
          contentType: 'application/json'
        }
      );
      
      return commandId;
    } catch (error) {
      this.logger.error(`Failed to publish command: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Consume commands from a queue
   * @param {string} queueName - Queue name
   * @param {Function} handler - Command handler function
   * @returns {Promise<string>} - Consumer tag
   */
  async consumeCommands(queueName, handler) {
    try {
      this.logger.info(`Starting command consumer for queue: ${queueName}`);
      
      // Ensure we have a connection
      await this._ensureConnection();
      
      // Set up consumer
      const { consumerTag } = await this.channel.consume(queueName, async (msg) => {
        if (msg === null) {
          return;
        }
        
        try {
          // Parse message
          const command = JSON.parse(msg.content.toString());
          
          this.logger.info(`Received command: ${command.type} (${command.id})`);
          
          // Execute handler
          const result = await handler(command);
          
          // Acknowledge message
          this.channel.ack(msg);
          
          return result;
        } catch (error) {
          this.logger.error(`Error processing command: ${error.message}`, error);
          
          // Reject message (don't requeue for now)
          this.channel.reject(msg, false);
        }
      });
      
      // Store consumer tag
      this.consumers.set(queueName, consumerTag);
      
      this.logger.info(`Command consumer started for queue: ${queueName}`);
      
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to consume commands: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Stop consuming from a queue
   * @param {string} queueName - Queue name
   * @returns {Promise<boolean>} - Success
   */
  async stopConsuming(queueName) {
    try {
      this.logger.info(`Stopping command consumer for queue: ${queueName}`);
      
      // Get consumer tag
      const consumerTag = this.consumers.get(queueName);
      
      if (!consumerTag) {
        this.logger.warn(`No consumer found for queue: ${queueName}`);
        return false;
      }
      
      // Cancel consumer
      await this.channel.cancel(consumerTag);
      
      // Remove consumer tag
      this.consumers.delete(queueName);
      
      this.logger.info(`Command consumer stopped for queue: ${queueName}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to stop consuming: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Publish an event
   * @param {string} source - Event source (agent ID)
   * @param {string} eventType - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<string>} - Event ID
   */
  async publishEvent(source, eventType, payload) {
    try {
      const eventId = uuidv4();
      
      const event = {
        id: eventId,
        type: eventType,
        source,
        timestamp: new Date().toISOString(),
        payload
      };
      
      this.logger.info(`Publishing event: ${eventType} from ${source}`);
      
      // Ensure we have a connection
      await this._ensureConnection();
      
      // Create routing key: source.eventType
      const routingKey = `${source}.${eventType}`;
      
      // Publish to the event exchange
      await this.channel.publish(
        'agent-events',
        routingKey,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: 'application/json'
        }
      );
      
      return eventId;
    } catch (error) {
      this.logger.error(`Failed to publish event: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   * @param {string} pattern - Event pattern (e.g. 'agent.event')
   * @param {Function} handler - Event handler function
   * @returns {Promise<string>} - Consumer tag
   */
  async subscribe(pattern, handler) {
    try {
      this.logger.info(`Subscribing to event pattern: ${pattern}`);
      
      // Ensure we have a connection
      await this._ensureConnection();
      
      // Create temporary queue for subscription
      const { queue } = await this.channel.assertQueue('', { 
        exclusive: true,
        autoDelete: true
      });
      
      // Bind queue to event exchange with pattern
      await this.channel.bindQueue(queue, 'agent-events', pattern);
      
      // Set up consumer
      const { consumerTag } = await this.channel.consume(queue, async (msg) => {
        if (msg === null) {
          return;
        }
        
        try {
          // Parse message
          const event = JSON.parse(msg.content.toString());
          
          this.logger.info(`Received event: ${event.type} from ${event.source} (${event.id})`);
          
          // Execute handler
          await handler(event);
          
          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing event: ${error.message}`, error);
          
          // Reject message (don't requeue for now)
          this.channel.reject(msg, false);
        }
      });
      
      // Store consumer tag
      this.consumers.set(queue, consumerTag);
      
      this.logger.info(`Subscribed to event pattern: ${pattern}`);
      
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to subscribe to events: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Shutdown the messaging service
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down messaging service');
      
      // Close channel
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      
      // Close connection
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      
      this.connected = false;
      this.consumers.clear();
      
      this.logger.info('Messaging service shut down');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down messaging service: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Connect to RabbitMQ
   * @private
   */
  async _connect() {
    try {
      this.logger.info('Connecting to RabbitMQ');
      
      // Get connection URI
      const uri = this.config.rabbitMQ.uri;
      
      // Connect
      this.connection = await amqp.connect(uri, this.config.rabbitMQ.options);
      
      // Create channel
      this.channel = await this.connection.createChannel();
      
      // Set prefetch
      await this.channel.prefetch(this.config.rabbitMQ.options.prefetch || 1);
      
      // Set up connection event handlers
      this.connection.on('error', (error) => {
        this.logger.error(`RabbitMQ connection error: ${error.message}`, error);
        this.connected = false;
        this._reconnect();
      });
      
      this.connection.on('close', () => {
        if (this.connected) {
          this.logger.warn('RabbitMQ connection closed unexpectedly');
          this.connected = false;
          this._reconnect();
        }
      });
      
      this.connected = true;
      this.reconnectAttempts = 0;
      
      this.logger.info('Connected to RabbitMQ');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error.message}`, error);
      this.connected = false;
      this._reconnect();
      throw error;
    }
  }

  /**
   * Set up exchanges and queues
   * @private
   */
  async _setupTopology() {
    try {
      this.logger.info('Setting up exchanges and queues');
      
      // Create exchanges
      for (const [exchangeName, exchangeConfig] of Object.entries(this.config.exchanges)) {
        await this.channel.assertExchange(
          exchangeName,
          exchangeConfig.type,
          exchangeConfig.options
        );
        
        this.logger.info(`Created exchange: ${exchangeName}`);
      }
      
      // Create queues
      for (const [queueName, queueConfig] of Object.entries(this.config.queues)) {
        await this.channel.assertQueue(
          queueName,
          queueConfig.options
        );
        
        // Bind queue to exchanges
        for (const binding of queueConfig.bindings) {
          await this.channel.bindQueue(
            queueName,
            binding.exchange,
            binding.routingKey || ''
          );
          
          this.logger.info(`Bound queue ${queueName} to exchange ${binding.exchange} with key ${binding.routingKey || '<empty>'}`);
        }
        
        this.logger.info(`Created queue: ${queueName}`);
      }
      
      this.logger.info('Topology setup complete');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set up topology: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Ensure we have a connection to RabbitMQ
   * @private
   */
  async _ensureConnection() {
    if (!this.connected) {
      return await this._connect();
    }
    return true;
  }

  /**
   * Reconnect to RabbitMQ with exponential backoff
   * @private
   */
  async _reconnect() {
    if (this.reconnecting) {
      return;
    }
    
    this.reconnecting = true;
    
    try {
      // Calculate backoff delay
      const backoffStrategy = this.config.rabbitMQ.options.reconnectStrategy;
      const maxRetries = backoffStrategy.retries;
      
      if (this.reconnectAttempts >= maxRetries) {
        this.logger.error(`Maximum reconnection attempts (${maxRetries}) reached`);
        this.reconnecting = false;
        return;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        backoffStrategy.initialDelay * Math.pow(backoffStrategy.factor, this.reconnectAttempts),
        backoffStrategy.maxDelay
      );
      
      this.reconnectAttempts++;
      
      this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxRetries})`);
      
      // Wait for delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Try to reconnect
      await this._connect();
      
      // Recreate topology
      await this._setupTopology();
      
      this.reconnecting = false;
    } catch (error) {
      this.logger.error(`Reconnection attempt failed: ${error.message}`, error);
      this.reconnecting = false;
      
      // Try again
      this._reconnect();
    }
  }
}

// Singleton instance
const instance = new MessagingService();

module.exports = instance;
