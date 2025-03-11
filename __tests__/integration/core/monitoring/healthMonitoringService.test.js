/**
 * Integration tests for Health Monitoring Service
 */

const testDatabase = require('../../../../testing/setupTestDatabase');
const { mockFactories } = require('../../../../testing/testHelpers');

// Mock the message bus
jest.mock('../../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishEvent: jest.fn().mockResolvedValue(true),
    publishCommand: jest.fn().mockResolvedValue(true)
  })
}));

// Mock config for testing
jest.mock('../../../../src/config', () => ({
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/test',
    name: 'test',
    options: {}
  },
  monitoring: {
    checkInterval: 500, // Short interval for testing
    heartbeatTimeout: 1000 // Short timeout for testing
  }
}));

// Import after mocks
const { getInstance } = require('../../../../src/core/monitoring/healthMonitoringService');
const { getInstance: getMessageBus } = require('../../../../src/core/messaging/messageBus');

describe('HealthMonitoringService Integration', () => {
  let healthMonitoringService;
  
  beforeAll(async () => {
    await testDatabase.connect();
  });

  afterAll(async () => {
    await testDatabase.closeDatabase();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get a fresh instance of HealthMonitoringService
    healthMonitoringService = await getInstance();
  });

  afterEach(async () => {
    if (healthMonitoringService) {
      await healthMonitoringService.close();
    }
  });

  it('should register a new agent and update its status', async () => {
    // Arrange
    const agentId = 'test-agent-' + Date.now();
    const agentMetadata = {
      type: 'content_creation',
      modules: ['blog-generator', 'social-media-generator']
    };
    
    // Act - Register agent
    const registered = await healthMonitoringService.registerAgent(agentId, agentMetadata);
    
    // Assert - Registration
    expect(registered).toBe(true);
    
    // Verify agent is in the database
    const agentInDb = await healthMonitoringService.collection.findOne({ agentId });
    expect(agentInDb).toBeDefined();
    expect(agentInDb.agentId).toBe(agentId);
    expect(agentInDb.metadata.type).toBe(agentMetadata.type);
    expect(agentInDb.status).toBe('starting');
    
    // Act - Update agent status
    const heartbeatData = {
      agentId,
      status: 'online',
      metrics: {
        memory: { heapUsed: 1000000 },
        responseTime: 150
      }
    };
    
    await healthMonitoringService.handleHeartbeat(heartbeatData);
    
    // Assert - Updated status
    const updatedAgent = await healthMonitoringService.collection.findOne({ agentId });
    expect(updatedAgent.status).toBe('online');
    expect(updatedAgent.metrics.memory.heapUsed).toBe(1000000);
  });

  it('should detect unresponsive agents', async () => {
    // Arrange
    const messageBus = await getMessageBus();
    
    // Create agents in database - one with recent heartbeat, one with old heartbeat
    const recentAgentId = 'recent-agent-' + Date.now();
    const staleAgentId = 'stale-agent-' + Date.now();
    
    // Recent agent - heartbeat just now
    await healthMonitoringService.collection.insertOne({
      agentId: recentAgentId,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Stale agent - heartbeat 10 minutes ago
    await healthMonitoringService.collection.insertOne({
      agentId: staleAgentId,
      status: 'online',
      lastHeartbeat: new Date(Date.now() - 600000),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Act - Check agent health
    await healthMonitoringService.checkAgentsHealth();
    
    // Assert - Recent agent should still be online, stale agent should be marked unresponsive
    const recentAgent = await healthMonitoringService.collection.findOne({ agentId: recentAgentId });
    const staleAgent = await healthMonitoringService.collection.findOne({ agentId: staleAgentId });
    
    expect(recentAgent.status).toBe('online');
    expect(staleAgent.status).toBe('unresponsive');
    
    // Message bus should have published an event for the stale agent
    expect(messageBus.publishEvent).toHaveBeenCalledWith(
      'agent.status-changed',
      expect.objectContaining({
        agentId: staleAgentId,
        status: 'unresponsive'
      })
    );
  });

  it('should attempt to recover failed agents', async () => {
    // Arrange
    const messageBus = await getMessageBus();
    const failedAgentId = 'failed-agent-' + Date.now();
    
    // Insert failed agent
    await healthMonitoringService.collection.insertOne({
      agentId: failedAgentId,
      status: 'failed',
      statusReason: 'Test failure',
      lastHeartbeat: new Date(Date.now() - 60000),
      recoveryAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Act - Attempt recovery
    await healthMonitoringService.attemptAgentRecovery(failedAgentId, 'Testing recovery');
    
    // Assert - Recovery attempt should be recorded
    const recoveredAgent = await healthMonitoringService.collection.findOne({ agentId: failedAgentId });
    expect(recoveredAgent.recoveryAttempts).toBe(1);
    expect(recoveredAgent.lastRecoveryAttempt).toBeDefined();
    
    // Message bus should have published a recovery command
    expect(messageBus.publishCommand).toHaveBeenCalledWith(
      `${failedAgentId}.recover`,
      expect.objectContaining({
        agentId: failedAgentId,
        reason: 'Testing recovery'
      })
    );
  });

  it('should handle agent status changes', async () => {
    // Arrange
    const agentId = 'status-change-agent-' + Date.now();
    
    // Register agent
    await healthMonitoringService.registerAgent(agentId, { type: 'test' });
    
    // Act - Handle status change
    const statusChangeData = {
      agentId,
      status: 'paused',
      reason: 'Scheduled maintenance'
    };
    
    await healthMonitoringService.handleStatusChange(statusChangeData);
    
    // Assert - Status change should be recorded
    const updatedAgent = await healthMonitoringService.collection.findOne({ agentId });
    expect(updatedAgent.status).toBe('paused');
    expect(updatedAgent.statusReason).toBe('Scheduled maintenance');
  });

  it('should maintain an in-memory map of agents', async () => {
    // Arrange
    const agentId = 'map-test-agent-' + Date.now();
    
    // Act - Register agent
    await healthMonitoringService.registerAgent(agentId, { type: 'test' });
    
    // Assert - Agent should be in the in-memory map
    expect(healthMonitoringService.agents.has(agentId)).toBe(true);
    
    // Update agent status
    await healthMonitoringService.handleHeartbeat({
      agentId,
      status: 'online',
      metrics: { cpu: 10 }
    });
    
    // Check in-memory state updated
    const agentState = healthMonitoringService.agents.get(agentId);
    expect(agentState.status).toBe('online');
    
    // Delete agent
    await healthMonitoringService.collection.deleteOne({ agentId });
    await healthMonitoringService.checkAgentsHealth();
    
    // Agent should be removed from in-memory map
    expect(healthMonitoringService.agents.has(agentId)).toBe(false);
  });
});