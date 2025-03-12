#!/usr/bin/env node

/**
 * Agent CLI
 * Command-line interface for interacting with agents
 */

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const agentInterface = require('../core/AgentInterface');

// Configure CLI
program
  .name('agent-cli')
  .description('Command-line interface for Landing Pad AI Agents')
  .version('1.0.0');

// Helper to format output
function formatOutput(data) {
  return JSON.stringify(data, null, 2);
}

// List available agent types
program
  .command('list-agents')
  .description('List available agent types')
  .action(async () => {
    try {
      await agentInterface.initialize();
      const agentTypes = agentInterface.getAvailableAgentTypes();
      console.log(chalk.green('\nAvailable agent types:'));
      agentTypes.forEach(type => {
        console.log(`  - ${type.replace(/_/g, '-')}`);
      });
    } catch (error) {
      console.error(chalk.red('Error listing agents:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// List available workflows
program
  .command('list-workflows')
  .description('List available workflows')
  .action(async () => {
    try {
      await agentInterface.initialize();
      const workflows = await agentInterface.getAvailableWorkflows();
      console.log(chalk.green('\nAvailable workflows:'));
      workflows.forEach(workflow => {
        console.log(`  - ${workflow.type}: ${workflow.name}`);
        if (workflow.description) {
          console.log(`    ${workflow.description}`);
        }
      });
    } catch (error) {
      console.error(chalk.red('Error listing workflows:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// Generate content
program
  .command('generate-content')
  .description('Generate content using the content creation agent')
  .option('-t, --type <type>', 'Content type (blog, social, website)', 'blog')
  .option('-i, --interactive', 'Use interactive mode to provide details')
  .action(async (options) => {
    try {
      await agentInterface.initialize();
      
      let brief = {};
      
      if (options.interactive) {
        // Prompt for content details
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'type',
            message: 'What type of content do you want to generate?',
            choices: ['blog', 'social', 'website', 'email', 'landing_page'],
            default: options.type
          },
          {
            type: 'input',
            name: 'topic',
            message: 'Enter the content topic:',
            validate: input => input.trim() !== '' ? true : 'Topic is required'
          },
          {
            type: 'input',
            name: 'keywords',
            message: 'Enter keywords (comma-separated):',
            filter: input => input.split(',').map(k => k.trim()).filter(k => k !== '')
          },
          {
            type: 'input',
            name: 'target_audience',
            message: 'Describe the target audience:',
            default: 'Small business owners and entrepreneurs'
          }
        ]);
        
        brief = answers;
      } else {
        // Prompt for just the topic
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'topic',
            message: 'Enter the content topic:',
            validate: input => input.trim() !== '' ? true : 'Topic is required'
          }
        ]);
        
        brief = {
          type: options.type,
          topic: answers.topic,
          keywords: [],
          target_audience: 'Small business owners and entrepreneurs'
        };
      }
      
      const spinner = ora('Generating content...').start();
      
      const result = await agentInterface.generateContent(brief);
      
      spinner.succeed('Content generated successfully!');
      
      console.log(chalk.green('\nGenerated Content:'));
      if (brief.type === 'blog' || brief.type === 'website') {
        console.log(chalk.cyan(`Title: ${result.title || 'No title'}`));
        console.log(chalk.cyan(`Meta description: ${result.meta_description || 'No meta description'}`));
        console.log(chalk.yellow('\nContent Preview (first 300 chars):'));
        const contentString = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
        console.log(contentString.substring(0, 300) + '...');
      } else {
        console.log(formatOutput(result));
      }
      
      console.log(chalk.cyan('\nContent ID:'), result.content_id);
    } catch (error) {
      console.error(chalk.red('Error generating content:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// Run a workflow
program
  .command('run-workflow')
  .description('Run a workflow')
  .option('-t, --type <type>', 'Workflow type')
  .option('-i, --interactive', 'Use interactive mode to provide details')
  .action(async (options) => {
    try {
      await agentInterface.initialize();
      
      let workflowType = options.type;
      let workflowData = {};
      
      if (!workflowType || options.interactive) {
        // Get available workflows for selection
        const workflows = await agentInterface.getAvailableWorkflows();
        const workflowChoices = workflows.map(w => ({
          name: `${w.name} (${w.type})`,
          value: w.type
        }));
        
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'workflowType',
            message: 'Select a workflow to run:',
            choices: workflowChoices
          }
        ]);
        
        workflowType = answers.workflowType;
        
        // Prompt for additional data based on workflow type
        if (workflowType === 'content-creation') {
          const contentAnswers = await inquirer.prompt([
            {
              type: 'list',
              name: 'contentType',
              message: 'What type of content do you want to create?',
              choices: ['blog', 'social', 'website', 'email', 'landing_page'],
              default: 'blog'
            },
            {
              type: 'input',
              name: 'topic',
              message: 'Enter the content topic:',
              validate: input => input.trim() !== '' ? true : 'Topic is required'
            }
          ]);
          
          workflowData = {
            brief: {
              type: contentAnswers.contentType,
              topic: contentAnswers.topic
            },
            contentType: contentAnswers.contentType
          };
        } else if (workflowType === 'content-optimization') {
          const optimizationAnswers = await inquirer.prompt([
            {
              type: 'input',
              name: 'contentId',
              message: 'Enter the content ID to optimize:',
              validate: input => input.trim() !== '' ? true : 'Content ID is required'
            },
            {
              type: 'checkbox',
              name: 'optimizationGoals',
              message: 'Select optimization goals:',
              choices: ['seo', 'readability', 'engagement', 'conversion'],
              default: ['seo']
            }
          ]);
          
          workflowData = {
            contentId: optimizationAnswers.contentId,
            optimizationGoals: optimizationAnswers.optimizationGoals
          };
        }
      }
      
      const spinner = ora(`Running workflow: ${workflowType}`).start();
      
      const result = await agentInterface.startWorkflow(workflowType, workflowData);
      
      spinner.succeed('Workflow started successfully!');
      
      console.log(chalk.green('\nWorkflow Information:'));
      console.log(formatOutput(result));
      
      console.log(chalk.cyan('\nWorkflow ID:'), result.workflowId);
      console.log(chalk.yellow('\nUse the following command to check workflow status:'));
      console.log(chalk.white(`  agent-cli check-workflow -i ${result.workflowId}`));
    } catch (error) {
      console.error(chalk.red('Error running workflow:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// Check workflow status
program
  .command('check-workflow')
  .description('Check the status of a workflow')
  .option('-i, --id <id>', 'Workflow ID')
  .action(async (options) => {
    try {
      await agentInterface.initialize();
      
      let workflowId = options.id;
      
      if (!workflowId) {
        // Prompt for workflow ID
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'workflowId',
            message: 'Enter the workflow ID:',
            validate: input => input.trim() !== '' ? true : 'Workflow ID is required'
          }
        ]);
        
        workflowId = answers.workflowId;
      }
      
      const spinner = ora('Checking workflow status...').start();
      
      const result = await agentInterface.getWorkflowStatus(workflowId);
      
      spinner.succeed('Workflow status retrieved!');
      
      console.log(chalk.green('\nWorkflow Status:'));
      
      if (!result.exists) {
        console.log(chalk.red('Workflow not found'));
      } else {
        console.log(chalk.cyan(`Status: ${result.status}`));
        console.log(chalk.cyan(`Current State: ${result.currentState}`));
        
        if (result.history && result.history.length > 0) {
          console.log(chalk.green('\nWorkflow History:'));
          result.history.forEach(entry => {
            console.log(chalk.white(`  ${entry.timestamp}: ${entry.fromState || 'start'} -> ${entry.toState || entry.step}`));
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('Error checking workflow status:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// List active workflows
program
  .command('list-active-workflows')
  .description('List all active workflows')
  .action(async () => {
    try {
      await agentInterface.initialize();
      
      const spinner = ora('Retrieving active workflows...').start();
      
      const workflows = await agentInterface.listActiveWorkflows();
      
      spinner.succeed('Active workflows retrieved!');
      
      console.log(chalk.green('\nActive Workflows:'));
      
      if (workflows.length === 0) {
        console.log(chalk.yellow('No active workflows found'));
      } else {
        workflows.forEach(workflow => {
          console.log(chalk.cyan(`ID: ${workflow.id}`));
          console.log(chalk.white(`  Type: ${workflow.type}`));
          console.log(chalk.white(`  Status: ${workflow.status}`));
          console.log(chalk.white(`  Current State: ${workflow.currentState}`));
          console.log(chalk.white(`  Started: ${new Date(workflow.startTime).toLocaleString()}`));
          console.log(chalk.white(`  Last Updated: ${new Date(workflow.updatedTime).toLocaleString()}`));
          console.log();
        });
      }
    } catch (error) {
      console.error(chalk.red('Error listing active workflows:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// Generate social media content
program
  .command('generate-social')
  .description('Generate social media content')
  .option('-t, --topic <topic>', 'Topic for social media content')
  .option('-p, --platforms <platforms>', 'Platforms (comma-separated)', 'linkedin,twitter')
  .action(async (options) => {
    try {
      await agentInterface.initialize();
      
      let topic = options.topic;
      let platforms = options.platforms.split(',').map(p => p.trim());
      
      if (!topic) {
        // Prompt for topic
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'topic',
            message: 'Enter the topic for social media content:',
            validate: input => input.trim() !== '' ? true : 'Topic is required'
          },
          {
            type: 'checkbox',
            name: 'platforms',
            message: 'Select target platforms:',
            choices: ['linkedin', 'twitter', 'facebook', 'instagram'],
            default: ['linkedin', 'twitter']
          }
        ]);
        
        topic = answers.topic;
        platforms = answers.platforms;
      }
      
      const spinner = ora('Generating social media content...').start();
      
      const result = await agentInterface.generateContent({
        type: 'social',
        topic,
        platforms
      });
      
      spinner.succeed('Social media content generated successfully!');
      
      console.log(chalk.green('\nGenerated Social Media Content:'));
      
      for (const [platform, content] of Object.entries(result.content.posts)) {
        console.log(chalk.cyan(`\n=== ${platform.toUpperCase()} ===`));
        console.log(content.content);
        if (content.hashtags && content.hashtags.length > 0) {
          console.log(chalk.yellow('\nHashtags:'), content.hashtags.map(tag => `#${tag}`).join(' '));
        }
      }
      
      console.log(chalk.cyan('\nContent ID:'), result.content_id);
    } catch (error) {
      console.error(chalk.red('Error generating social media content:'), error.message);
    } finally {
      await agentInterface.shutdown();
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}