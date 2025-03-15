// src/core/messaging/messageBus.js
// Simplified in-memory message bus implementation (no RabbitMQ dependency)
const config = require('../../config');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class MessageBus {
  constructor() {
    this.eventEmitter = new EventEmitter();
    this.isConnected = false;
    this.subscriptions = new Map();
    
    // Set higher event listener limit to avoid warnings
    this.eventEmitter.setMaxListeners(100);
  }

  async connect() {
    try {
      // No actual connection needed - this is an in-memory implementation
      this.isConnected = true;
      logger.info('MessageBus (in-memory) initialized successfully');
      return this;
    } catch (error) {
      logger.error('Failed to initialize message bus', error);
      throw error;
    }
  }

  async close() {
    // Remove all listeners
    this.eventEmitter.removeAllListeners();
    this.subscriptions.clear();
    
    this.isConnected = false;
    logger.info('MessageBus closed');
  }

  async publishCommand(routingKey, data) {
    if (!this.isConnected) {
      throw new Error('MessageBus not connected');
    }
    
    try {
      // Create the message envelope
      const message = {
        data,
        metadata: {
          type: routingKey,
          timestamp: new Date(),
          messageId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
        }
      };
      
      // Emit as command event
      const eventName = `command:${routingKey}`;
      this.eventEmitter.emit(eventName, message);
      
      logger.debug(`Published command to ${routingKey}`);
      return true;
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
      // Create the message envelope
      const message = {
        data,
        metadata: {
          type: routingKey,
          timestamp: new Date(),
          messageId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
        }
      };
      
      // Emit as event
      const eventName = `event:${routingKey}`;
      this.eventEmitter.emit(eventName, message);
      
      // Also emit for pattern matching subscribers
      // This is a simplistic implementation - in a real system,
      // you would need to implement proper topic matching
      const parts = routingKey.split('.');
      while (parts.length > 0) {
        const pattern = parts.join('.') + '.*';
        this.eventEmitter.emit(`event-pattern:${pattern}`, message);
        parts.pop();
      }
      
      logger.debug(`Published event to ${routingKey}`);
      return true;
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
      const eventName = `command:${routingKey}`;
      
      // Create the event handler
      const eventHandler = async (message) => {
        try {
          await handler(message.data, { 
            type: routingKey, 
            timestamp: message.metadata.timestamp,
            messageId: message.metadata.messageId
          });
        } catch (error) {
          logger.error(`Error handling command ${routingKey}`, error);
        }
      };
      
      // Register the handler
      this.eventEmitter.on(eventName, eventHandler);
      
      // Store subscription for later cleanup
      this.subscriptions.set(eventName, { eventHandler });
      
      logger.info(`Subscribed to command ${routingKey}`);
      return { eventName, eventHandler };
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
      const eventName = `event:${pattern}`;
      const patternEventName = `event-pattern:${pattern}`;
      
      // Create the event handler
      const eventHandler = async (message) => {
        try {
          await handler(message.data, { 
            type: message.metadata.type, 
            timestamp: message.metadata.timestamp,
            messageId: message.metadata.messageId
          });
        } catch (error) {
          logger.error(`Error handling event ${pattern}`, error);
        }
      };
      
      // Register the handler for exact matches
      this.eventEmitter.on(eventName, eventHandler);
      
      // Register the handler for pattern matches
      this.eventEmitter.on(patternEventName, eventHandler);
      
      // Store subscriptions for later cleanup
      this.subscriptions.set(eventName, { eventHandler });
      this.subscriptions.set(patternEventName, { eventHandler });
      
      logger.info(`Subscribed to event pattern ${pattern}`);
      return { eventName, eventHandler };
    } catch (error) {
      logger.error(`Failed to subscribe to event pattern ${pattern}`, error);
      throw error;
    }
  }

  async unsubscribe(type, key) {
    const subscriptionKey = `${type}:${key}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      const { eventHandler } = this.subscriptions.get(subscriptionKey);
      this.eventEmitter.removeListener(subscriptionKey, eventHandler);
      this.subscriptions.delete(subscriptionKey);
      
      logger.info(`Unsubscribed from ${subscriptionKey}`);
      return true;
    }
    
    return false;
  }
  
  async getStatus() {
    return {
      connected: this.isConnected,
      type: 'in-memory',
      subscriptionCount: this.subscriptions.size,
      maxListeners: this.eventEmitter.getMaxListeners()
    };
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