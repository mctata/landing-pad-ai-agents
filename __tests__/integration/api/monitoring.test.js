/**
 * Integration Tests for Monitoring API Endpoints
 * 
 * This test verifies that the monitoring API endpoints work correctly
 * in an integrated environment.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const systemController = require('../../../src/api/controllers/systemController');
const routes = require('../../../src/api/routes');

// Mock the health monitoring service
jest.mock('../../../src/core/monitoring/healthMonitoringService', () => {
  const mockInstance = {
    getSystemStatus: jest.fn().mockResolvedValue({
      system: {
        status: 'healthy',
        version: '1.0.0',
        uptime: 3600,
        timestamp: new Date().toISOString()
      },
      agents: {
        content_creation: { status: 'online', lastSeen: new Date().toISOString() },
        content_strategy: { status: 'online', lastSeen: new Date().toISOString() },
        content_management: { status: 'online', lastSeen: new Date().toISOString() },
        optimisation: { status: 'online', lastSeen: new Date().toISOString() },
        brand_consistency: { status: 'online', lastSeen: new Date().toISOString() }
      }
    }),
    getMetrics: jest.fn().mockResolvedValue({
      systemMetrics: {
        totalRequests: 1250,
        averageResponseTime: 145,
        errorRate: 0.02,
        agentOperations: 532
      },
      agentMetrics: {
        content_creation: {
          contentGenerated: 42,
          averageGenerationTime: 2.5
        },
        optimisation: {
          contentOptimized: 38,
          seoRecommendationsGenerated: 56
        }
      }
    }),
    getSystemHealthSummary: jest.fn().mockResolvedValue({
      healthScore: 96.5,
      status: 'healthy',
      issues: [],
      lastChecked: new Date().toISOString()
    }),
    registerAgent: jest.fn().mockResolvedValue(true),
    handleHeartbeat: jest.fn().mockResolvedValue(true)
  };
  
  return {
    getInstance: jest.fn().mockResolvedValue(mockInstance),
    ...mockInstance
  };
});

// Mock the auth middleware
jest.mock('../../../src/api/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 'test-user', role: 'admin' };
    next();
  },
  authorize: (roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ status: 'error', message: 'Unauthorized' });
    }
  }
}));

describe('Monitoring API Integration', () => {
  let mongoServer;
  let app;
  
  beforeAll(async () => {
    // Set up in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Set up Express app with routes
    app = express();
    app.use(express.json());
    app.use(routes);
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should return 200 OK for public health check endpoint', async () => {
    // Act
    const response = await request(app).get('/api/health');
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });
  
  it('should return system status with agent information for authenticated users', async () => {
    // Act
    const response = await request(app).get('/api/system/status');
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('agents');
    
    // Check system status
    expect(response.body.system).toHaveProperty('status', 'healthy');
    expect(response.body.system).toHaveProperty('version');
    expect(response.body.system).toHaveProperty('uptime');
    
    // Check agent statuses
    expect(response.body.agents).toHaveProperty('content_creation');
    expect(response.body.agents).toHaveProperty('content_strategy');
    expect(response.body.agents).toHaveProperty('optimisation');
    
    // Verify health monitoring service was called
    const healthService = require('../../../src/core/monitoring/healthMonitoringService');
    expect(healthService.getInstance).toHaveBeenCalled();
    expect(healthService.getSystemStatus).toHaveBeenCalled();
  });
  
  it('should return system metrics for authenticated users', async () => {
    // Act
    const response = await request(app).get('/api/system/metrics');
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('systemMetrics');
    expect(response.body).toHaveProperty('agentMetrics');
    
    // Check system metrics
    expect(response.body.systemMetrics).toHaveProperty('totalRequests');
    expect(response.body.systemMetrics).toHaveProperty('averageResponseTime');
    expect(response.body.systemMetrics).toHaveProperty('errorRate');
    
    // Check agent metrics
    expect(response.body.agentMetrics).toHaveProperty('content_creation');
    expect(response.body.agentMetrics.content_creation).toHaveProperty('contentGenerated');
    
    // Verify health monitoring service was called
    const healthService = require('../../../src/core/monitoring/healthMonitoringService');
    expect(healthService.getInstance).toHaveBeenCalled();
    expect(healthService.getMetrics).toHaveBeenCalled();
  });
  
  it('should accept agent heartbeats via API', async () => {
    // Arrange
    const heartbeatData = {
      agentId: 'test-agent-123',
      status: 'online',
      metrics: {
        memory: { heapUsed: 500000 },
        cpu: 25,
        operations: 42
      }
    };
    
    // Act
    const response = await request(app)
      .post('/api/system/agents/heartbeat')
      .send(heartbeatData);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    
    // Verify heartbeat was processed
    const healthService = require('../../../src/core/monitoring/healthMonitoringService');
    expect(healthService.handleHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'test-agent-123',
        status: 'online'
      })
    );
  });
  
  it('should register new agents via API', async () => {
    // Arrange
    const registrationData = {
      agentId: 'new-agent-456',
      metadata: {
        type: 'content_creation',
        modules: ['blog-generator', 'social-media-generator'],
        version: '1.0.0'
      }
    };
    
    // Act
    const response = await request(app)
      .post('/api/system/agents/register')
      .send(registrationData);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('message', expect.stringContaining('registered'));
    
    // Verify registration was processed
    const healthService = require('../../../src/core/monitoring/healthMonitoringService');
    expect(healthService.registerAgent).toHaveBeenCalledWith(
      'new-agent-456',
      expect.objectContaining({
        type: 'content_creation',
        modules: expect.arrayContaining(['blog-generator', 'social-media-generator'])
      })
    );
  });
  
  it('should return detailed health summary', async () => {
    // Act
    const response = await request(app).get('/api/system/health/summary');
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('healthScore');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('issues');
    expect(response.body).toHaveProperty('lastChecked');
    
    // Verify health service was called
    const healthService = require('../../../src/core/monitoring/healthMonitoringService');
    expect(healthService.getSystemHealthSummary).toHaveBeenCalled();
  });
});