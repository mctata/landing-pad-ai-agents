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
const { Sequelize } = require('sequelize');
const amqp = require('amqplib');

// Import core infrastructure
const { getInstance: getMessageBus } = require('./core/messaging/messageBus');
const { getInstance: getCoordinationService } = require('./core/coordination/coordinationService');
const { getInstance: getSharedDataStore } = require('./core/data/sharedDataStore');
const { getInstance: getErrorHandlingService } = require('./core/error');
const { withErrorHandling } = require('./core/error');

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

// Service and agent instances
let services = {};
let agents = {};

// Initialize services and agents
async function initialize() {
  try {
    // Load configuration
    const config = await ConfigLoader.load();
    logger.info('Configuration loaded successfully');
    
    // Initialize core infrastructure
    services.messageBus = await getMessageBus();
    logger.info('Message Bus initialized');
    
    services.sharedDataStore = await getSharedDataStore();
    logger.info('Shared Data Store initialized');
    
    services.errorHandling = await getErrorHandlingService();
    logger.info('Error Handling Service initialized');
    
    services.coordinationService = await getCoordinationService();
    logger.info('Coordination Service initialized');
    
    // Initialize PostgreSQL and database service
    const DatabaseService = require('./common/services/databaseService');
    
    // Configure database from environment config
    const env = process.env.NODE_ENV || 'development';
    const dbConfig = config.database.postgres;
    
    // Initialize database service
    services.database = new DatabaseService(dbConfig);
    await services.database.connect();
    logger.info('Connected to PostgreSQL and database service initialized');
    
    // Initialize health monitoring service
    const { getInstance: getHealthMonitoringService } = require('./core/monitoring/healthMonitoringService');
    services.healthMonitoring = await getHealthMonitoringService(services.database.sequelize);
    logger.info('Health monitoring service initialized');
    
    // Initialize storage service
    services.storage = new StorageService(services.database.models);
    logger.info('Storage service initialized');
    
    // Initialize AI provider service
    services.aiProvider = new AIProviderService({
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
        services.messageBus,
        services.storage,
        logger.child({ agent: 'content_strategy' }),
        services.aiProvider
      ),
      
      contentCreation: new ContentCreationAgent(
        config.agents.content_creation,
        services.messageBus,
        services.storage,
        logger.child({ agent: 'content_creation' }),
        services.aiProvider
      ),
      
      contentManagement: new ContentManagementAgent(
        config.agents.content_management,
        services.messageBus,
        services.storage,
        logger.child({ agent: 'content_management' }),
        services.aiProvider
      ),
      
      optimisation: new OptimisationAgent(
        config.agents.optimisation,
        services.messageBus,
        services.storage,
        logger.child({ agent: 'optimisation' }),
        services.aiProvider
      ),
      
      brandConsistency: new BrandConsistencyAgent(
        config.agents.brand_consistency,
        services.messageBus,
        services.storage,
        logger.child({ agent: 'brand_consistency' }),
        services.aiProvider
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
    setupGracefulShutdown();
    
  } catch (error) {
    logger.error('Error initializing system:', error);
    process.exit(1);
  }
}

// Initialize web server for admin interface and API
function initializeWebServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  
  // Import security middlewares
  const security = require('./api/middleware/security');
  const cookieParser = require('cookie-parser');
  const session = require('express-session');
  const { rateLimit } = require('express-rate-limit');
  
  // Configure middleware
  // Apply Helmet with enhanced security settings 
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' && process.env.DISABLE_CSP !== 'true',
    xssFilter: true,
    noSniff: true,
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true
    },
    frameguard: {
      action: 'deny'
    }
  }));
  
  // Configure CORS with more options
  app.use(cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : (process.env.NODE_ENV === 'production' ? false : '*'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-API-Key'],
    exposedHeaders: ['X-New-Access-Token', 'X-New-Refresh-Token'],
    credentials: true,
    maxAge: 86400 // 24 hours in seconds
  }));
  
  // Parse cookies
  app.use(cookieParser(process.env.COOKIE_SECRET));
  
  // Configure sessions with secure settings
  const pgSession = require('connect-pg-simple')(session);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'session-secret',
    name: 'landing-pad-session',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    rolling: true,
    resave: false,
    saveUninitialized: false,
    store: new pgSession({
      conString: services.database.sequelize.config.database,
      tableName: 'sessions',
      ttl: 24 * 60 * 60 // 24 hours in seconds
    })
  }));
  
  // Configure body parsing with limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  
  // Apply rate limiting
  app.use(security.advancedRateLimit);
  
  // Prevent NoSQL injection
  app.use(security.sanitizeInputs);
  
  // Prevent XSS attacks
  app.use(security.preventXss);
  
  // Apply custom Content Security Policy middleware for additional control
  app.use(security.contentSecurityPolicy);
  
  // Apply CSRF protection to non-API routes
  app.use(/^(?!\/api\/).*$/, security.csrfProtection, security.setCsrfToken);
  
  // Configure request logging
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim())
    }
  }));
  
  // Make agent container available to API routes
  app.locals.agentContainer = {
    agents,
    storage: services.storage,
    messaging: services.messageBus,
    aiProvider: services.aiProvider,
    logger
  };
  
  // Static files for admin interface
  app.use('/admin', express.static('public/admin'));
  
  // API routes
  app.use('/api', require('./api/routes'));
  
  // Global error handler using our error handling service
  app.use(async (err, req, res, next) => {
    const errorResponse = await services.errorHandling.handleError(err, {
      source: 'api',
      path: req.path,
      method: req.method
    });
    
    res.status(err.status || 500).json(errorResponse);
  });
  
  // Start server
  app.listen(port, () => {
    logger.info(`Web server running on port ${port}`);
  });
}

// Set up graceful shutdown
function setupGracefulShutdown() {
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
    
    // Close coordination service
    if (services.coordinationService) {
      try {
        await services.coordinationService.shutdown();
        logger.info('Coordination service shut down');
      } catch (error) {
        logger.error('Error shutting down coordination service:', error);
      }
    }
    
    // Close message bus connection
    if (services.messageBus) {
      try {
        await services.messageBus.close();
        logger.info('Message bus connection closed');
      } catch (error) {
        logger.error('Error closing message bus connection:', error);
      }
    }
    
    // Close shared data store connection
    if (services.sharedDataStore) {
      try {
        await services.sharedDataStore.close();
        logger.info('Shared data store connection closed');
      } catch (error) {
        logger.error('Error closing shared data store connection:', error);
      }
    }
    
    // Close health monitoring service
    if (services.healthMonitoring) {
      try {
        await services.healthMonitoring.close();
        logger.info('Health monitoring service stopped');
      } catch (error) {
        logger.error('Error stopping health monitoring service:', error);
      }
    }
    
    // Close database connection
    if (services.database) {
      try {
        await services.database.disconnect();
        logger.info('Database service disconnected');
      } catch (error) {
        logger.error('Error disconnecting database service:', error);
      }
    }
    
    logger.info('Shutdown complete');
    process.exit(0);
  };
  
  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions and unhandled rejections using our error handling service
  process.on('uncaughtException', async (error) => {
    try {
      await services.errorHandling.handleError(error, { source: 'uncaughtException' });
    } catch (handlingError) {
      logger.error('Error handling uncaught exception:', handlingError);
    }
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    try {
      await services.errorHandling.handleError(reason, { 
        source: 'unhandledRejection',
        promise: promise.toString()
      });
    } catch (handlingError) {
      logger.error('Error handling unhandled rejection:', handlingError);
    }
    shutdown('unhandledRejection');
  });
}

// Start the system using error handling wrapper
const safeInitialize = withErrorHandling(initialize, {
  context: { operation: 'system_startup' }
});

safeInitialize();