/**
 * Development environment configuration for Landing Pad Digital AI Content Agents
 */

module.exports = {
  // Database specific settings for development
  database: {
    postgres: {
      url: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/agents_db',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'agents_db',
      ssl: false,
      // Development settings
      logging: true
    }
  },
  
  // Storage specific settings for development
  storage: {
    s3: {
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET_DEV || 'landing-pad-ai-agents-dev',
      storagePrefix: process.env.S3_STORAGE_PREFIX || 'storage',
      uploadsPrefix: process.env.S3_UPLOADS_PREFIX || 'uploads'
    }
  },
  
  // Server specific settings
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  // Logging specific settings
  logging: {
    level: 'debug', // More verbose logging in development
    format: 'pretty',
    logToFile: false
  },
  
  // API specific settings
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // Higher limit for development
    }
  },
  
  // Messaging specific settings
  messaging: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost',
    prefetch: 1,
    heartbeat: 30
  },
  
  // Redis cache settings
  cache: {
    redis: {
      url: process.env.REDIS_LOCAL_URL || 'redis://localhost:6379',
      ttl: 300 // 5 minutes default TTL for development
    }
  },
  
  // Monitoring specific settings
  monitoring: {
    // Health check API port
    healthCheckPort: parseInt(process.env.HEALTH_CHECK_PORT || '3001', 10),
    
    // Dashboard port
    dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3002', 10),
    
    // Health check interval (ms)
    checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    
    // Heartbeat interval (ms)
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    
    // Heartbeat timeout (ms) - time after which an agent is considered unresponsive
    heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '90000', 10),
    
    // Maximum recovery attempts
    maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS || '3', 10),
    
    // Enable auto-recovery
    autoRecovery: process.env.AUTO_RECOVERY !== 'false',
    
    // Metrics retention period (days)
    metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '7', 10),
    
    // Performance sampling rate
    performance: {
      sampleRate: 1.0 // Sample all requests in development
    }
  },
  
  // Security specific settings - relaxed for development
  security: {
    corsOrigins: '*',
    contentSecurityPolicy: false,
    xssProtection: true
  }
};