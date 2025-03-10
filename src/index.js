/**
 * Landing Pad Digital AI Agent System
 * Main application entry point
 */

// Load environment variables
require('dotenv').config();

// Import dependencies
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { createLogger, format, transports } = require('winston');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');

// Import agent classes
const ContentStrategyAgent = require('./agents/content_strategy');
const ContentCreationAgent = require('./agents/content_creation');
const ContentManagementAgent = require('./agents/content_management');
const OptimisationAgent = require('./agents/optimisation');
const BrandConsistencyAgent = require('./agents/brand_consistency');

// Import utilities
const ConfigLoader = require('./common/utils/config-loader');
const MessagingService = require('./common/services/messaging');
const StorageService = require('./common/services/storage');
const AIProviderService = require('./common/services/ai-provider');

// Initialize logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/system.log' })
  ]
});

// Log system startup
logger.info('Starting Landing Pad Digital AI Agent System');

// Agent instances
let agents = {};

// Initialize services and agents
async function initialize() {
  try {
    // Load configuration
    const config = await ConfigLoader.load();
    logger.info('Configuration loaded successfully');
    
    // Connect to MongoDB
    const mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    logger.info('Connected to MongoDB');
    
    const db = mongoClient.db();
    
    // Initialize storage service
    const storage = new StorageService(db);
    logger.info('Storage service initialized');
    
    // Connect to RabbitMQ
    const messagingConnection = await amqp.connect({
      hostname: process.env.RABBITMQ_HOST || 'localhost',
      port: process.env.RABBITMQ_PORT || 5672,
      username: process.env.RABBITMQ_USERNAME || 'guest',
      password: process.env.RABBITMQ_PASSWORD || 'guest'
    });
    logger.info('Connected to RabbitMQ');
    
    // Initialize messaging service
    const messaging = new MessagingService(messagingConnection, logger);
    await messaging.initialize();
    logger.info('Messaging service initialized');
    
    // Initialize AI provider service
    const aiProvider = new AIProviderService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG_ID
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY
      }
    }, logger);
    logger.info('AI provider service initialized');
    
    // Initialize agents
    agents = {
      contentStrategy: new ContentStrategyAgent(
        config.agents.content_strategy,
        messaging,
        storage,
        logger.child({ agent: 'content_strategy' }),
        aiProvider
      ),
      
      contentCreation: new ContentCreationAgent(
        config.agents.content_creation,
        messaging,
        storage,
        logger.child({ agent: 'content_creation' }),
        aiProvider
      ),
      
      contentManagement: new ContentManagementAgent(
        config.agents.content_management,
        messaging,
        storage,
        logger.child({ agent: 'content_management' }),
        aiProvider
      ),
      
      optimisation: new OptimisationAgent(
        config.agents.optimisation,
        messaging,
        storage,
        logger.child({ agent: 'optimisation' }),
        aiProvider
      ),
      
      brandConsistency: new BrandConsistencyAgent(
        config.agents.brand_consistency,
        messaging,
        storage,
        logger.child({ agent: 'brand_consistency' }),
        aiProvider
      )
    };
    
    // Initialize each agent
    for (const [name, agent] of Object.entries(agents)) {
      await agent.initialize();
      logger.info(`${name} agent initialized`);
    }
    
    // Start each agent
    for (const [name, agent] of Object.entries(agents)) {
      await agent.start();
      logger.info(`${name} agent started`);
    }
    
    // Initialize web server
    initializeWebServer();
    
    logger.info('Landing Pad Digital AI Agent System initialized successfully');
    
    // Setup graceful shutdown
    setupGracefulShutdown(mongoClient, messagingConnection);
    
  } catch (error) {
    logger.error('Error initializing system:', error);
    process.exit(1);
  }
}

// Initialize web server for admin interface and API
function initializeWebServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Configure middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*'
  }));
  app.use(express.json());
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim())
    }
  }));
  
  // Static files for admin interface
  app.use('/admin', express.static('public/admin'));
  
  // API routes
  app.use('/api', require('./api/routes'));
  
  // Error handler
  app.use((err, req, res, next) => {
    logger.error('API error:', err);
    res.status(err.status || 500).json({
      error: {
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  });
  
  // Start server
  app.listen(port, () => {
    logger.info(`Web server running on port ${port}`);
  });
}

// Set up graceful shutdown
function setupGracefulShutdown(mongoClient, messagingConnection) {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    // Stop each agent
    for (const [name, agent] of Object.entries(agents)) {
      try {
        await agent.stop();
        logger.info(`${name} agent stopped`);
      } catch (error) {
        logger.error(`Error stopping ${name} agent:`, error);
      }
    }
    
    // Close database connection
    try {
      await mongoClient.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
    
    // Close messaging connection
    try {
      await messagingConnection.close();
      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
    }
    
    logger.info('Shutdown complete');
    process.exit(0);
  };
  
  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

// Start the system
initialize();
