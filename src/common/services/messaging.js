/**
 * Messaging Service
 * Provides RabbitMQ connection and message handling
 */

const amqp = require('amqplib');

class MessagingService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.connection = null;
    this.channel = null;
    this.subscriptions = new Map();
    this.isReconnecting = false;
  }

  async connect() {
    try {
      this.logger.info('Connecting to message broker...');
      
      // Build connection URL
      const { host, port, username, password, vhost, ssl } = this.config.broker;
      const protocol = ssl ? 'amqps' : 'amqp';
      const connectionUrl = `${protocol}://${username}:${password}@${host}:${port}/${encodeURIComponent(vhost)}`;
      
      // Connect to RabbitMQ
      this.connection = await amqp.connect(connectionUrl);
      
      // Create channel
      this.channel = await this.connection.createChannel();
      
      // Setup exchanges
      for (const [exchangeName, exchangeConfig] of Object.entries(this.config.exchanges)) {
        await this.channel.assertExchange(
          exchangeName,
          exchangeConfig.type,
          { durable: exchangeConfig.durable }
        );
      }
      
      // Setup queues
      for (const [queueName, queueConfig] of Object.entries(this.config.queues)) {
        await this.channel.assertQueue(queueName, { durable: queueConfig.durable });
        
        // Bind queue to exchange if binding is specified
        if (queueConfig.binding) {
          await this.channel.bindQueue(
            queueName,
            queueConfig.binding.exchange,
            queueConfig.binding.routing_key || ''
          );
        }
        
        // Set prefetch if specified
        if (queueConfig.prefetch) {
          await this.channel.prefetch(queueConfig.prefetch);
        }
      }
      
      // Setup error handlers
      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error:', err);
        this._reconnect();
      });
      
      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
        this._reconnect();
      });
      
      this.logger.info('Message broker connection established');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to message broker:', error);
      throw error;
    }
  }

  async _reconnect() {
    try {
      // Only attempt reconnect if we're not already connecting
      if (this.connection === null && this.isReconnecting !== true) {
        this.isReconnecting = true;
        this.logger.info('Attempting to reconnect to message broker...');
        
        // Wait before reconnecting
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Connect and restore subscriptions
        await this.connect();
        
        // Resubscribe to all previous subscriptions
        const subscriptions = [...this.subscriptions.entries()];
        this.subscriptions.clear();
        
        for (const [key, { queue, exchange, pattern, callback }] of subscriptions) {
          if (queue) {
            await this.subscribe(queue, callback);
          } else if (exchange && pattern) {
            await this.subscribeToExchange(exchange, pattern, callback);
          }
        }
        
        this.isReconnecting = false;
        this.logger.info('Successfully reconnected to message broker');
      }
    } catch (error) {
      this.isReconnecting = false;
      this.logger.error('Failed to reconnect to message broker:', error);
      
      // Try again after a delay
      setTimeout(() => this._reconnect(), 10000);
    }
  }

  async disconnect() {
    if (this.channel) {
      try {
        await this.channel.close();
        this.channel = null;
      } catch (error) {
        this.logger.error('Error closing channel:', error);
      }
    }
    
    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = null;
      } catch (error) {
        this.logger.error('Error closing connection:', error);
      }
    }
    
    this.subscriptions.clear();
    this.logger.info('Message broker connection closed');
  }

  async publish(exchange, routingKey, message) {
    if (!this.channel) {
      throw new Error('Not connected to message broker');
    }
    
    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      await this.channel.publish(
        exchange,
        routingKey,
        messageBuffer,
        {
          contentType: 'application/json',
          messageId: message.id,
          correlationId: message.correlation_id || undefined,
          timestamp: Math.floor(Date.now() / 1000)
        }
      );
      
      this.logger.debug('Published message', {
        exchange,
        routingKey,
        messageId: message.id
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to publish message:', error);
      throw error;
    }
  }

  async subscribe(queue, callback) {
    if (!this.channel) {
      throw new Error('Not connected to message broker');
    }
    
    if (this.subscriptions.has(queue)) {
      this.logger.warn(`Already subscribed to queue: ${queue}`);
      return;
    }
    
    try {
      const { consumerTag } = await this.channel.consume(queue, async (msg) => {
        if (msg === null) {
          this.logger.warn(`Consumer for queue ${queue} cancelled by broker`);
          return;
        }
        
        try {
          // Parse message content
          const content = JSON.parse(msg.content.toString());
          
          this.logger.debug('Received message', {
            queue,
            messageId: content.id
          });
          
          // Process message
          await callback(content);
          
          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error('Error processing message:', error);
          
          // Reject message and requeue if configured
          const requeue = this.config.retry && this.config.retry.max_attempts > 0;
          this.channel.nack(msg, false, requeue);
        }
      });
      
      this.subscriptions.set(queue, { queue, callback, consumerTag });
      
      this.logger.info(`Subscribed to queue: ${queue}`);
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to subscribe to queue ${queue}:`, error);
      throw error;
    }
  }

  async subscribeToExchange(exchange, pattern, callback) {
    if (!this.channel) {
      throw new Error('Not connected to message broker');
    }
    
    const subscriptionKey = `${exchange}:${pattern}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.logger.warn(`Already subscribed to ${exchange} with pattern ${pattern}`);
      return;
    }
    
    try {
      // Create an exclusive queue for this subscription
      const { queue } = await this.channel.assertQueue('', { exclusive: true });
      
      // Bind the queue to the exchange with the pattern
      await this.channel.bindQueue(queue, exchange, pattern);
      
      // Subscribe to the queue
      const { consumerTag } = await this.channel.consume(queue, async (msg) => {
        if (msg === null) {
          this.logger.warn(`Consumer for exchange ${exchange} cancelled by broker`);
          return;
        }
        
        try {
          // Parse message content
          const content = JSON.parse(msg.content.toString());
          
          this.logger.debug('Received message from exchange', {
            exchange,
            pattern,
            messageId: content.id
          });
          
          // Process message
          await callback(content, msg.fields.routingKey);
          
          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          this.logger.error('Error processing message from exchange:', error);
          
          // Reject message but don't requeue since it's a pub/sub pattern
          this.channel.nack(msg, false, false);
        }
      });
      
      this.subscriptions.set(subscriptionKey, { 
        exchange, 
        pattern, 
        queue, 
        callback, 
        consumerTag 
      });
      
      this.logger.info(`Subscribed to exchange: ${exchange} with pattern: ${pattern}`);
      return consumerTag;
    } catch (error) {
      this.logger.error(`Failed to subscribe to exchange ${exchange}:`, error);
      throw error;
    }
  }

  async unsubscribe(queueOrKey) {
    if (!this.channel) {
      throw new Error('Not connected to message broker');
    }
    
    if (!this.subscriptions.has(queueOrKey)) {
      this.logger.warn(`Not subscribed to: ${queueOrKey}`);
      return;
    }
    
    const subscription = this.subscriptions.get(queueOrKey);
    
    try {
      await this.channel.cancel(subscription.consumerTag);
      this.subscriptions.delete(queueOrKey);
      this.logger.info(`Unsubscribed from: ${queueOrKey}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from ${queueOrKey}:`, error);
      throw error;
    }
  }
}

module.exports = MessagingService;