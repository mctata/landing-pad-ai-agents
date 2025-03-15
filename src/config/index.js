/**
 * Configuration for Landing Pad AI Agents
 * 
 * This module loads configuration based on the current environment (development, test, staging, production)
 * It combines environment-specific configurations with values from .env file
 */

// Load environment variables
require('dotenv').config();

// Determine current environment
const env = process.env.NODE_ENV || 'development';

// Load environment-specific configuration
let envConfig;
try {
  envConfig = require(`./environments/${env}`);
} catch (error) {
  console.warn(`No configuration found for environment '${env}', using development`);
  envConfig = require('./environments/development');
}

// Base configuration (common across all environments)
const baseConfig = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost'
  },
  
  // Database configuration
  database: {
    // PostgreSQL configuration
    postgres: {
      url: process.env.DATABASE_URL,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'agents_db',
      ssl: env === 'production' || env === 'staging'
    }
  },
  
  // Messaging configuration
  messaging: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    queues: {
      commands: 'landing-pad.commands',
      events: 'landing-pad.events'
    },
    exchanges: {
      commands: 'landing-pad.commands',
      events: 'landing-pad.events'
    }
  },
  
  // Storage configuration
  storage: {
    // S3 configuration
    s3: {
      region: process.env.S3_REGION || 'us-east-1',
      bucket: env === 'production' 
        ? (process.env.S3_BUCKET_PROD || 'landing-pad-ai-agents')
        : (process.env.S3_BUCKET_DEV || 'landing-pad-ai-agents-dev'),
      storagePrefix: process.env.S3_STORAGE_PREFIX || 'storage',
      uploadsPrefix: process.env.S3_UPLOADS_PREFIX || 'uploads'
    },
    // PostgreSQL configuration (reusing database config)
    postgres: {
      url: process.env.DATABASE_URL,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'agents_db',
      ssl: env === 'production' || env === 'staging'
    }
  },
  
  // Redis caching configuration
  cache: {
    redis: {
      url: env === 'production'
        ? process.env.REDIS_PROD_URL
        : (env === 'development' ? process.env.REDIS_DEV_URL : process.env.REDIS_LOCAL_URL) || 'redis://localhost:6379',
      ttl: parseInt(process.env.REDIS_TTL || '3600', 10) // Default 1 hour TTL
    }
  },
  
  // AI providers configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'
    }
  },
  
  // Authentication configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret: process.env.JWT_REFRESH_SECRET, 
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Security configuration
  security: {
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'],
    csrfSecret: process.env.CSRF_TOKEN_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
    }
  }
};

// Merge base config with environment-specific config
const config = {
  ...baseConfig,
  ...envConfig,
  env // Include the current environment name in the config
};

module.exports = config;