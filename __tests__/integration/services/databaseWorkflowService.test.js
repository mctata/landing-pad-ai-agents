/**
 * Integration tests for the Database Service - Workflow Operations
 */

const testDatabase = require('../../../testing/setupTestDatabase');
const { mockFactories } = require('../../../testing/testHelpers');
const DatabaseService = require('../../../src/common/services/databaseService');
const mongoose = require('mongoose');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('DatabaseService Workflow Operations', () => {
  let databaseService;

  // Connect to test database before all tests
  beforeAll(async () => {
    await testDatabase.connect();
    
    // Initialize database service with test config
    const config = {
      uri: global.__MONGO_URI__,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    };
    
    databaseService = new DatabaseService(config, mockLogger);
    await databaseService.connect();
  });

  // Clear database before each test
  beforeEach(async () => {
    await testDatabase.clearDatabase();
    jest.clearAllMocks();
  });

  // Disconnect from database after all tests
  afterAll(async () => {
    await databaseService.disconnect();
    await testDatabase.closeDatabase();
  });

  describe('Workflow CRUD Operations', () => {
    it('should create workflow with generated ID', async () => {
      // Arrange
      const workflowData = {
        name: 'Test Workflow',
        description: 'A test workflow',
        type: 'content_creation',
        status: 'pending',
        priority: 5,
        createdBy: 'test-user',
        steps: [
          {
            stepId: 'step1',
            name: 'Generate Content',
            type: 'content_creation',
            status: 'pending',
            config: {
              contentType: 'blog',
              wordCount: 1000
            }
          },
          {
            stepId: 'step2',
            name: 'Review Content',
            type: 'content_management',
            status: 'pending',
            config: {
              reviewType: 'editorial'
            }
          }
        ]
      };
      
      // Act
      const workflow = await databaseService.createWorkflow(workflowData);
      
      // Assert
      expect(workflow).toBeDefined();
      expect(workflow.workflowId).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.type).toBe('content_creation');
      expect(workflow.status).toBe('pending');
      expect(workflow.priority).toBe(5);
      expect(workflow.steps).toHaveLength(2);
      expect(workflow.steps[0].stepId).toBe('step1');
      expect(workflow.steps[1].stepId).toBe('step2');
      
      // Verify workflow was saved
      const savedWorkflow = await databaseService.getWorkflow(workflow.workflowId);
      expect(savedWorkflow).toBeDefined();
      expect(savedWorkflow.workflowId).toBe(workflow.workflowId);
    });
    
    it('should create workflow with provided ID', async () => {
      // Arrange
      const workflowId = 'custom-workflow-id';
      const workflowData = {
        workflowId,
        name: 'Custom ID Workflow',
        type: 'content_optimization',
        status: 'pending',
        createdBy: 'test-user',
        steps: []
      };
      
      // Act
      const workflow = await databaseService.createWorkflow(workflowData);
      
      // Assert
      expect(workflow.workflowId).toBe(workflowId);
    });
    
    it('should retrieve workflow by ID', async () => {
      // Arrange
      const workflowData = {
        name: 'Retrievable Workflow',
        type: 'content_distribution',
        status: 'pending',
        createdBy: 'test-user',
        steps: [
          {
            stepId: 'dist1',
            name: 'Social Media Distribution',
            type: 'distribution',
            status: 'pending'
          }
        ]
      };
      
      const created = await databaseService.createWorkflow(workflowData);
      
      // Act
      const retrieved = await databaseService.getWorkflow(created.workflowId);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.workflowId).toBe(created.workflowId);
      expect(retrieved.name).toBe('Retrievable Workflow');
      expect(retrieved.type).toBe('content_distribution');
      expect(retrieved.steps).toHaveLength(1);
      expect(retrieved.steps[0].stepId).toBe('dist1');
    });
    
    it('should update workflow', async () => {
      // Arrange
      const workflowData = {
        name: 'Original Workflow',
        description: 'Before update',
        type: 'content_creation',
        status: 'pending',
        priority: 3,
        createdBy: 'test-user',
        steps: [
          {
            stepId: 'step1',
            name: 'Original Step',
            type: 'content_creation',
            status: 'pending'
          }
        ]
      };
      
      const workflow = await databaseService.createWorkflow(workflowData);
      const updateData = {
        name: 'Updated Workflow',
        description: 'After update',
        status: 'in_progress',
        priority: 5,
        steps: [
          {
            stepId: 'step1',
            name: 'Original Step',
            type: 'content_creation',
            status: 'completed'
          },
          {
            stepId: 'step2',
            name: 'New Step',
            type: 'optimization',
            status: 'pending'
          }
        ]
      };
      
      // Act
      const updated = await databaseService.updateWorkflow(workflow.workflowId, updateData);
      
      // Assert
      expect(updated).toBeDefined();
      expect(updated.workflowId).toBe(workflow.workflowId);
      expect(updated.name).toBe('Updated Workflow');
      expect(updated.description).toBe('After update');
      expect(updated.status).toBe('in_progress');
      expect(updated.priority).toBe(5);
      expect(updated.steps).toHaveLength(2);
      expect(updated.steps[0].status).toBe('completed');
      expect(updated.steps[1].stepId).toBe('step2');
    });
    
    it('should throw error when updating non-existent workflow', async () => {
      // Arrange
      const nonExistentId = 'non-existent-workflow-id';
      const updateData = {
        name: 'Will Fail',
        status: 'pending'
      };
      
      // Act & Assert
      await expect(databaseService.updateWorkflow(nonExistentId, updateData))
        .rejects.toThrow(`Workflow with ID ${nonExistentId} not found`);
    });
  });
  
  describe('Workflow Step Operations', () => {
    it('should update a single workflow step', async () => {
      // Arrange
      const workflowData = {
        name: 'Step Update Test',
        type: 'content_creation',
        status: 'in_progress',
        createdBy: 'test-user',
        steps: [
          {
            stepId: 'step1',
            name: 'Content Planning',
            type: 'planning',
            status: 'completed',
            result: { planId: 'plan123' }
          },
          {
            stepId: 'step2',
            name: 'Content Writing',
            type: 'creation',
            status: 'pending',
            config: { wordCount: 1000 }
          },
          {
            stepId: 'step3',
            name: 'Content Review',
            type: 'review',
            status: 'pending'
          }
        ]
      };
      
      const workflow = await databaseService.createWorkflow(workflowData);
      const stepUpdateData = {
        status: 'in_progress',
        startedAt: new Date(),
        config: { 
          wordCount: 1500,
          tone: 'professional'
        }
      };
      
      // Act
      const updated = await databaseService.updateWorkflowStep(
        workflow.workflowId, 
        'step2', 
        stepUpdateData
      );
      
      // Assert
      expect(updated).toBeDefined();
      
      // Find the updated step
      const updatedStep = updated.steps.find(s => s.stepId === 'step2');
      expect(updatedStep).toBeDefined();
      expect(updatedStep.status).toBe('in_progress');
      expect(updatedStep.startedAt).toBeDefined();
      expect(updatedStep.config).toEqual({
        wordCount: 1500,
        tone: 'professional'
      });
      
      // Other steps should be unchanged
      const step1 = updated.steps.find(s => s.stepId === 'step1');
      expect(step1.status).toBe('completed');
      expect(step1.result).toEqual({ planId: 'plan123' });
      
      const step3 = updated.steps.find(s => s.stepId === 'step3');
      expect(step3.status).toBe('pending');
    });
    
    it('should throw error when updating step in non-existent workflow', async () => {
      // Arrange
      const nonExistentId = 'non-existent-workflow-id';
      const stepUpdateData = {
        status: 'completed'
      };
      
      // Act & Assert
      await expect(databaseService.updateWorkflowStep(nonExistentId, 'step1', stepUpdateData))
        .rejects.toThrow(`Workflow with ID ${nonExistentId} not found`);
    });
    
    it('should throw error when updating non-existent step', async () => {
      // Arrange
      const workflowData = {
        name: 'Missing Step Test',
        type: 'test',
        steps: [
          { stepId: 'existing-step', name: 'Existing Step', status: 'pending' }
        ]
      };
      
      const workflow = await databaseService.createWorkflow(workflowData);
      const nonExistentStepId = 'non-existent-step';
      const stepUpdateData = {
        status: 'completed'
      };
      
      // Act & Assert
      await expect(databaseService.updateWorkflowStep(workflow.workflowId, nonExistentStepId, stepUpdateData))
        .rejects.toThrow(`Step with ID ${nonExistentStepId} not found in workflow ${workflow.workflowId}`);
    });
  });
  
  describe('Active Workflow Retrieval', () => {
    beforeEach(async () => {
      // Create test workflows with different statuses and types
      const workflows = [
        {
          name: 'Blog Creation',
          type: 'content_creation',
          status: 'pending',
          priority: 3,
          createdAt: new Date('2023-01-01')
        },
        {
          name: 'Social Media Posts',
          type: 'content_creation',
          status: 'in_progress',
          priority: 5,
          createdAt: new Date('2023-01-02')
        },
        {
          name: 'SEO Optimization',
          type: 'optimization',
          status: 'pending',
          priority: 4,
          createdAt: new Date('2023-01-03')
        },
        {
          name: 'Email Campaign',
          type: 'marketing',
          status: 'in_progress',
          priority: 2,
          createdAt: new Date('2023-01-04')
        },
        {
          name: 'Completed Workflow',
          type: 'content_creation',
          status: 'completed',
          priority: 5,
          createdAt: new Date('2023-01-05')
        },
        {
          name: 'Failed Workflow',
          type: 'optimization',
          status: 'failed',
          priority: 1,
          createdAt: new Date('2023-01-06')
        }
      ];
      
      for (const workflow of workflows) {
        await databaseService.createWorkflow(workflow);
      }
    });
    
    it('should retrieve all active workflows', async () => {
      // Act
      const activeWorkflows = await databaseService.getActiveWorkflows();
      
      // Assert
      expect(activeWorkflows).toHaveLength(4); // 2 pending, 2 in_progress
      
      // Only pending and in_progress workflows should be returned
      const statuses = activeWorkflows.map(w => w.status);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('in_progress');
      expect(statuses).not.toContain('completed');
      expect(statuses).not.toContain('failed');
    });
    
    it('should retrieve active workflows of specific type', async () => {
      // Act
      const contentCreationWorkflows = await databaseService.getActiveWorkflows({ 
        type: 'content_creation' 
      });
      
      // Assert
      expect(contentCreationWorkflows).toHaveLength(2);
      expect(contentCreationWorkflows.every(w => w.type === 'content_creation')).toBe(true);
      expect(contentCreationWorkflows.every(w => ['pending', 'in_progress'].includes(w.status))).toBe(true);
    });
    
    it('should retrieve active workflows sorted by priority then creation date', async () => {
      // Act
      const activeWorkflows = await databaseService.getActiveWorkflows();
      
      // Assert
      
      // Should be sorted by priority (descending) then by createdAt (ascending)
      expect(activeWorkflows[0].name).toBe('Social Media Posts'); // Priority 5
      expect(activeWorkflows[1].name).toBe('SEO Optimization');   // Priority 4
      expect(activeWorkflows[2].name).toBe('Blog Creation');      // Priority 3
      expect(activeWorkflows[3].name).toBe('Email Campaign');     // Priority 2
    });
    
    it('should limit the number of workflows returned', async () => {
      // Act
      const limitedWorkflows = await databaseService.getActiveWorkflows({ limit: 2 });
      
      // Assert
      expect(limitedWorkflows).toHaveLength(2);
      
      // Should still follow sort order (highest priority first)
      expect(limitedWorkflows[0].name).toBe('Social Media Posts'); // Priority 5
      expect(limitedWorkflows[1].name).toBe('SEO Optimization');   // Priority 4
    });
  });
});