/**
 * Test environment configuration for Landing Pad Digital AI Content Agents
 */

module.exports = {
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/landing_pad_ai_agents_test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret',
    jwtExpiresIn: '1h'
  },
  logging: {
    level: 'error', // Only log errors in test environment
    format: 'simple'
  },
  api: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000 // Higher limit for testing
    }
  },
  aiProviders: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || 'test-openai-key',
      model: 'gpt-3.5-turbo'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-anthropic-key',
      model: 'claude-3-haiku-20240307'
    }
  },
  messaging: {
    rabbitmq: {
      url: process.env.RABBITMQ_URL || 'amqp://localhost',
      exchange: 'landing_pad_agents_test',
      queues: {
        coordination: 'coordination_test',
        agentRequests: 'agent_requests_test',
        notifications: 'notifications_test'
      }
    },
    // For testing without actual RabbitMQ
    mockMessaging: true
  },
  storage: {
    aws: {
      s3: {
        bucket: 'landing-pad-ai-agents-test',
        region: 'us-east-1'
      }
    },
    // For testing without actual S3
    mockStorage: true
  },
  monitoring: {
    health: {
      checkInterval: 10000, // More frequent checks in test
      timeout: 2000 // Shorter timeout for tests
    }
  }
};