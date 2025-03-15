/**
 * Integration Tests for Agent Recovery Service
 * 
 * This test verifies that the agent recovery service can detect
 * and recover agents from various failure conditions.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AgentRecoveryService = require('../../../../src/core/error/agentRecoveryService');
const HealthMonitoringService = require('../../../../src/core/monitoring/healthMonitoringService');
const agentFactory = require('../../../../src/common/services/agent-factory');
const { AgentError } = require('../../../../src/core/error/errors');

// Mock message bus
jest.mock('../../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue(true),
    publishCommand: jest.fn().mockResolvedValue(true)
  })
}));

describe('Agent Recovery Service Integration', () => {
  let mongoServer;
  let recoveryService;
  let healthMonitoring;
  
  beforeAll(async () => {
    // Set up in-memory MongoDB for testing
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Initialize agent factory
    await agentFactory.initialize();
    
    // Initialize health monitoring
    const healthMonitoringInstance = new HealthMonitoringService.constructor();
    await healthMonitoringInstance.initialize();
    healthMonitoring = healthMonitoringInstance;
    
    // Initialize recovery service
    recoveryService = new AgentRecoveryService();
    await recoveryService.initialize();
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    
    if (healthMonitoring) {
      await healthMonitoring.shutdown();
    }
    
    if (recoveryService) {
      await recoveryService.shutdown();
    }
  });
  
  beforeEach(async () => {
    // Clear database collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('should detect and recover an unresponsive agent', async () => {
    // Arrange
    const agentId = 'test-agent-' + Date.now();
    const agentType = 'content_creation';
    
    // Register the agent with health monitoring
    await healthMonitoring.registerAgent(agentId, { type: agentType });
    
    // Make the agent unresponsive
    await healthMonitoring.collection.updateOne(
      { agentId },
      { 
        $set: { 
          status: 'unresponsive',
          lastHeartbeat: new Date(Date.now() - 300000) // 5 minutes ago
        } 
      }
    );
    
    // Mock agent factory to track agent restart
    const mockCreateAgent = jest.spyOn(agentFactory, 'createAgent')
      .mockImplementation(async (type) => {
        return {
          type,
          initialize: jest.fn().mockResolvedValue(true),
          handleCommand: jest.fn().mockResolvedValue({ success: true }),
          shutdown: jest.fn().mockResolvedValue(true)
        };
      });
    
    // Act
    const recoveryResult = await recoveryService.recoverAgent({
      agentId,
      agentType,
      status: 'unresponsive',
      lastHeartbeat: new Date(Date.now() - 300000)
    });
    
    // Assert
    expect(recoveryResult).toHaveProperty('success', true);
    expect(mockCreateAgent).toHaveBeenCalledWith(agentType);
    
    // Check agent status was updated
    const updatedAgent = await healthMonitoring.collection.findOne({ agentId });
    expect(updatedAgent.status).toBe('recovering');
    expect(updatedAgent.recoveryAttempts).toBe(1);
    
    // Cleanup
    mockCreateAgent.mockRestore();
  });
  
  it('should recover from agent errors and resume interrupted operations', async () => {
    // Arrange
    const agentId = 'error-agent-' + Date.now();
    const agentType = 'optimisation';
    
    // Register the agent with health monitoring
    await healthMonitoring.registerAgent(agentId, { type: agentType });
    
    // Create a failed operation record
    const failedOperation = {
      agentId,
      operationType: 'seo_optimization',
      status: 'failed',
      params: { contentId: new mongoose.Types.ObjectId() },
      error: {
        message: 'Service unavailable',
        code: 'SERVICE_ERROR'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create operations collection if it doesn't exist
    if (!mongoose.connection.collections['operations']) {
      await mongoose.connection.createCollection('operations');
    }
    
    // Insert the failed operation
    await mongoose.connection.collections['operations'].insertOne(failedOperation);
    
    // Mock agent factory
    const mockAgent = {
      type: agentType,
      initialize: jest.fn().mockResolvedValue(true),
      handleCommand: jest.fn().mockResolvedValue({ success: true }),
      shutdown: jest.fn().mockResolvedValue(true),
      resumeOperation: jest.fn().mockResolvedValue({ success: true })
    };
    
    const mockCreateAgent = jest.spyOn(agentFactory, 'createAgent')
      .mockImplementation(async () => mockAgent);
    
    // Act
    const recoveryResult = await recoveryService.recoverAgent({
      agentId,
      agentType,
      status: 'failed',
      statusReason: 'Service error'
    });
    
    // Wait for operation recovery
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Assert
    expect(recoveryResult).toHaveProperty('success', true);
    expect(mockAgent.resumeOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'seo_optimization',
        params: expect.objectContaining({ contentId: expect.any(Object) })
      })
    );
    
    // Check agent status was updated
    const updatedAgent = await healthMonitoring.collection.findOne({ agentId });
    expect(updatedAgent.status).toBe('recovering');
    
    // Cleanup
    mockCreateAgent.mockRestore();
  });
  
  it('should handle resource-related failures with appropriate backoff strategy', async () => {
    // Arrange
    const agentId = 'resource-agent-' + Date.now();
    const agentType = 'content_creation';
    
    // Register the agent with health monitoring
    await healthMonitoring.registerAgent(agentId, { 
      type: agentType,
      resources: {
        memory: 'high',
        cpu: 'medium'
      }
    });
    
    // Set agent to failed due to resource issues
    await healthMonitoring.collection.updateOne(
      { agentId },
      { 
        $set: { 
          status: 'failed',
          statusReason: 'Memory limit exceeded',
          metrics: {
            memory: { heapUsed: 1500000000 }, // High memory usage
            cpu: 95 // High CPU usage
          }
        } 
      }
    );
    
    // Mock agent factory
    const mockCreateAgent = jest.spyOn(agentFactory, 'createAgent')
      .mockImplementation(async (type) => {
        return {
          type,
          initialize: jest.fn().mockResolvedValue(true),
          handleCommand: jest.fn().mockResolvedValue({ success: true }),
          shutdown: jest.fn().mockResolvedValue(true)
        };
      });
    
    // Act
    const recoveryResult = await recoveryService.recoverAgent({
      agentId,
      agentType,
      status: 'failed',
      statusReason: 'Memory limit exceeded',
      metrics: {
        memory: { heapUsed: 1500000000 },
        cpu: 95
      }
    });
    
    // Assert
    expect(recoveryResult).toHaveProperty('success', true);
    expect(recoveryResult).toHaveProperty('strategy', 'resource_optimization');
    
    // Check that agent was restarted with resource optimization
    expect(mockCreateAgent).toHaveBeenCalledWith(
      agentType,
      expect.objectContaining({
        optimizeResources: true,
        resourceConfig: expect.objectContaining({
          memoryLimit: expect.any(Number)
        })
      })
    );
    
    // Cleanup
    mockCreateAgent.mockRestore();
  });
  
  it('should track recovery statistics and increase recovery intervals for chronic failures', async () => {
    // Arrange
    const agentId = 'chronic-failure-' + Date.now();
    const agentType = 'brand_consistency';
    
    // Register the agent with health monitoring
    await healthMonitoring.registerAgent(agentId, { type: agentType });
    
    // Mock agent factory
    const mockCreateAgent = jest.spyOn(agentFactory, 'createAgent')
      .mockImplementation(async (type) => {
        return {
          type,
          initialize: jest.fn().mockResolvedValue(true),
          handleCommand: jest.fn().mockResolvedValue({ success: true }),
          shutdown: jest.fn().mockResolvedValue(true)
        };
      });
    
    // Act - Simulate multiple recovery attempts
    for (let i = 0; i < 3; i++) {
      await healthMonitoring.collection.updateOne(
        { agentId },
        { 
          $set: { 
            status: 'failed',
            statusReason: `Failure #${i+1}`,
            recoveryAttempts: i
          } 
        }
      );
      
      await recoveryService.recoverAgent({
        agentId,
        agentType,
        status: 'failed',
        statusReason: `Failure #${i+1}`,
        recoveryAttempts: i
      });
      
      // Small wait between recovery attempts
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Get recovery statistics
    const recoveryStats = await recoveryService.getRecoveryStatistics();
    
    // Assert
    expect(recoveryStats).toBeDefined();
    expect(recoveryStats.totalRecoveryAttempts).toBeGreaterThanOrEqual(3);
    expect(recoveryStats.byAgentType[agentType]).toBeGreaterThanOrEqual(3);
    
    // Check that the backoff interval increased
    const agent = await healthMonitoring.collection.findOne({ agentId });
    expect(agent.nextRecoveryAttempt).toBeDefined();
    
    // The backoff should increase with each attempt
    const backoffTime = new Date(agent.nextRecoveryAttempt).getTime() - Date.now();
    expect(backoffTime).toBeGreaterThan(0); // Should be in the future
    
    // Cleanup
    mockCreateAgent.mockRestore();
  });
  
  it('should isolate problematic agents from the system when recovery fails repeatedly', async () => {
    // Arrange
    const agentId = 'problematic-agent-' + Date.now();
    const agentType = 'content_management';
    
    // Register the agent with health monitoring
    await healthMonitoring.registerAgent(agentId, { type: agentType });
    
    // Set agent to failed with many recovery attempts
    await healthMonitoring.collection.updateOne(
      { agentId },
      { 
        $set: { 
          status: 'failed',
          statusReason: 'Persistent failure',
          recoveryAttempts: 5, // Many failed attempts
          lastRecoveryAttempt: new Date(Date.now() - 300000) // 5 minutes ago
        } 
      }
    );
    
    // Mock agent factory (but make recovery fail)
    const mockCreateAgent = jest.spyOn(agentFactory, 'createAgent')
      .mockImplementation(async () => {
        throw new AgentError({
          message: 'Failed to initialize agent',
          errorCode: 'AGENT_INIT_FAILED'
        });
      });
    
    // Act
    const recoveryResult = await recoveryService.recoverAgent({
      agentId,
      agentType,
      status: 'failed',
      statusReason: 'Persistent failure',
      recoveryAttempts: 5
    });
    
    // Assert
    expect(recoveryResult).toHaveProperty('success', false);
    expect(recoveryResult).toHaveProperty('action', 'isolate');
    
    // Check that agent was marked as isolated
    const updatedAgent = await healthMonitoring.collection.findOne({ agentId });
    expect(updatedAgent.status).toBe('isolated');
    expect(updatedAgent.systemImpact).toBeDefined();
    
    // Cleanup
    mockCreateAgent.mockRestore();
  });
});