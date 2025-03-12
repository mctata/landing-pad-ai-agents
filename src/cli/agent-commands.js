#!/usr/bin/env node

/**
 * CLI Agent Commands
 * 
 * Command-line interface for managing and interacting with AI agents
 */

const { program } = require('commander');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import agent classes
const ContentStrategyAgent = require('../agents/content_strategy');
const ContentCreationAgent = require('../agents/content_creation');
const ContentManagementAgent = require('../agents/content_management');
const OptimisationAgent = require('../agents/optimisation');
const BrandConsistencyAgent = require('../agents/brand_consistency');

// Import services
const ConfigService = require('../../services/ConfigService');
const LoggerService = require('../../services/LoggerService');
const StorageService = require('../../services/StorageService');
const AIProviderService = require('../../services/AIProviderService');
const MessagingService = require('../../services/MessagingService');

// Create logger
const logger = new LoggerService({
  level: process.env.LOG_LEVEL || 'info',
  prefix: 'CLI'
});

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    // Load configuration
    const configService = new ConfigService();
    await configService.load();
    const config = configService.getConfig();

    // Initialize services
    const storageService = new StorageService();
    await storageService.initialize();

    const aiProviderService = new AIProviderService({
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG_ID
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY
      }
    }, logger);

    const messagingService = new MessagingService(config.messaging);
    await messagingService.initialize();

    return {
      config,
      storageService,
      aiProviderService,
      messagingService
    };
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

/**
 * Create agent instance
 */
function createAgent(agentType, services) {
  const { config, storageService, aiProviderService, messagingService } = services;
  const agentConfig = config.agents[agentType];

  switch (agentType) {
    case 'content_strategy':
      return new ContentStrategyAgent(
        agentConfig,
        messagingService,
        storageService,
        logger.createChild({ agent: 'content_strategy' }),
        aiProviderService
      );
    case 'content_creation':
      return new ContentCreationAgent(
        agentConfig,
        messagingService,
        storageService,
        logger.createChild({ agent: 'content_creation' }),
        aiProviderService
      );
    case 'content_management':
      return new ContentManagementAgent(
        agentConfig,
        messagingService,
        storageService,
        logger.createChild({ agent: 'content_management' }),
        aiProviderService
      );
    case 'optimisation':
      return new OptimisationAgent(
        agentConfig,
        messagingService,
        storageService,
        logger.createChild({ agent: 'optimisation' }),
        aiProviderService
      );
    case 'brand_consistency':
      return new BrandConsistencyAgent(
        agentConfig,
        messagingService,
        storageService,
        logger.createChild({ agent: 'brand_consistency' }),
        aiProviderService
      );
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

/**
 * Run agent command
 */
async function runAgentCommand(agentType, command, options) {
  try {
    logger.info(`Initializing ${agentType} agent`);

    // Initialize services
    const services = await initializeServices();

    // Create agent
    const agent = createAgent(agentType, services);

    // Initialize agent
    await agent.initialize();
    logger.info(`${agentType} agent initialized`);

    // Run specific command
    switch (command) {
      case 'start':
        logger.info(`Starting ${agentType} agent`);
        await agent.start();
        logger.info(`${agentType} agent started`);
        
        // Keep process alive until Ctrl+C
        logger.info('Press Ctrl+C to stop the agent');
        process.on('SIGINT', async () => {
          logger.info('Stopping agent...');
          await agent.stop();
          process.exit(0);
        });
        break;

      case 'stop':
        logger.info(`Stopping ${agentType} agent`);
        await agent.stop();
        logger.info(`${agentType} agent stopped`);
        process.exit(0);
        break;

      case 'status':
        const status = await agent.getStatus();
        logger.info(`${agentType} agent status:`, status);
        process.exit(0);
        break;

      case 'interactive':
        logger.info(`Starting interactive session with ${agentType} agent`);
        await startInteractiveSession(agent, agentType);
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    logger.error(`Error running command:`, error);
    process.exit(1);
  }
}

/**
 * Start interactive session with the agent
 */
async function startInteractiveSession(agent, agentType) {
  logger.info('Interactive session started. Type "exit" to quit.');
  logger.info('Enter your requests:');

  // Start the agent
  await agent.start();

  const askQuestion = () => {
    rl.question('> ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        logger.info('Ending session...');
        await agent.stop();
        rl.close();
        process.exit(0);
        return;
      }

      try {
        // Process the input through the agent
        logger.info(`Processing request through ${agentType} agent...`);
        
        const response = await agent.processDirectRequest({
          type: 'cli_request',
          payload: {
            input,
            requestId: Date.now().toString(),
            source: 'cli',
            timestamp: new Date().toISOString()
          }
        });

        logger.info('Agent response:');
        console.log('\n---------------------------------------------------');
        console.log(response.payload.output || response.payload.result || 'No response');
        console.log('---------------------------------------------------\n');

      } catch (error) {
        logger.error('Error processing request:', error);
      }

      // Ask for next input
      askQuestion();
    });
  };

  // Start asking questions
  askQuestion();
}

// Configure CLI program
program
  .version('1.0.0')
  .description('CLI for managing and interacting with Landing Pad AI agents');

program
  .arguments('<agent> [command]')
  .description('Run a command for an agent')
  .option('-i, --interactive', 'Start an interactive session with the agent')
  .action((agent, command = 'interactive', options) => {
    const validAgents = ['content_strategy', 'content_creation', 'content_management', 'optimisation', 'brand_consistency'];
    
    if (!validAgents.includes(agent)) {
      logger.error(`Invalid agent: ${agent}`);
      logger.info(`Valid agents: ${validAgents.join(', ')}`);
      process.exit(1);
    }

    runAgentCommand(agent, command, options);
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, print help
if (program.args.length === 0) {
  program.help();
}