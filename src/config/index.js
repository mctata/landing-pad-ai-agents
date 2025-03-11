/**
 * Configuration for Landing Pad AI Agents
 * 
 * This is a simple configuration module for development.
 * In a real application, this would load configuration from environment variables,
 * configuration files, etc.
 */

// Mock configuration for development
const config = {
  // Messaging configuration
  messaging: {
    uri: process.env.MESSAGING_URI || 'amqp://localhost',
    queues: {
      commands: 'landing-pad.commands',
      events: 'landing-pad.events'
    },
    exchanges: {
      commands: 'landing-pad.commands',
      events: 'landing-pad.events'
    }
  },
  
  // Database configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/landing-pad',
    name: 'landing-pad',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Monitoring configuration
  monitoring: {
    checkInterval: 30000, // 30 seconds
    heartbeatTimeout: 60000 // 60 seconds
  },
  
  // AI providers configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || 'dummy-api-key',
      model: 'gpt-4o'
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || 'dummy-api-key',
      model: 'claude-3-sonnet-20240229'
    }
  }
};

module.exports = config;