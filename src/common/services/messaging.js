/**
 * Messaging Service
 * Provides messaging capabilities for inter-agent communication
 */

class MessagingService {
  /**
   * Create a new messaging service
   * @param {Object} connection - RabbitMQ connection
   * @param {Object} logger - Logger instance
   */
  constructor(connection, logger) {
    this.connection = connection;
    this.logger = logger;
    this.channel = null;
    this.subscriptions = new Map();
    this.exchangeSubscriptions = new Map();
  }
  
  /**
   * Initialize the messaging service
   */
  async initialize() {
    try {
      // Create channel
      this.channel = await this.connection.createChannel();
      this.logger.info('Created RabbitMQ channel');
      
      // Create agent_events exchange
      await this.channel.assertExchange('agent_events', 'topic', { durable: true });
      this.logger.info('Created agent_events exchange');
      
      this.logger.info('Messaging service initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing messaging service:', error);
      throw error;
    }
  }
  
  /**
   * Check if the connection is active
   * @returns {boolean} True if connected
   */
  isConnected() {
    return this.connection && this.channel;
  }
  
  /**
   * Subscribe to a queue
   * @param {string} queueName - Name of the queue to subscribe to
   * @param {Function} handler - Message handler function
   */
  async subscribe(queueName, handler) {
    try {
      // Assert queue exists
      await this.channel.assertQueue(queueName, { durable: true });
      
      // Set up consumer
      const { consumerTag } = await this.channel.consume(queueName, async (msg) => {
        if (!msg) return;
        
        try {
          // Parse message
          const content = JSON.parse(msg.content.toString());
          
          // Call handler with message
          await handler(content);
          
          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing message from queue ${queueName}:`, error);
          
          // Acknowledge message to prevent requeuing (could use dead letter queue instead)
          this.channel.ack(msg);
        }
      });
      
      // Store subscription for cleanup
      this.subscriptions.set(queueName, consumerTag);
      
      this.logger.info(`Subscribed to queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Error subscribing to queue ${queueName}:`, error);
      throw error;
    }
  }
  
  /**
   * Subscribe to an exchange
   * @param {string} exchangeName - Name of the exchange to subscribe to
   * @param {string} routingKey - Routing key to subscribe to
   * @param {Function} handler - Message handler function
   */
  async subscribeToExchange(exchangeName, routingKey, handler) {
    try {
      // Assert exchange exists
      await this.channel.assertExchange(exchangeName, 'topic', { durable: true });
      
      // Create unique queue for this subscription
      const { queue } = await this.channel.assertQueue('', { exclusive: true });
      
      // Bind queue to exchange with routing key
      await this.channel.bindQueue(queue, exchangeName, routingKey);
      
      // Set up consumer
      const { consumerTag } = await this.channel.consume(queue, async (msg) => {
        if (!msg) return;
        
        try {
          // Parse message
          const content = JSON.parse(msg.content.toString());
          
          // Call handler with message
          await handler(content);
          
          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing message from exchange ${exchangeName} (${routingKey}):`, error);
          
          // Acknowledge message to prevent requeuing
          this.channel.ack(msg);
        }
      });
      
      // Store subscription details for cleanup
      const subscriptionKey = `${exchangeName}:${routingKey}`;
      this.exchangeSubscriptions.set(subscriptionKey, { queue, consumerTag });
      
      this.logger.info(`Subscribed to exchange: ${exchangeName} with routing key: ${routingKey}`);
      
      return subscriptionKey;
    } catch (error) {
      this.logger.error(`Error subscribing to exchange ${exchangeName} with routing key ${routingKey}:`, error);
      throw error;
    }
  }
  
  /**
   * Publish a message to a queue
   * @param {string} queueName - Name of the queue to publish to
   * @param {Object} message - Message to publish
   */
  async publish(queueName, message) {
    try {
      // Assert queue exists
      await this.channel.assertQueue(queueName, { durable: true });
      
      // Publish message
      const result = this.channel.sendToQueue(
        queueName, 
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
      
      if (!result) {
        this.logger.warn(`Queue ${queueName} is full or connection is blocked`);
      }
      
      this.logger.debug(`Published message to queue: ${queueName}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error publishing to queue ${queueName}:`, error);
      throw error;
    }
  }
  
  /**
   * Publish a message to an exchange
   * @param {string} exchangeName - Name of the exchange to publish to
   * @param {string} routingKey - Routing key for the message
   * @param {Object} message - Message to publish
   */
  async publish(exchangeName, routingKey, message) {
    try {
      // Assert exchange exists
      await this.channel.assertExchange(exchangeName, 'topic', { durable: true });
      
      // Publish message
      const result = this.channel.publish(
        exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
      
      if (!result) {
        this.logger.warn(`Exchange ${exchangeName} is full or connection is blocked`);
      }
      
      this.logger.debug(`Published message to exchange: ${exchangeName} with routing key: ${routingKey}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error publishing to exchange ${exchangeName} with routing key ${routingKey}:`, error);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from a queue
   * @param {string} queueName - Name of the queue to unsubscribe from
   */
  async unsubscribe(queueName) {
    try {
      const consumerTag = this.subscriptions.get(queueName);
      
      if (consumerTag) {
        await this.channel.cancel(consumerTag);
        this.subscriptions.delete(queueName);
        this.logger.info(`Unsubscribed from queue: ${queueName}`);
      }
    } catch (error) {
      this.logger.error(`Error unsubscribing from queue ${queueName}:`, error);
      throw error;
    }
  }
  
  /**
   * Unsubscribe from an exchange
   * @param {string} subscriptionKey - Subscription key returned from subscribeToExchange
   */
  async unsubscribeFromExchange(subscriptionKey) {
    try {
      const subscription = this.exchangeSubscriptions.get(subscriptionKey);
      
      if (subscription) {
        await this.channel.cancel(subscription.consumerTag);
        this.exchangeSubscriptions.delete(subscriptionKey);
        this.logger.info(`Unsubscribed from exchange with key: ${subscriptionKey}`);
      }
    } catch (error) {
      this.logger.error(`Error unsubscribing from exchange with key ${subscriptionKey}:`, error);
      throw error;
    }
  }
  
  /**
   * Close the messaging service
   */
  async close() {
    try {
      // Cancel all subscriptions
      for (const [queueName, consumerTag] of this.subscriptions.entries()) {
        try {
          await this.channel.cancel(consumerTag);
          this.logger.info(`Cancelled subscription to queue: ${queueName}`);
        } catch (error) {
          this.logger.warn(`Error cancelling subscription to queue ${queueName}:`, error);
        }
      }
      
      // Cancel all exchange subscriptions
      for (const [key, subscription] of this.exchangeSubscriptions.entries()) {
        try {
          await this.channel.cancel(subscription.consumerTag);
          this.logger.info(`Cancelled subscription to exchange with key: ${key}`);
        } catch (error) {
          this.logger.warn(`Error cancelling subscription to exchange with key ${key}:`, error);
        }
      }
      
      // Close channel
      if (this.channel) {
        await this.channel.close();
        this.logger.info('Closed RabbitMQ channel');
      }
      
      this.logger.info('Messaging service closed');
    } catch (error) {
      this.logger.error('Error closing messaging service:', error);
      throw error;
    }
  }
}

module.exports = MessagingService;