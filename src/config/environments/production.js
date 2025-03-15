/**
 * Production environment configuration for Landing Pad Digital AI Content Agents
 */

module.exports = {
  // Database specific settings for production
  database: {
    postgres: {
      url: process.env.PROD_DB_URL,
      username: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASSWORD,
      host: process.env.PROD_DB_HOST,
      port: parseInt(process.env.PROD_DB_PORT || '5432', 10),
      database: process.env.PROD_DB_NAME,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      pool: {
        max: 50,
        min: 10,
        acquire: 30000,
        idle: 10000
      }
    }
  },
  
  // Storage specific settings for production
  storage: {
    s3: {
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET_PROD || 'landing-pad-ai-agents',
      storagePrefix: process.env.S3_STORAGE_PREFIX || 'storage',
      uploadsPrefix: process.env.S3_UPLOADS_PREFIX || 'uploads'
    }
  },
  
  // Server specific settings
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  
  // Logging specific settings
  logging: {
    level: 'warn', // Only log warnings and errors in production
    format: 'json',
    logToFile: true,
    logFilePath: '/var/log/landing-pad-ai-agents'
  },
  
  // API specific settings
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // Limit each IP to 100 requests per windowMs
    }
  },
  
  // Messaging specific settings
  messaging: {
    url: process.env.RABBITMQ_URL,
    prefetch: 10,
    heartbeat: 60
  },
  
  // Redis cache settings
  cache: {
    redis: {
      url: process.env.REDIS_PROD_URL,
      ttl: 3600 // 1 hour default TTL
    }
  },
  
  // Monitoring specific settings
  monitoring: {
    health: {
      checkInterval: 60000, // Check health every minute
      timeout: 5000 // Health check timeout (5 seconds)
    },
    performance: {
      sampleRate: 0.1 // Sample 10% of requests for performance metrics
    }
  },
  
  // Security specific settings
  security: {
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://landingpaddigital.com'],
    contentSecurityPolicy: true,
    xssProtection: true
  }
};