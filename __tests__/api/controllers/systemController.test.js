/**
 * Tests for systemController
 */

const systemController = require('../../../src/api/controllers/systemController');
const { 
  createMockRequest, 
  createMockResponse, 
  mockServices 
} = require('../../../testing/testHelpers');

// Mock dependencies
jest.mock('../../../src/core/monitoring/healthMonitoringService', () => ({
  getInstance: jest.fn().mockResolvedValue({
    getAllAgentsStatus: jest.fn().mockResolvedValue([
      { agentId: 'agent1', status: 'running' },
      { agentId: 'agent2', status: 'stopped' }
    ]),
    getAgentStatus: jest.fn().mockImplementation((agentId) => {
      if (agentId === 'not-found') return null;
      return { agentId, status: 'running' };
    }),
    registerAgent: jest.fn().mockResolvedValue(true)
  })
}));

jest.mock('../../../src/core/error', () => ({
  getRecoveryService: jest.fn().mockResolvedValue({
    getDeadLetterQueueEntries: jest.fn().mockImplementation((agentId) => {
      if (agentId) {
        return [{ key: 'entry1', agentId, error: 'Test error' }];
      }
      return [
        { key: 'entry1', agentId: 'agent1', error: 'Test error' },
        { key: 'entry2', agentId: 'agent2', error: 'Another error' }
      ];
    }),
    retryDeadLetterQueueEntry: jest.fn().mockImplementation((key) => {
      return key !== 'not-found';
    }),
    deleteDeadLetterQueueEntry: jest.fn().mockImplementation((key) => {
      return key !== 'not-found';
    }),
    getRecoveryHistory: jest.fn().mockImplementation((agentId) => {
      return [
        { timestamp: Date.now(), strategy: 'restart', error: 'Test error' }
      ];
    })
  })
}));

jest.mock('../../../src/core/messaging/messageBus', () => ({
  getInstance: jest.fn().mockResolvedValue({
    publishCommand: jest.fn().mockResolvedValue({ id: 'cmd-123' })
  })
}));

jest.mock('../../../src/common/services/logger', () => mockServices.createLoggerMock());

describe('systemController', () => {
  describe('healthCheck', () => {
    it('should return a 200 status with ok response', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      
      systemController.healthCheck(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String)
      }));
    });
  });
  
  describe('getSystemStatus', () => {
    it('should return system status with agent information', async () => {
      const req = createMockRequest({
        app: {
          locals: {
            agentContainer: {
              agents: {
                agent1: { isRunning: true, modules: new Map([['module1', {}]]) },
                agent2: { isRunning: false, modules: new Map() }
              },
              storage: {
                db: {
                  command: jest.fn().mockResolvedValue({ ok: 1 })
                }
              },
              messaging: {
                isConnected: jest.fn().mockReturnValue(true)
              }
            }
          }
        }
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      await systemController.getSystemStatus(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        agents: expect.objectContaining({
          agent1: expect.objectContaining({
            isRunning: true,
            moduleCount: 1
          }),
          agent2: expect.objectContaining({
            isRunning: false,
            moduleCount: 0
          })
        }),
        services: expect.objectContaining({
          database: 'connected',
          messaging: 'connected'
        })
      }));
    });
    
    it('should handle errors and pass to next middleware', async () => {
      const req = createMockRequest({
        app: {
          locals: {
            agentContainer: {
              agents: {},
              storage: {
                db: {
                  command: jest.fn().mockRejectedValue(new Error('Database error'))
                }
              }
            }
          }
        }
      });
      const res = createMockResponse();
      const next = jest.fn();
      
      const error = new Error('Test error');
      jest.spyOn(req.app.locals.agentContainer.storage.db, 'command').mockRejectedValue(error);
      
      await systemController.getSystemStatus(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });
  });
  
  describe('getAgentHealth', () => {
    it('should return agent health status', async () => {
      const req = createMockRequest({
        params: { agentId: 'agent1' }
      });
      const res = createMockResponse();
      
      await systemController.getAgentHealth(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        agent: expect.objectContaining({
          agentId: 'agent1',
          status: 'running'
        })
      }));
    });
    
    it('should return 404 if agent not found', async () => {
      const req = createMockRequest({
        params: { agentId: 'not-found' }
      });
      const res = createMockResponse();
      
      await systemController.getAgentHealth(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('not found')
      }));
    });
  });
  
  describe('getDeadLetterQueue', () => {
    it('should return all dead letter queue entries', async () => {
      const req = createMockRequest({
        query: {}
      });
      const res = createMockResponse();
      
      await systemController.getDeadLetterQueue(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        count: 2,
        entries: expect.arrayContaining([
          expect.objectContaining({ key: 'entry1' }),
          expect.objectContaining({ key: 'entry2' })
        ])
      }));
    });
    
    it('should filter by agent ID if provided', async () => {
      const req = createMockRequest({
        query: { agentId: 'agent1' }
      });
      const res = createMockResponse();
      
      await systemController.getDeadLetterQueue(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        count: 1,
        entries: expect.arrayContaining([
          expect.objectContaining({ key: 'entry1', agentId: 'agent1' })
        ])
      }));
    });
  });
  
  describe('retryDeadLetterQueueEntry', () => {
    it('should retry entry and return success', async () => {
      const req = createMockRequest({
        params: { key: 'entry1' }
      });
      const res = createMockResponse();
      
      await systemController.retryDeadLetterQueueEntry(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        message: expect.stringContaining('Successfully retried')
      }));
    });
    
    it('should return 404 if entry not found', async () => {
      const req = createMockRequest({
        params: { key: 'not-found' }
      });
      const res = createMockResponse();
      
      await systemController.retryDeadLetterQueueEntry(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('not found')
      }));
    });
  });
  
  describe('deleteDeadLetterQueueEntry', () => {
    it('should delete entry and return success', async () => {
      const req = createMockRequest({
        params: { key: 'entry1' }
      });
      const res = createMockResponse();
      
      await systemController.deleteDeadLetterQueueEntry(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        message: expect.stringContaining('Successfully deleted')
      }));
    });
    
    it('should return 404 if entry not found', async () => {
      const req = createMockRequest({
        params: { key: 'not-found' }
      });
      const res = createMockResponse();
      
      await systemController.deleteDeadLetterQueueEntry(req, res);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('not found')
      }));
    });
  });
  
  describe('getAgentRecoveryHistory', () => {
    it('should return agent recovery history', async () => {
      const req = createMockRequest({
        params: { agentId: 'agent1' }
      });
      const res = createMockResponse();
      
      await systemController.getAgentRecoveryHistory(req, res);
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        agentId: 'agent1',
        history: expect.arrayContaining([
          expect.objectContaining({
            strategy: 'restart',
            error: 'Test error'
          })
        ])
      }));
    });
    
    it('should return 400 if agent ID is missing', async () => {
      const req = createMockRequest({
        params: {}
      });
      const res = createMockResponse();
      
      await systemController.getAgentRecoveryHistory(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('required')
      }));
    });
  });
  
  describe('restartAgent', () => {
    it('should send restart command and return success', async () => {
      const req = createMockRequest({
        params: { agentId: 'agent1' },
        user: { id: 'user1' }
      });
      const res = createMockResponse();
      
      await systemController.restartAgent(req, res);
      
      const messageBus = await require('../../../src/core/messaging/messageBus').getInstance();
      
      expect(messageBus.publishCommand).toHaveBeenCalledWith(
        'agent1.restart',
        expect.objectContaining({
          timestamp: expect.any(String),
          requestedBy: 'user1'
        })
      );
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        message: expect.stringContaining('Restart command sent'),
        commandId: 'cmd-123'
      }));
    });
    
    it('should return 400 if agent ID is missing', async () => {
      const req = createMockRequest({
        params: {}
      });
      const res = createMockResponse();
      
      await systemController.restartAgent(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('required')
      }));
    });
  });
  
  describe('registerAgent', () => {
    it('should register agent and return success', async () => {
      const req = createMockRequest({
        body: {
          agentId: 'new-agent',
          metadata: { type: 'content_creation' }
        }
      });
      const res = createMockResponse();
      
      await systemController.registerAgent(req, res);
      
      const healthService = await require('../../../src/core/monitoring/healthMonitoringService').getInstance();
      
      expect(healthService.registerAgent).toHaveBeenCalledWith(
        'new-agent',
        expect.objectContaining({ type: 'content_creation' })
      );
      
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        message: expect.stringContaining('registered successfully')
      }));
    });
    
    it('should return 400 if agent ID is missing', async () => {
      const req = createMockRequest({
        body: { metadata: {} }
      });
      const res = createMockResponse();
      
      await systemController.registerAgent(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'error',
        message: expect.stringContaining('required')
      }));
    });
  });
});