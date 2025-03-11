// __tests__/core/monitoring/healthMonitoringService.test.js
const { getInstance } = require('../../../src/core/monitoring/healthMonitoringService');
const { getInstance: getMessageBus } = require('../../../src/core/messaging/messageBus');

// Mock dependencies
jest.mock('../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    subscribeToEvent: jest.fn().mockResolvedValue({}),
    publishCommand: jest.fn().mockResolvedValue(true),
    publishEvent: jest.fn().mockResolvedValue(true)
  })
}));

// Mock MongoDB
jest.mock('mongodb', () => {
  const collectionMock = {
    createIndex: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([])
    })
  };
  
  const dbMock = {
    collection: jest.fn().mockReturnValue(collectionMock)
  };
  
  const clientMock = {
    connect: jest.fn().mockResolvedValue({}),
    db: jest.fn().mockReturnValue(dbMock),
    close: jest.fn().mockResolvedValue({})
  };
  
  return {
    MongoClient: jest.fn().mockImplementation(() => clientMock),
    ObjectId: jest.fn(id => id)
  };
});

// Mock config
jest.mock('../../../src/config', () => ({
  database: {
    url: 'mongodb://localhost:27017',
    name: 'test_db',
    options: {}
  },
  monitoring: {
    checkInterval: 1000,
    heartbeatTimeout: 5000
  }
}));

// Mock logger
jest.mock('../../../src/core/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('HealthMonitoringService', () => {
  let healthMonitoringService;
  let originalSetInterval;
  
  beforeAll(() => {
    // Mock timers
    originalSetInterval = global.setInterval;
    global.setInterval = jest.fn().mockReturnValue(123);
  });
  
  afterAll(() => {
    // Restore timers
    global.setInterval = originalSetInterval;
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
  
  test('should initialize and connect to MongoDB', async () => {
    expect(healthMonitoringService.isConnected).toBe(true);
  });
  
  test('should subscribe to agent events', async () => {
    const messageBus = await getMessageBus();
    
    expect(messageBus.subscribeToEvent).toHaveBeenCalledWith(
      'agent.heartbeat',
      expect.any(Function)
    );
    
    expect(messageBus.subscribeToEvent).toHaveBeenCalledWith(
      'agent.status-changed',
      expect.any(Function)
    );
  });
  
  test('should start monitoring agents', async () => {
    expect(global.setInterval).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Number)
    );
  });
  
  test('should handle agent heartbeat', async () => {
    const data = {
      agentId: 'test-agent',
      status: 'online',
      metrics: { memory: { heapUsed: 1000000 } }
    };
    
    await healthMonitoringService.handleHeartbeat(data);
    
    // Check if the agent was updated in the database
    expect(healthMonitoringService.collection.updateOne).toHaveBeenCalledWith(
      { agentId: 'test-agent' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'online',
          metrics: expect.any(Object)
        })
      }),
      { upsert: true }
    );
    
    // Check if the agent was added to the in-memory map
    expect(healthMonitoringService.agents.get('test-agent')).toEqual(
      expect.objectContaining({
        agentId: 'test-agent',
        status: 'online'
      })
    );
  });
  
  test('should handle agent status change', async () => {
    const data = {
      agentId: 'test-agent',
      status: 'failed',
      reason: 'Test failure'
    };
    
    await healthMonitoringService.handleStatusChange(data);
    
    // Check if the agent status was updated in the database
    expect(healthMonitoringService.collection.updateOne).toHaveBeenCalledWith(
      { agentId: 'test-agent' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          statusReason: 'Test failure'
        })
      }),
      { upsert: true }
    );
    
    // Check if recovery was attempted for the failed agent
    expect(healthMonitoringService.messageBus.publishCommand).toHaveBeenCalledWith(
      'test-agent.recover',
      expect.objectContaining({
        agentId: 'test-agent',
        reason: 'Test failure'
      })
    );
  });
  
  test('should register a new agent', async () => {
    const result = await healthMonitoringService.registerAgent('new-agent', { type: 'test' });
    
    expect(result).toBe(true);
    
    // Check if the agent was added to the database
    expect(healthMonitoringService.collection.updateOne).toHaveBeenCalledWith(
      { agentId: 'new-agent' },
      expect.objectContaining({
        $set: expect.objectContaining({
          agentId: 'new-agent',
          status: 'starting',
          metadata: { type: 'test' }
        })
      }),
      { upsert: true }
    );
    
    // Check if the agent was added to the in-memory map
    expect(healthMonitoringService.agents.get('new-agent')).toEqual(
      expect.objectContaining({
        agentId: 'new-agent',
        status: 'starting'
      })
    );
  });
  
  test('should check agents health', async () => {
    // Setup mock data
    const mockAgents = [
      {
        agentId: 'online-agent',
        status: 'online',
        lastHeartbeat: new Date()
      },
      {
        agentId: 'stale-agent',
        status: 'online',
        lastHeartbeat: new Date(Date.now() - 1000000) // Old heartbeat
      }
    ];
    
    // Mock the find method to return our test agents
    healthMonitoringService.collection.find.mockReturnValueOnce({
      toArray: jest.fn().mockResolvedValue(mockAgents)
    });
    
    await healthMonitoringService.checkAgentsHealth();
    
    // Check if the stale agent was marked as unresponsive
    expect(healthMonitoringService.messageBus.publishEvent).toHaveBeenCalledWith(
      'agent.status-changed',
      expect.objectContaining({
        agentId: 'stale-agent',
        status: 'unresponsive'
      })
    );
  });
  
  test('should attempt agent recovery', async () => {
    await healthMonitoringService.attemptAgentRecovery('failed-agent', 'Test recovery');
    
    // Check if recovery command was published
    expect(healthMonitoringService.messageBus.publishCommand).toHaveBeenCalledWith(
      'failed-agent.recover',
      expect.objectContaining({
        agentId: 'failed-agent',
        reason: 'Test recovery'
      })
    );
    
    // Check if recovery attempt was recorded in the database
    expect(healthMonitoringService.collection.updateOne).toHaveBeenCalledWith(
      { agentId: 'failed-agent' },
      expect.objectContaining({
        $set: expect.objectContaining({
          lastRecoveryAttempt: expect.any(Date)
        }),
        $inc: {
          recoveryAttempts: 1
        }
      })
    );
  });
  
  test('should stop monitoring', async () => {
    await healthMonitoringService.stopMonitoring();
    
    expect(healthMonitoringService.intervalId).toBeNull();
  });
  
  test('should close connections', async () => {
    await healthMonitoringService.close();
    
    expect(healthMonitoringService.client.close).toHaveBeenCalled();
    expect(healthMonitoringService.isConnected).toBe(false);
  });
});
