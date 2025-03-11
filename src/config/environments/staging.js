/**
 * Staging environment configuration for Landing Pad Digital AI Content Agents
 */

module.exports = {
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/landing_pad_ai_agents_staging',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
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
    level: 'info',
    format: 'json'
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
      model: 'claude-3-sonnet-20240229'
    }
  },
  messaging: {
    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://localhost',
      exchange: 'landing_pad_agents',
      queues: {
        coordination: 'coordination',
        agentRequests: 'agent_requests',
        notifications: 'notifications'
      }
    }
  },
  storage: {
    aws: {
      s3: {
        bucket: process.env.AWS_S3_BUCKET || 'landing-pad-ai-agents-staging',
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }
  },
  monitoring: {
    health: {
      checkInterval: 60000, // Check health every minute
      timeout: 5000 // Health check timeout (5 seconds)
    }
  }
};