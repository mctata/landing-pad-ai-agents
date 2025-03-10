// src/core/messaging/messageBus.js
const amqp = require('amqplib');
const config = require('../../config');
const logger = require('../utils/logger');

class MessageBus {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = config.messageBus?.maxRetries || 5;
    this.retryDelay = config.messageBus?.retryDelay || 5000; // 5 seconds
    this.exchanges = {
      commands: 'landing_pad.commands',
      events: 'landing_pad.events',
      queries: 'landing_pad.queries'
    };
  }

  async connect() {
    try {
      this.connection = await amqp.connect(config.messageBus?.url || 'amqp://localhost:5672');
      this.channel = await this.connection.createChannel();
      
      // Setup exchanges
      await this.channel.assertExchange(this.exchanges.commands, 'topic', { durable: true });
      await this.channel.assertExchange(this.exchanges.events, 'topic', { durable: true });
      await this.channel.assertExchange(this.exchanges.queries, 'topic', { durable: true });
      
      // Setup dead letter exchange
      await this.channel.assertExchange('landing_pad.dead_letter', 'fanout', { durable: true });
      
      // Handle connection events
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', err);
        this.retryConnection();
      });
      
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.isConnected = false;
        this.retryConnection();
      });
      
      this.isConnected = true;
      this.retryCount = 0;
      logger.info('Successfully connected to RabbitMQ');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ', error);
      this.retryConnection();
      throw error;
    }
  }

  async retryConnection() {
    if (this.retryCount >= this.maxRetries) {
      logger.error(`Failed to reconnect to RabbitMQ after ${this.maxRetries} attempts`);
      return;
    }
    
    this.retryCount++;
    logger.info(`Attempting to reconnect to RabbitMQ (${this.retryCount}/${this.maxRetries})...`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        // Error is already logged in connect()
      }
    }, this.retryDelay);
  }

  async publishCommand(routingKey, data, options = {}) {
    return this.publish(this.exchanges.commands, routingKey, data, options);
  }

  async publishEvent(routingKey, data, options = {}) {
    return this.publish(this.exchanges.events, routingKey, data, options);
  }

  async publishQuery(routingKey, data, options = {}) {
    return this.publish(this.exchanges.queries, routingKey, data, options);
  }

  async publish(exchange, routingKey, data, options = {}) {
    if (!this.isConnected) {
      throw new Error('Cannot publish message: MessageBus not connected');
    }
    
    try {
      const message = Buffer.from(JSON.stringify({
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          messageId: options.messageId || this.generateId(),
          correlationId: options.correlationId,
          source: options.source || 'system',
          ...options.metadata
        }
      }));
      
      const publishOptions = {
        persistent: true,
        ...options
      };
      
      return this.channel.publish(exchange, routingKey, message, publishOptions);
    } catch (error) {
      logger.error(`Failed to publish message to ${exchange} with routing key ${routingKey}`, error);
      throw error;
    }
  }

  async subscribe(exchange, routingKey, handler, options = {}) {
    if (!this.isConnected) {
      throw new Error('Cannot subscribe: MessageBus not connected');
    }
    
    try {
      // Create a queue with a generated name or use provided name
      const queueName = options.queueName || '';
      const { queue } = await this.channel.assertQueue(queueName, {
        durable: true,
        deadLetterExchange: 'landing_pad.dead_letter',
        ...options.queueOptions
      });
      
      // Bind the queue to the exchange with the routing key
      await this.channel.bindQueue(queue, exchange, routingKey);
      
      // Set prefetch if provided
      if (options.prefetch) {
        await this.channel.prefetch(options.prefetch);
      }
      
      // Start consuming messages
      await this.channel.consume(queue, async (msg) => {
        if (!msg) return;
        
        try {
          const content = JSON.parse(msg.content.toString());
          
          // Process the message with the handler
          await handler(content.data, content.metadata, msg);
          
          // Acknowledge the message
          this.channel.ack(msg);
        } catch (error) {
          logger.error(`Error processing message from ${queue}`, error);
          
          // Handle retry logic
          const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;
          
          if (retryCount <= (options.maxRetries || 3)) {
            // Republish with incremented retry count
            const retryMessage = msg.content;
            
            this.channel.publish(exchange, routingKey, retryMessage, {
              headers: {
                'x-retry-count': retryCount,
                'x-original-exchange': exchange,
                'x-original-routing-key': routingKey
              }
            });
            
            // Acknowledge the original message
            this.channel.ack(msg);
          } else {
            // Send to dead letter queue when max retries exceeded
            this.channel.reject(msg, false);
          }
        }
      }, { noAck: false });
      
      logger.info(`Subscribed to ${exchange} with routing key ${routingKey} on queue ${queue}`);
      
      return {
        queueName: queue,
        unsubscribe: async () => {
          await this.channel.cancel(queue);
          logger.info(`Unsubscribed from queue ${queue}`);
        }
      };
    } catch (error) {
      logger.error(`Failed to subscribe to ${exchange} with routing key ${routingKey}`, error);
      throw error;
    }
  }

  async subscribeToCommand(routingKey, handler, options = {}) {
    return this.subscribe(this.exchanges.commands, routingKey, handler, options);
  }

  async subscribeToEvent(routingKey, handler, options = {}) {
    return this.subscribe(this.exchanges.events, routingKey, handler, options);
  }

  async subscribeToQuery(routingKey, handler, options = {}) {
    return this.subscribe(this.exchanges.queries, routingKey, handler, options);
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    
    if (this.connection) {
      await this.connection.close();
    }
    
    this.isConnected = false;
    logger.info('Disconnected from RabbitMQ');
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}

// Singleton instance
let messageBusInstance = null;

module.exports = {
  getInstance: async () => {
    if (!messageBusInstance) {
      messageBusInstance = new MessageBus();
      await messageBusInstance.connect();
    }
    return messageBusInstance;
  }
};
