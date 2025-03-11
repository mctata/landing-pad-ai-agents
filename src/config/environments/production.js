/**
 * Production environment configuration for Landing Pad Digital AI Content Agents
 */

module.exports = {
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Additional production settings
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxPoolSize: 50,
      minPoolSize: 10
    }
  },
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: '1d'
  },
  logging: {
    level: 'warn', // Only log warnings and errors in production
    format: 'json',
    // Additional production logging options
    logToFile: true,
    logFilePath: '/var/log/landing-pad-ai-agents'
  },
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // Limit each IP to 100 requests per windowMs
    }
  },
  aiProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-opus-20240229'
    }
  },
  messaging: {
    rabbitmq: {
      url: process.env.RABBITMQ_URL,
      exchange: 'landing_pad_agents',
      queues: {
        coordination: 'coordination',
        agentRequests: 'agent_requests',
        notifications: 'notifications'
      },
      // Additional production settings
      prefetch: 10,
      heartbeat: 60
    }
  },
  storage: {
    aws: {
      s3: {
        bucket: process.env.AWS_S3_BUCKET || 'landing-pad-ai-agents-production',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }
  },
  caching: {
    redis: {
      url: process.env.REDIS_URL,
      ttl: 3600 // 1 hour default TTL
    }
  },
  monitoring: {
    health: {
      checkInterval: 60000, // Check health every minute
      timeout: 5000 // Health check timeout (5 seconds)
    },
    performance: {
      sampleRate: 0.1 // Sample 10% of requests for performance metrics
    }
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://landingpaddigital.com'],
    contentSecurityPolicy: true,
    xssProtection: true
  }
};