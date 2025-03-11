// src/core/messaging/messageBus.js
const amqp = require('amqplib');
const config = require('../../config');
const logger = require('../utils/logger');

class MessageBus {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.subscriptions = new Map();
  }

  async connect() {
    try {
      // Connect to RabbitMQ
      this.connection = await amqp.connect(config.messaging.uri);
      this.channel = await this.connection.createChannel();
      
      // Create exchanges
      await this.channel.assertExchange(config.messaging.exchanges.commands, 'direct', { durable: true });
      await this.channel.assertExchange(config.messaging.exchanges.events, 'topic', { durable: true });
      
      // Set isConnected flag
      this.isConnected = true;
      
      logger.info('MessageBus connected successfully');
      return this;
    } catch (error) {
      logger.error('Failed to connect to message broker', error);
      throw error;
    }
  }

  async close() {
    if (this.channel) {
      await this.channel.close();
    }
    
    if (this.connection) {
      await this.connection.close();
    }
    
    this.isConnected = false;
    logger.info('MessageBus connection closed');
  }

  async publishCommand(routingKey, data) {
    if (!this.isConnected) {
      throw new Error('MessageBus not connected');
    }
    
    try {
      const success = this.channel.publish(
        config.messaging.exchanges.commands,
        routingKey,
        Buffer.from(JSON.stringify(data)),
        { persistent: true }
      );
      
      logger.debug(`Published command to ${routingKey}`, { success });
      return success;
    } catch (error) {
      logger.error(`Failed to publish command to ${routingKey}`, error);
      throw error;
    }
  }

  async publishEvent(routingKey, data) {
    if (!this.isConnected) {
      throw new Error('MessageBus not connected');
    }
    
    try {
      const success = this.channel.publish(
        config.messaging.exchanges.events,
        routingKey,
        Buffer.from(JSON.stringify(data)),
        { persistent: true }
      );
      
      logger.debug(`Published event to ${routingKey}`, { success });
      return success;
    } catch (error) {
      logger.error(`Failed to publish event to ${routingKey}`, error);
      throw error;
    }
  }

  async subscribeToCommand(routingKey, handler) {
    if (!this.isConnected) {
      throw new Error('MessageBus not connected');
    }
    
    try {
      // Create queue
      const { queue } = await this.channel.assertQueue('', { exclusive: true });
      
      // Bind queue to exchange with routing key
      await this.channel.bindQueue(queue, config.messaging.exchanges.commands, routingKey);
      
      // Consume messages
      const consumer = await this.channel.consume(queue, async (msg) => {
        if (!msg) return;
        
        try {
          const data = JSON.parse(msg.content.toString());
          await handler(data, { 
            type: routingKey, 
            timestamp: new Date(msg.properties.timestamp),
            messageId: msg.properties.messageId
          });
          
          this.channel.ack(msg);
        } catch (error) {
          logger.error(`Error handling command ${routingKey}`, error);
          this.channel.nack(msg);
        }
      });
      
      // Store subscription
      this.subscriptions.set(`command:${routingKey}`, { queue, consumer });
      
      logger.info(`Subscribed to command ${routingKey}`);
      return { queue, consumer };
    } catch (error) {
      logger.error(`Failed to subscribe to command ${routingKey}`, error);
      throw error;
    }
  }

  async subscribeToEvent(pattern, handler) {
    if (!this.isConnected) {
      throw new Error('MessageBus not connected');
    }
    
    try {
      // Create queue
      const { queue } = await this.channel.assertQueue('', { exclusive: true });
      
      // Bind queue to exchange with pattern
      await this.channel.bindQueue(queue, config.messaging.exchanges.events, pattern);
      
      // Consume messages
      const consumer = await this.channel.consume(queue, async (msg) => {
        if (!msg) return;
        
        try {
          const data = JSON.parse(msg.content.toString());
          await handler(data, { 
            type: msg.fields.routingKey, 
            timestamp: new Date(msg.properties.timestamp),
            messageId: msg.properties.messageId
          });
          
          this.channel.ack(msg);
        } catch (error) {
          logger.error(`Error handling event ${pattern}`, error);
          this.channel.nack(msg);
        }
      });
      
      // Store subscription
      this.subscriptions.set(`event:${pattern}`, { queue, consumer });
      
      logger.info(`Subscribed to event pattern ${pattern}`);
      return { queue, consumer };
    } catch (error) {
      logger.error(`Failed to subscribe to event pattern ${pattern}`, error);
      throw error;
    }
  }

  async unsubscribe(type, key) {
    const subscriptionKey = `${type}:${key}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      const { consumer } = this.subscriptions.get(subscriptionKey);
      await this.channel.cancel(consumer.consumerTag);
      this.subscriptions.delete(subscriptionKey);
      
      logger.info(`Unsubscribed from ${subscriptionKey}`);
      return true;
    }
    
    return false;
  }
}

// Singleton instance
let messageBusInstance = null;

module.exports.getInstance = async () => {
  if (!messageBusInstance) {
    messageBusInstance = new MessageBus();
    await messageBusInstance.connect();
  }
  
  return messageBusInstance;
};