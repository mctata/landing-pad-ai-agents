/**
 * Unit tests for Agent Model
 */

const mongoose = require('mongoose');
const Agent = require('../../../src/models/agentModel');

describe('Agent Model', () => {
  beforeAll(async () => {
    // Create mongoose connection for testing
    await mongoose.connect(global.__MONGO_URI__ || 'mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear agents collection before each test
    await mongoose.connection.collection('agents').deleteMany({});
  });

  it('should generate a valid agentId', () => {
    // Test without type parameter
    const genericAgentId = Agent.generateAgentId();
    expect(genericAgentId).toBeDefined();
    expect(typeof genericAgentId).toBe('string');
    expect(genericAgentId).toMatch(/^AGT-[A-Z0-9]+$/);
    
    // Test with type parameter
    const contentAgentId = Agent.generateAgentId('content_creation');
    expect(contentAgentId).toMatch(/^CON-[A-Z0-9]+$/);
    
    // Test with another type
    const brandAgentId = Agent.generateAgentId('brand_consistency');
    expect(brandAgentId).toMatch(/^BRA-[A-Z0-9]+$/);
  });

  it('should create a new agent document', async () => {
    // Arrange
    const agentData = {
      agentId: Agent.generateAgentId('content_creation'),
      name: 'Test Agent',
      description: 'A test agent',
      type: 'content_creation',
      modules: [
        {
          name: 'test-module',
          description: 'Test module',
          enabled: true
        }
      ],
      createdBy: 'test-user'
    };

    // Act
    const agent = new Agent(agentData);
    const savedAgent = await agent.save();

    // Assert
    expect(savedAgent._id).toBeDefined();
    expect(savedAgent.agentId).toBe(agentData.agentId);
    expect(savedAgent.name).toBe(agentData.name);
    expect(savedAgent.type).toBe(agentData.type);
    expect(savedAgent.status).toBe('active'); // Default status
    expect(savedAgent.modules).toHaveLength(1);
    expect(savedAgent.modules[0].name).toBe('test-module');
  });

  it('should update agent activity timestamp', async () => {
    // Arrange
    const agentData = {
      agentId: Agent.generateAgentId(),
      name: 'Activity Agent',
      type: 'content_creation',
      createdBy: 'test-user'
    };
    
    // Act - Create agent
    const agent = new Agent(agentData);
    await agent.save();
    
    // Initial lastActivity should be undefined
    expect(agent.lastActivity).toBeUndefined();
    
    // Set a reference point in time
    const beforeUpdate = new Date();
    
    // Wait a small amount to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Update agent activity
    await agent.updateActivity();
    
    // Assert
    expect(agent.lastActivity).toBeDefined();
    expect(agent.lastActivity).toBeInstanceOf(Date);
    expect(agent.lastActivity.getTime()).toBeGreaterThan(beforeUpdate.getTime());
  });

  it('should record request and update performance metrics', async () => {
    // Arrange
    const agentData = {
      agentId: Agent.generateAgentId(),
      name: 'Performance Agent',
      type: 'content_creation',
      createdBy: 'test-user'
    };
    
    // Act - Create agent
    const agent = new Agent(agentData);
    await agent.save();
    
    // Initial metrics should be zeros
    expect(agent.performance.requestsProcessed).toBe(0);
    expect(agent.performance.successfulRequests).toBe(0);
    expect(agent.performance.failedRequests).toBe(0);
    expect(agent.performance.averageResponseTime).toBe(0);
    
    // Record a successful request
    await agent.recordRequest(true, 100);
    
    // Assert after first request
    expect(agent.performance.requestsProcessed).toBe(1);
    expect(agent.performance.successfulRequests).toBe(1);
    expect(agent.performance.failedRequests).toBe(0);
    expect(agent.performance.averageResponseTime).toBe(100);
    
    // Record a failed request
    await agent.recordRequest(false, 200);
    
    // Assert after second request
    expect(agent.performance.requestsProcessed).toBe(2);
    expect(agent.performance.successfulRequests).toBe(1);
    expect(agent.performance.failedRequests).toBe(1);
    expect(agent.performance.averageResponseTime).toBe(150); // Average of 100 and 200
    
    // Record another request with different time
    await agent.recordRequest(true, 300);
    
    // Assert weighted average calculation
    expect(agent.performance.requestsProcessed).toBe(3);
    expect(agent.performance.successfulRequests).toBe(2);
    expect(agent.performance.failedRequests).toBe(1);
    // (150*2 + 300)/3 = 200
    expect(agent.performance.averageResponseTime).toBe(200);
  });

  it('should enforce required fields', async () => {
    // Arrange
    const agentData = {
      // Missing agentId
      name: 'Test Agent',
      // Missing type
      createdBy: 'test-user'
    };
    
    // Act
    const agent = new Agent(agentData);
    
    // Assert
    await expect(agent.save()).rejects.toThrow();
  });

  it('should enforce enum values for type field', async () => {
    // Arrange
    const agentData = {
      agentId: Agent.generateAgentId(),
      name: 'Test Agent',
      type: 'invalid-type', // Invalid type
      createdBy: 'test-user'
    };
    
    // Act
    const agent = new Agent(agentData);
    
    // Assert
    await expect(agent.save()).rejects.toThrow();
  });

  it('should enforce enum values for status field', async () => {
    // Arrange
    const agentData = {
      agentId: Agent.generateAgentId(),
      name: 'Test Agent',
      type: 'content_creation',
      status: 'invalid-status', // Invalid status
      createdBy: 'test-user'
    };
    
    // Act
    const agent = new Agent(agentData);
    
    // Assert
    await expect(agent.save()).rejects.toThrow();
  });

  it('should properly structure module configuration', async () => {
    // Arrange
    const agentData = {
      agentId: Agent.generateAgentId(),
      name: 'Module Test Agent',
      type: 'content_creation',
      modules: [
        {
          name: 'module-1',
          description: 'First module',
          enabled: true,
          config: {
            key1: 'value1',
            key2: 'value2'
          }
        },
        {
          name: 'module-2',
          description: 'Second module',
          enabled: false
        }
      ],
      createdBy: 'test-user'
    };
    
    // Act
    const agent = new Agent(agentData);
    const savedAgent = await agent.save();
    
    // Assert
    expect(savedAgent.modules).toHaveLength(2);
    expect(savedAgent.modules[0].name).toBe('module-1');
    expect(savedAgent.modules[0].enabled).toBe(true);
    expect(savedAgent.modules[0].config.get('key1')).toBe('value1');
    expect(savedAgent.modules[1].name).toBe('module-2');
    expect(savedAgent.modules[1].enabled).toBe(false);
  });
});