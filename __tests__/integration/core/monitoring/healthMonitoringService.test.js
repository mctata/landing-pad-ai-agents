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
    heartbeatTimeout: 1000, // Short timeout for testing
    recoveryThreshold: 3, // Attempt recovery after 3 failures
    recoveryBackoff: 1000 // Backoff time in ms
  }
}));

// Import after mocks
const { getInstance } = require('../../../../src/core/monitoring/healthMonitoringService');
const { getInstance: getMessageBus } = require('../../../../src/core/messaging/messageBus');
const AgentRecoveryService = require('../../../../src/core/error/agentRecoveryService');

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

  it('should track and report system-wide metrics', async () => {
    // Arrange
    const agentCount = 3;
    const agentIds = [];
    
    // Create multiple test agents
    for (let i = 0; i < agentCount; i++) {
      const agentId = `metrics-agent-${i}-${Date.now()}`;
      agentIds.push(agentId);
      
      await healthMonitoringService.registerAgent(agentId, { 
        type: i === 0 ? 'content_creation' : 
              i === 1 ? 'content_strategy' : 'optimisation' 
      });
      
      // Simulate heartbeats with metrics
      await healthMonitoringService.handleHeartbeat({
        agentId,
        status: 'online',
        metrics: {
          responseTime: 100 + i * 50,
          memory: { heapUsed: 1000000 + i * 500000 },
          operations: i * 5
        }
      });
    }
    
    // Act
    const systemMetrics = await healthMonitoringService.getSystemMetrics();
    
    // Assert
    expect(systemMetrics).toBeDefined();
    expect(systemMetrics.totalAgents).toBe(agentCount);
    expect(systemMetrics.agentsByStatus.online).toBe(agentCount);
    
    // Cleanup
    for (const agentId of agentIds) {
      await healthMonitoringService.collection.deleteOne({ agentId });
    }
  });

  it('should implement automated recovery for chronically failing agents', async () => {
    // Arrange
    const messageBus = await getMessageBus();
    const failingAgentId = 'chronic-failure-agent-' + Date.now();
    
    // Register agent
    await healthMonitoringService.registerAgent(failingAgentId, { 
      type: 'content_creation',
      modules: ['blog-generator', 'social-media-generator']
    });
    
    // Mock the recovery service
    const mockRecoveryService = new AgentRecoveryService();
    const spyRecover = jest.spyOn(mockRecoveryService, 'recoverAgent')
      .mockImplementation(() => Promise.resolve({ success: true }));
    
    // Inject mock recovery service
    healthMonitoringService.recoveryService = mockRecoveryService;
    
    // Act - Simulate multiple failures
    for (let i = 0; i < 5; i++) {
      await healthMonitoringService.handleStatusChange({
        agentId: failingAgentId,
        status: 'failed',
        reason: `Failure #${i+1}`
      });
      
      // Wait a bit between failures
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Allow time for recovery to be triggered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Assert
    expect(spyRecover).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: failingAgentId }),
      expect.anything()
    );
    
    // Verify status has been updated to recovering
    const agent = await healthMonitoringService.collection.findOne({ agentId: failingAgentId });
    expect(agent.status).toBe('recovering');
    
    // Cleanup
    spyRecover.mockRestore();
    await healthMonitoringService.collection.deleteOne({ agentId: failingAgentId });
  });

  it('should escalate issues when recovery attempts fail repeatedly', async () => {
    // Arrange
    const messageBus = await getMessageBus();
    const unrecoverableAgentId = 'unrecoverable-agent-' + Date.now();
    
    // Insert agent with multiple failed recovery attempts
    await healthMonitoringService.collection.insertOne({
      agentId: unrecoverableAgentId,
      status: 'failed',
      statusReason: 'Persistent failure',
      metadata: { type: 'brand_consistency' },
      recoveryAttempts: 5, // Multiple failed attempts
      lastRecoveryAttempt: new Date(Date.now() - 60000),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastHeartbeat: new Date(Date.now() - 300000) // 5 minutes ago
    });
    
    // Act - Run health check
    await healthMonitoringService.checkAgentsHealth();
    
    // Assert - Should publish a critical issue event
    expect(messageBus.publishEvent).toHaveBeenCalledWith(
      'system.issue',
      expect.objectContaining({
        severity: 'critical',
        source: unrecoverableAgentId,
        message: expect.stringContaining('recovery failed')
      })
    );
    
    // Cleanup
    await healthMonitoringService.collection.deleteOne({ agentId: unrecoverableAgentId });
  });

  it('should calculate system health score based on agent statuses', async () => {
    // Arrange - Create agents with different statuses
    const agentData = [
      { id: 'health-test-1-' + Date.now(), status: 'online', type: 'content_creation' },
      { id: 'health-test-2-' + Date.now(), status: 'online', type: 'content_strategy' },
      { id: 'health-test-3-' + Date.now(), status: 'degraded', type: 'optimisation' },
      { id: 'health-test-4-' + Date.now(), status: 'failed', type: 'brand_consistency' }
    ];
    
    // Register all test agents
    for (const agent of agentData) {
      await healthMonitoringService.registerAgent(agent.id, { type: agent.type });
      await healthMonitoringService.handleStatusChange({
        agentId: agent.id,
        status: agent.status,
        reason: 'Test setup'
      });
    }
    
    // Act
    const healthSummary = await healthMonitoringService.getSystemHealthSummary();
    
    // Assert
    expect(healthSummary).toBeDefined();
    expect(healthSummary.healthScore).toBeLessThan(100); // Score should be reduced due to issues
    expect(healthSummary.status).toBe('degraded'); // System should be degraded with failing agents
    expect(healthSummary.issues).toHaveLength(2); // Should have two issues (degraded + failed)
    
    // Cleanup
    for (const agent of agentData) {
      await healthMonitoringService.collection.deleteOne({ agentId: agent.id });
    }
  });
});