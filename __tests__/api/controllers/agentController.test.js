/**
 * API tests for Agent Controller
 */

const express = require('express');
const { setupApiTest } = require('../../../testing/setupApiTests');
const { createMockAgent } = require('../../../testing/mockFactories');
const mongoose = require('mongoose');

// Create minimal Express app for testing
async function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Simple error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: {
        message: err.message,
        status: err.status
      }
    });
  });
  
  // Load models
  require('../../../src/models');
  
  // Load routes - we'll mock the agent container
  const mockAgentContainer = {
    getAgent: jest.fn().mockImplementation((agentId) => {
      if (agentId === 'invalid-agent') return null;
      
      return {
        execute: jest.fn().mockResolvedValue({ success: true, result: 'Test execution result' }),
        getStatus: jest.fn().mockReturnValue('active'),
        getModules: jest.fn().mockReturnValue([{ name: 'test-module', enabled: true }])
      };
    })
  };
  
  app.locals.agentContainer = mockAgentContainer;
  
  // Load routes
  const routes = require('../../../src/api/routes');
  app.use('/api', routes);
  
  return app;
}

describe('Agent Controller API', () => {
  let testUtils;
  let Agent;
  
  beforeAll(async () => {
    const app = await createTestApp();
    testUtils = await setupApiTest(app);
    Agent = mongoose.model('Agent');
  });
  
  beforeEach(async () => {
    await testUtils.clearDatabase();
  });
  
  afterAll(async () => {
    await testUtils.closeApiTest();
  });
  
  describe('GET /api/agents', () => {
    it('should return all agents', async () => {
      // Arrange - Create test agents
      await Agent.create([
        createMockAgent({ agentId: 'agent-1', name: 'Agent 1' }),
        createMockAgent({ agentId: 'agent-2', name: 'Agent 2' })
      ]);
      
      // Act
      const response = await testUtils.authRequest()
        .get('/api/agents')
        .expect(200);
      
      // Assert
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body.map(a => a.agentId)).toContain('agent-1');
      expect(response.body.map(a => a.agentId)).toContain('agent-2');
    });
    
    it('should require authentication', async () => {
      // Act & Assert
      await testUtils.request
        .get('/api/agents')
        .expect(401);
    });
  });
  
  describe('GET /api/agents/:agentId', () => {
    it('should return a specific agent', async () => {
      // Arrange
      const agent = createMockAgent({
        agentId: 'test-agent',
        name: 'Test Agent',
        description: 'Agent for testing'
      });
      
      await Agent.create(agent);
      
      // Act
      const response = await testUtils.authRequest()
        .get('/api/agents/test-agent')
        .expect(200);
      
      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.agentId).toBe('test-agent');
      expect(response.body.name).toBe('Test Agent');
      expect(response.body.description).toBe('Agent for testing');
    });
    
    it('should return 404 for non-existent agent', async () => {
      // Act & Assert
      await testUtils.authRequest()
        .get('/api/agents/non-existent-agent')
        .expect(404);
    });
  });
  
  describe('POST /api/agents', () => {
    it('should create a new agent', async () => {
      // Arrange
      const newAgent = {
        agentId: 'new-agent',
        name: 'New Test Agent',
        description: 'Newly created agent',
        type: 'content_creation',
        modules: [
          {
            name: 'test-module',
            description: 'Test module',
            enabled: true
          }
        ]
      };
      
      // Act
      const response = await testUtils.adminRequest() // Only admins can create agents
        .post('/api/agents')
        .send(newAgent)
        .expect(201);
      
      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.agentId).toBe('new-agent');
      
      // Verify in database
      const createdAgent = await Agent.findOne({ agentId: 'new-agent' });
      expect(createdAgent).not.toBeNull();
      expect(createdAgent.name).toBe('New Test Agent');
    });
    
    it('should require admin role', async () => {
      // Act & Assert - Regular user can't create agents
      await testUtils.authRequest()
        .post('/api/agents')
        .send({ agentId: 'test' })
        .expect(403);
    });
  });
  
  describe('PUT /api/agents/:agentId', () => {
    it('should update an existing agent', async () => {
      // Arrange
      await Agent.create(createMockAgent({ 
        agentId: 'update-agent',
        name: 'Before Update'
      }));
      
      // Act
      const response = await testUtils.adminRequest()
        .put('/api/agents/update-agent')
        .send({
          name: 'After Update',
          description: 'Updated description'
        })
        .expect(200);
      
      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.name).toBe('After Update');
      expect(response.body.description).toBe('Updated description');
      
      // Verify in database
      const updatedAgent = await Agent.findOne({ agentId: 'update-agent' });
      expect(updatedAgent.name).toBe('After Update');
    });
  });
  
  describe('DELETE /api/agents/:agentId', () => {
    it('should delete an agent', async () => {
      // Arrange
      await Agent.create(createMockAgent({ agentId: 'delete-agent' }));
      
      // Act
      await testUtils.adminRequest()
        .delete('/api/agents/delete-agent')
        .expect(204);
      
      // Assert - Verify agent was deleted
      const deletedAgent = await Agent.findOne({ agentId: 'delete-agent' });
      expect(deletedAgent).toBeNull();
    });
  });
  
  describe('POST /api/agents/:agentId/execute', () => {
    it('should execute an agent operation', async () => {
      // Arrange
      await Agent.create(createMockAgent({ agentId: 'execute-agent' }));
      
      const executionRequest = {
        operation: 'test-operation',
        params: {
          test: 'value'
        }
      };
      
      // Act
      const response = await testUtils.authRequest()
        .post('/api/agents/execute-agent/execute')
        .send(executionRequest)
        .expect(200);
      
      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.result).toBe('Test execution result');
    });
    
    it('should return error for invalid agent', async () => {
      // Act & Assert
      await testUtils.authRequest()
        .post('/api/agents/invalid-agent/execute')
        .send({ operation: 'test' })
        .expect(404);
    });
  });
});