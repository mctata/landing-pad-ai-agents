#!/usr/bin/env node
// src/cli/index.js

const { program } = require('commander');
const inquirer = require('inquirer');
const { getInstance: getMessageBus } = require('../core/messaging/messageBus');
const { getInstance: getCoordinationService } = require('../core/coordination/coordinationService');
const { getInstance: getSharedDataStore } = require('../core/data/sharedDataStore');
const pkg = require('../../package.json');
const logger = require('../core/utils/logger');

// Initialize services
let messageBus, coordinationService, sharedDataStore;

// Initialize the CLI
async function initCLI() {
  try {
    messageBus = await getMessageBus();
    coordinationService = await getCoordinationService();
    sharedDataStore = await getSharedDataStore();
    logger.info('CLI initialized');
  } catch (error) {
    console.error('Failed to initialize CLI:', error.message);
    process.exit(1);
  }
}

// Command: Start a workflow
program
  .command('workflow:start <type>')
  .description('Start a new workflow of the specified type')
  .option('-c, --content-id <id>', 'Content ID for the workflow')
  .option('-d, --data <json>', 'JSON data for the workflow', '{}')
  .action(async (type, options) => {
    await initCLI();
    
    try {
      // Parse data
      const workflowData = JSON.parse(options.data);
      
      // Add content ID if provided
      if (options.contentId) {
        workflowData.contentId = options.contentId;
      }
      
      // Start the workflow
      const result = await coordinationService.startWorkflow(type, workflowData);
      
      console.log('Workflow started:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Failed to start workflow:', error.message);
    } finally {
      // Don't exit, as the workflow might be running asynchronously
    }
  });

// Command: Get workflow status
program
  .command('workflow:status <id>')
  .description('Get the status of a workflow')
  .action(async (id) => {
    await initCLI();
    
    try {
      const status = await coordinationService.getWorkflowStatus(id);
      
      if (!status.exists) {
        console.log(`Workflow ${id} not found`);
        return;
      }
      
      console.log('Workflow status:');
      console.log(JSON.stringify(status, null, 2));
    } catch (error) {
      console.error('Failed to get workflow status:', error.message);
    } finally {
      process.exit(0);
    }
  });

// Command: List active workflows
program
  .command('workflow:list')
  .description('List active workflows')
  .action(async () => {
    await initCLI();
    
    try {
      const workflows = await coordinationService.listActiveWorkflows();
      
      if (workflows.length === 0) {
        console.log('No active workflows');
        return;
      }
      
      console.log(`${workflows.length} active workflows:`);
      
      workflows.forEach((workflow) => {
        console.log(
          `ID: ${workflow.id} | Type: ${workflow.type} | State: ${workflow.currentState} | Started: ${workflow.startTime.toISOString()}`
        );
      });
    } catch (error) {
      console.error('Failed to list workflows:', error.message);
    } finally {
      process.exit(0);
    }
  });

// Command: Create content
program
  .command('content:create')
  .description('Create new content')
  .action(async () => {
    await initCLI();
    
    try {
      // Interactive prompt for content details
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'title',
          message: 'Content title:',
          validate: (input) => input.trim() !== '' || 'Title is required'
        },
        {
          type: 'input',
          name: 'description',
          message: 'Content description:'
        },
        {
          type: 'list',
          name: 'contentType',
          message: 'Content type:',
          choices: ['article', 'blog-post', 'social-media', 'product-description', 'other']
        },
        {
          type: 'input',
          name: 'tags',
          message: 'Tags (comma-separated):',
          filter: (input) => input.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
        },
        {
          type: 'confirm',
          name: 'startWorkflow',
          message: 'Start content creation workflow?',
          default: true
        }
      ]);
      
      // Create the content
      const contentId = await sharedDataStore.createContent({
        title: answers.title,
        description: answers.description,
        contentType: answers.contentType,
        tags: answers.tags,
        createdBy: 'cli-user'
      });
      
      console.log(`Content created with ID: ${contentId}`);
      
      // Start workflow if requested
      if (answers.startWorkflow) {
        const result = await coordinationService.startWorkflow('content-creation', { contentId });
        console.log('Workflow started:');
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('Failed to create content:', error.message);
    } finally {
      // Don't exit if a workflow was started
      if (!program.startWorkflow) {
        process.exit(0);
      }
    }
  });

// Command: Search content
program
  .command('content:search')
  .description('Search for content')
  .option('-t, --type <type>', 'Content type')
  .option('-s, --status <status>', 'Content status')
  .option('-q, --query <text>', 'Search text')
  .option('-l, --limit <number>', 'Result limit', '10')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (options) => {
    await initCLI();
    
    try {
      const query = {};
      
      if (options.type) {
        query.contentType = options.type;
      }
      
      if (options.status) {
        query.status = options.status;
      }
      
      if (options.query) {
        query.text = options.query;
      }
      
      if (options.tags) {
        query.tags = options.tags.split(',').map(tag => tag.trim());
      }
      
      const searchOptions = {
        limit: parseInt(options.limit, 10),
        skip: 0
      };
      
      const results = await sharedDataStore.searchContent(query, searchOptions);
      
      console.log(`Found ${results.total} content items:`);
      
      if (results.total === 0) {
        console.log('No content found matching the criteria');
        return;
      }
      
      results.results.forEach((content) => {
        console.log(
          `ID: ${content.contentId} | Title: ${content.title} | Type: ${content.contentType} | Status: ${content.status}`
        );
      });
      
      console.log(`\nPage ${results.page} of ${results.pages}`);
    } catch (error) {
      console.error('Failed to search content:', error.message);
    } finally {
      process.exit(0);
    }
  });

// Command: Get content details
program
  .command('content:get <id>')
  .description('Get content details')
  .option('-v, --version <number>', 'Content version')
  .action(async (id, options) => {
    await initCLI();
    
    try {
      let content;
      
      if (options.version) {
        content = await sharedDataStore.getContentVersion(id, parseInt(options.version, 10));
        console.log(`Content ${id} (version ${options.version}):`);
      } else {
        content = await sharedDataStore.getContent(id);
        console.log(`Content ${id} (current version):`);
      }
      
      if (!content) {
        console.log(`Content ${id} not found`);
        return;
      }
      
      console.log(JSON.stringify(content, null, 2));
    } catch (error) {
      console.error('Failed to get content:', error.message);
    } finally {
      process.exit(0);
    }
  });

// Command: Send a message to an agent
program
  .command('agent:send <agent> <command>')
  .description('Send a command to an agent')
  .option('-d, --data <json>', 'JSON data for the command', '{}')
  .action(async (agent, command, options) => {
    await initCLI();
    
    try {
      // Parse data
      const commandData = JSON.parse(options.data);
      
      // Construct routing key
      const routingKey = `${agent}.${command}`;
      
      // Send the command
      await messageBus.publishCommand(routingKey, commandData);
      
      console.log(`Command sent to ${agent}: ${command}`);
    } catch (error) {
      console.error('Failed to send command:', error.message);
    } finally {
      // Don't exit immediately as the command might trigger async operations
      setTimeout(() => process.exit(0), 1000);
    }
  });

// Command: Monitor message bus
program
  .command('monitor [type]')
  .description('Monitor messages on the message bus')
  .option('-r, --routing <pattern>', 'Routing pattern (e.g., "content.*")', '#')
  .option('-t, --timeout <seconds>', 'Monitoring timeout in seconds', '60')
  .action(async (type = 'events', options) => {
    await initCLI();
    
    const timeoutMs = parseInt(options.timeout, 10) * 1000;
    console.log(`Monitoring ${type} with routing pattern "${options.routing}" for ${options.timeout} seconds...`);
    console.log('Press Ctrl+C to stop');
    
    let subscription;
    try {
      // Subscribe to messages
      const messageHandler = (data, metadata) => {
        console.log('\nNew message:');
        console.log('Metadata:', JSON.stringify(metadata, null, 2));
        console.log('Data:', JSON.stringify(data, null, 2));
      };
      
      switch (type) {
        case 'commands':
          subscription = await messageBus.subscribeToCommand(options.routing, messageHandler);
          break;
        case 'events':
          subscription = await messageBus.subscribeToEvent(options.routing, messageHandler);
          break;
        case 'queries':
          subscription = await messageBus.subscribeToQuery(options.routing, messageHandler);
          break;
        default:
          console.error(`Unknown message type: ${type}`);
          process.exit(1);
      }
      
      // Set timeout if specified
      if (timeoutMs > 0) {
        setTimeout(() => {
          console.log('\nMonitoring timeout reached');
          subscription.unsubscribe().then(() => process.exit(0));
        }, timeoutMs);
      }
    } catch (error) {
      console.error('Failed to start monitoring:', error.message);
      process.exit(1);
    }
  });

// Command: System status
program
  .command('status')
  .description('Show system status')
  .action(async () => {
    await initCLI();
    
    try {
      // Get active workflows
      const workflows = await coordinationService.listActiveWorkflows();
      
      console.log('System Status:');
      console.log('Message Bus:', 'Connected');
      console.log('Coordination Service:', 'Running');
      console.log('Shared Data Store:', 'Connected');
      console.log('Active Workflows:', workflows.length);
      
      // Get statistics if possible
      try {
        const contentCount = await sharedDataStore.searchContent({}, { limit: 0 }).then(res => res.total);
        console.log('Total Content Items:', contentCount);
      } catch (error) {
        // Ignore
      }
    } catch (error) {
      console.error('Failed to get system status:', error.message);
    } finally {
      process.exit(0);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command was specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
