/**
 * Unit tests for AgentInterface
 */

// Mock the dependencies before importing the module
jest.mock('../../../src/common/services/logger', () => {
  return {
    getLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })
  };
});

jest.mock('../../../src/common/services/agent-factory', () => {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    createAgent: jest.fn(),
    stopAllAgents: jest.fn().mockResolvedValue(undefined),
    getAvailableAgentTypes: jest.fn().mockReturnValue(['content_creation', 'brand_consistency', 'optimisation'])
  };
});

jest.mock('../../../src/core/coordination/coordinationService', () => {
  return {
    getInstance: jest.fn().mockResolvedValue({
      startWorkflow: jest.fn(),
      getWorkflowStatus: jest.fn(),
      listActiveWorkflows: jest.fn(),
      workflowRegistry: {
        listWorkflows: jest.fn()
      },
      shutdown: jest.fn().mockResolvedValue(undefined)
    })
  };
});

// Import after mocking dependencies
const AgentInterface = require('../../../src/core/AgentInterface');
const agentFactory = require('../../../src/common/services/agent-factory');
const { getInstance: getCoordinationService } = require('../../../src/core/coordination/coordinationService');

describe('AgentInterface', () => {
  // Mock agent and command result
  const mockAgent = {
    handleCommand: jest.fn()
  };

  // Coordination service mock
  let mockCoordinationService;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock agent
    agentFactory.createAgent.mockResolvedValue(mockAgent);
    
    // Setup mock command result
    mockAgent.handleCommand.mockResolvedValue({
      status: 'success',
      content_id: 'mock-content-123',
      content: { title: 'Test Content', body: 'Test body' }
    });

    // Setup mock coordination service
    mockCoordinationService = await getCoordinationService();
    mockCoordinationService.startWorkflow.mockResolvedValue({
      workflowId: 'mock-workflow-123',
      status: 'started',
      initialState: 'initial-state'
    });
    mockCoordinationService.getWorkflowStatus.mockResolvedValue({
      exists: true,
      status: 'running',
      currentState: 'test-state',
      history: []
    });
    mockCoordinationService.listActiveWorkflows.mockResolvedValue([
      {
        id: 'mock-workflow-123',
        type: 'content-creation',
        status: 'running',
        currentState: 'test-state',
        startTime: new Date(),
        updatedTime: new Date()
      }
    ]);
    mockCoordinationService.workflowRegistry.listWorkflows.mockReturnValue([
      {
        type: 'content-creation',
        name: 'Content Creation Workflow',
        description: 'End-to-end content creation workflow'
      }
    ]);
    
    // Initialize AgentInterface before each test
    await AgentInterface.initialize();
  });

  afterEach(async () => {
    // Shut down AgentInterface after each test
    await AgentInterface.shutdown();
  });

  it('should initialize correctly', async () => {
    // Assert
    expect(agentFactory.initialize).toHaveBeenCalled();
    expect(getCoordinationService).toHaveBeenCalled();
  });

  it('should send command to agent', async () => {
    // Arrange
    const agentType = 'content_creation';
    const commandType = 'generate_content';
    const payload = { topic: 'Test Topic' };

    // Act
    const result = await AgentInterface.sendCommand(agentType, commandType, payload);

    // Assert
    expect(agentFactory.createAgent).toHaveBeenCalledWith(agentType);
    expect(mockAgent.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: commandType,
      payload
    }));
    expect(result).toHaveProperty('status', 'success');
    expect(result).toHaveProperty('content_id', 'mock-content-123');
  });

  it('should start a workflow', async () => {
    // Arrange
    const workflowType = 'content-creation';
    const data = { brief: { topic: 'Test Topic' } };

    // Act
    const result = await AgentInterface.startWorkflow(workflowType, data);

    // Assert
    expect(mockCoordinationService.startWorkflow).toHaveBeenCalledWith(workflowType, data, {});
    expect(result).toHaveProperty('workflowId', 'mock-workflow-123');
    expect(result).toHaveProperty('status', 'started');
  });

  it('should get workflow status', async () => {
    // Arrange
    const workflowId = 'mock-workflow-123';

    // Act
    const result = await AgentInterface.getWorkflowStatus(workflowId);

    // Assert
    expect(mockCoordinationService.getWorkflowStatus).toHaveBeenCalledWith(workflowId);
    expect(result).toHaveProperty('exists', true);
    expect(result).toHaveProperty('status', 'running');
    expect(result).toHaveProperty('currentState', 'test-state');
  });

  it('should list active workflows', async () => {
    // Act
    const result = await AgentInterface.listActiveWorkflows();

    // Assert
    expect(mockCoordinationService.listActiveWorkflows).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('id', 'mock-workflow-123');
    expect(result[0]).toHaveProperty('type', 'content-creation');
  });

  it('should get available agent types', () => {
    // Act
    const result = AgentInterface.getAvailableAgentTypes();

    // Assert
    expect(agentFactory.getAvailableAgentTypes).toHaveBeenCalled();
    expect(result).toEqual(['content_creation', 'brand_consistency', 'optimisation']);
  });

  it('should get available workflows', async () => {
    // Act
    const result = await AgentInterface.getAvailableWorkflows();

    // Assert
    expect(mockCoordinationService.workflowRegistry.listWorkflows).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('type', 'content-creation');
    expect(result[0]).toHaveProperty('name', 'Content Creation Workflow');
  });

  it('should generate content', async () => {
    // Arrange
    const brief = { topic: 'Test Topic', type: 'blog' };

    // Act
    const result = await AgentInterface.generateContent(brief);

    // Assert
    expect(agentFactory.createAgent).toHaveBeenCalledWith('content_creation');
    expect(mockAgent.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'generate_content',
      payload: { overrides: brief }
    }));
    expect(result).toHaveProperty('content_id', 'mock-content-123');
  });

  it('should create content with a workflow', async () => {
    // Arrange
    const brief = { topic: 'Test Topic', type: 'blog' };

    // Act
    const result = await AgentInterface.createContentWithWorkflow(brief);

    // Assert
    expect(mockCoordinationService.startWorkflow).toHaveBeenCalledWith('content-creation', {
      brief,
      contentType: 'blog'
    });
    expect(result).toHaveProperty('workflowId', 'mock-workflow-123');
  });

  it('should optimize content', async () => {
    // Arrange
    const contentId = 'content-123';
    const optimizationGoals = ['seo', 'readability'];

    // Act
    const result = await AgentInterface.optimizeContent(contentId, optimizationGoals);

    // Assert
    expect(mockCoordinationService.startWorkflow).toHaveBeenCalledWith('content-optimization', {
      contentId,
      optimizationGoals
    });
    expect(result).toHaveProperty('workflowId', 'mock-workflow-123');
  });

  it('should check brand consistency', async () => {
    // Arrange
    const contentId = 'content-123';

    // Act
    const result = await AgentInterface.checkBrandConsistency(contentId);

    // Assert
    expect(agentFactory.createAgent).toHaveBeenCalledWith('brand_consistency');
    expect(mockAgent.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'check_content',
      payload: { contentId }
    }));
    expect(result).toHaveProperty('status', 'success');
  });

  it('should generate social content from existing content', async () => {
    // Arrange
    const contentId = 'content-123';
    const platforms = ['linkedin', 'twitter', 'instagram'];

    // Act
    const result = await AgentInterface.generateSocialFromContent(contentId, platforms);

    // Assert
    expect(agentFactory.createAgent).toHaveBeenCalledWith('content_creation');
    expect(mockAgent.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'generate_social',
      payload: { contentId, platforms }
    }));
    expect(result).toHaveProperty('status', 'success');
  });

  it('should generate SEO recommendations', async () => {
    // Arrange
    const contentId = 'content-123';

    // Act
    const result = await AgentInterface.generateSeoRecommendations(contentId);

    // Assert
    expect(agentFactory.createAgent).toHaveBeenCalledWith('optimisation');
    expect(mockAgent.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'generate_seo_recommendations',
      payload: { contentId }
    }));
    expect(result).toHaveProperty('status', 'success');
  });

  it('should create a content brief', async () => {
    // Arrange
    const briefData = { topic: 'Test Topic', contentType: 'blog' };

    // Act
    const result = await AgentInterface.createContentBrief(briefData);

    // Assert
    expect(agentFactory.createAgent).toHaveBeenCalledWith('content_strategy');
    expect(mockAgent.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'create_brief',
      payload: briefData
    }));
    expect(result).toHaveProperty('status', 'success');
  });

  it('should shut down properly', async () => {
    // Act
    await AgentInterface.shutdown();

    // Assert
    expect(agentFactory.stopAllAgents).toHaveBeenCalled();
    expect(mockCoordinationService.shutdown).toHaveBeenCalled();
  });
});