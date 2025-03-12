/**
 * Unit tests for Agent CLI
 */

// Mock dependencies
jest.mock('commander', () => {
  return {
    program: {
      name: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      version: jest.fn().mockReturnThis(),
      command: jest.fn().mockReturnValue({
        description: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
        action: jest.fn().mockReturnThis()
      }),
      parse: jest.fn(),
      outputHelp: jest.fn()
    }
  };
});

jest.mock('inquirer', () => {
  return {
    prompt: jest.fn()
  };
});

jest.mock('chalk', () => {
  return {
    green: jest.fn(text => text),
    red: jest.fn(text => text),
    cyan: jest.fn(text => text),
    yellow: jest.fn(text => text),
    white: jest.fn(text => text)
  };
});

jest.mock('ora', () => {
  return jest.fn().mockReturnValue({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis()
  });
});

jest.mock('../../../src/core/AgentInterface', () => {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getAvailableAgentTypes: jest.fn().mockReturnValue(['content_creation', 'brand_consistency', 'optimisation']),
    getAvailableWorkflows: jest.fn().mockResolvedValue([
      { type: 'content-creation', name: 'Content Creation Workflow' }
    ]),
    generateContent: jest.fn(),
    startWorkflow: jest.fn(),
    getWorkflowStatus: jest.fn(),
    listActiveWorkflows: jest.fn()
  };
});

// Import CLI code to test
require('../../../src/cli/agent-cli');

// Get the mocked dependencies for assertions
const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const AgentInterface = require('../../../src/core/AgentInterface');

describe('Agent CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should configure the commander program correctly', () => {
    expect(program.name).toHaveBeenCalled();
    expect(program.description).toHaveBeenCalled();
    expect(program.version).toHaveBeenCalled();
    expect(program.command).toHaveBeenCalledWith('list-agents');
    expect(program.command).toHaveBeenCalledWith('list-workflows');
    expect(program.command).toHaveBeenCalledWith('generate-content');
    expect(program.command).toHaveBeenCalledWith('run-workflow');
    expect(program.command).toHaveBeenCalledWith('check-workflow');
    expect(program.command).toHaveBeenCalledWith('list-active-workflows');
    expect(program.command).toHaveBeenCalledWith('generate-social');
  });

  describe('list-agents command', () => {
    it('should list available agent types', async () => {
      // Get the action callback
      const actionCallback = program.command().action.mock.calls[0][0];
      
      // Execute the action
      console.log = jest.fn();
      await actionCallback();
      
      // Assert
      expect(AgentInterface.initialize).toHaveBeenCalled();
      expect(AgentInterface.getAvailableAgentTypes).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(chalk.green('\nAvailable agent types:'));
      expect(console.log).toHaveBeenCalledWith('  - content-creation');
      expect(console.log).toHaveBeenCalledWith('  - brand-consistency');
      expect(console.log).toHaveBeenCalledWith('  - optimisation');
      expect(AgentInterface.shutdown).toHaveBeenCalled();
    });
  });

  describe('generate-content command', () => {
    it('should prompt for content details and generate content', async () => {
      // Setup mocks
      inquirer.prompt.mockResolvedValueOnce({ topic: 'Test Topic' });
      AgentInterface.generateContent.mockResolvedValueOnce({
        content_id: 'test-content-123',
        title: 'Test Content',
        content: 'Test content body',
        meta_description: 'Test meta description'
      });
      
      // Get the action callback
      const actionCallback = program.command().action.mock.calls[2][0];
      
      // Execute the action with options
      console.log = jest.fn();
      await actionCallback({ type: 'blog' });
      
      // Assert
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(AgentInterface.generateContent).toHaveBeenCalledWith({
        type: 'blog',
        topic: 'Test Topic',
        keywords: [],
        target_audience: 'Small business owners and entrepreneurs'
      });
      expect(ora().start).toHaveBeenCalledWith('Generating content...');
      expect(ora().succeed).toHaveBeenCalledWith('Content generated successfully!');
      expect(console.log).toHaveBeenCalledWith(chalk.green('\nGenerated Content:'));
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('\nContent ID:'), 'test-content-123');
    });
  });

  describe('run-workflow command', () => {
    it('should start a workflow with the provided details', async () => {
      // Setup mocks
      inquirer.prompt
        .mockResolvedValueOnce({ workflowType: 'content-creation' })
        .mockResolvedValueOnce({ 
          contentType: 'blog', 
          topic: 'Test Topic' 
        });
      
      AgentInterface.startWorkflow.mockResolvedValueOnce({
        workflowId: 'test-workflow-123',
        status: 'started',
        initialState: 'initial-state'
      });
      
      // Get the action callback
      const actionCallback = program.command().action.mock.calls[3][0];
      
      // Execute the action with options
      console.log = jest.fn();
      await actionCallback({ interactive: true });
      
      // Assert
      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      expect(AgentInterface.startWorkflow).toHaveBeenCalledWith('content-creation', {
        brief: {
          type: 'blog',
          topic: 'Test Topic'
        },
        contentType: 'blog'
      });
      expect(ora().start).toHaveBeenCalledWith('Running workflow: content-creation');
      expect(ora().succeed).toHaveBeenCalledWith('Workflow started successfully!');
      expect(console.log).toHaveBeenCalledWith(chalk.green('\nWorkflow Information:'));
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('\nWorkflow ID:'), 'test-workflow-123');
    });
  });

  describe('check-workflow command', () => {
    it('should fetch and display workflow status', async () => {
      // Setup mocks
      const workflowId = 'test-workflow-123';
      
      AgentInterface.getWorkflowStatus.mockResolvedValueOnce({
        exists: true,
        status: 'running',
        currentState: 'content-generation',
        history: [
          { timestamp: new Date().toISOString(), fromState: 'start', toState: 'brief-creation' },
          { timestamp: new Date().toISOString(), fromState: 'brief-creation', toState: 'content-generation' }
        ]
      });
      
      // Get the action callback
      const actionCallback = program.command().action.mock.calls[4][0];
      
      // Execute the action with options
      console.log = jest.fn();
      await actionCallback({ id: workflowId });
      
      // Assert
      expect(AgentInterface.getWorkflowStatus).toHaveBeenCalledWith(workflowId);
      expect(ora().start).toHaveBeenCalledWith('Checking workflow status...');
      expect(ora().succeed).toHaveBeenCalledWith('Workflow status retrieved!');
      expect(console.log).toHaveBeenCalledWith(chalk.green('\nWorkflow Status:'));
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('Status: running'));
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('Current State: content-generation'));
      expect(console.log).toHaveBeenCalledWith(chalk.green('\nWorkflow History:'));
    });
  });

  describe('generate-social command', () => {
    it('should generate social media content', async () => {
      // Setup mocks
      inquirer.prompt.mockResolvedValueOnce({ 
        topic: 'Test Topic',
        platforms: ['linkedin', 'twitter']
      });
      
      AgentInterface.generateContent.mockResolvedValueOnce({
        content_id: 'test-social-123',
        content: {
          posts: {
            linkedin: { content: 'LinkedIn post content', hashtags: ['test'] },
            twitter: { content: 'Twitter post content', hashtags: ['test'] }
          }
        }
      });
      
      // Get the action callback
      const actionCallback = program.command().action.mock.calls[6][0];
      
      // Execute the action with options
      console.log = jest.fn();
      await actionCallback({ });
      
      // Assert
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(AgentInterface.generateContent).toHaveBeenCalledWith({
        type: 'social',
        topic: 'Test Topic',
        platforms: ['linkedin', 'twitter']
      });
      expect(ora().start).toHaveBeenCalledWith('Generating social media content...');
      expect(ora().succeed).toHaveBeenCalledWith('Social media content generated successfully!');
      expect(console.log).toHaveBeenCalledWith(chalk.green('\nGenerated Social Media Content:'));
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('\n=== LINKEDIN ==='));
      expect(console.log).toHaveBeenCalledWith(chalk.cyan('\n=== TWITTER ==='));
    });
  });
});