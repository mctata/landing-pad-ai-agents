/**
 * Integration tests for the Database Service - Brief Operations
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

describe('DatabaseService Brief Operations', () => {
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

  describe('Brief CRUD Operations', () => {
    it('should create brief with generated ID', async () => {
      // Arrange
      const briefData = {
        title: 'Test Content Brief',
        description: 'Brief for test content',
        contentType: 'blog',
        keywords: ['test', 'content', 'brief'],
        targetAudience: 'Developers and content creators',
        tone: 'Informative',
        objectives: ['Explain content brief creation', 'Showcase best practices'],
        references: [
          { url: 'https://example.com/reference1', description: 'Example reference' }
        ],
        requestor: 'test-user',
        status: 'pending'
      };
      
      // Act
      const brief = await databaseService.createBrief(briefData);
      
      // Assert
      expect(brief).toBeDefined();
      expect(brief.briefId).toBeDefined();
      expect(brief.title).toBe('Test Content Brief');
      expect(brief.contentType).toBe('blog');
      expect(brief.keywords).toContain('test');
      expect(brief.targetAudience).toBe('Developers and content creators');
      expect(brief.tone).toBe('Informative');
      expect(brief.objectives).toHaveLength(2);
      expect(brief.references).toHaveLength(1);
      expect(brief.requestor).toBe('test-user');
      expect(brief.status).toBe('pending');
      
      // Verify brief was saved
      const savedBrief = await databaseService.getBrief(brief.briefId);
      expect(savedBrief).toBeDefined();
      expect(savedBrief.briefId).toBe(brief.briefId);
    });
    
    it('should create brief with provided ID', async () => {
      // Arrange
      const briefId = 'custom-brief-id';
      const briefData = {
        briefId,
        title: 'Custom ID Brief',
        contentType: 'social',
        requestor: 'test-user',
        status: 'pending'
      };
      
      // Act
      const brief = await databaseService.createBrief(briefData);
      
      // Assert
      expect(brief.briefId).toBe(briefId);
    });
    
    it('should retrieve brief by ID', async () => {
      // Arrange
      const briefData = {
        title: 'Retrievable Brief',
        contentType: 'page',
        keywords: ['landing', 'page', 'design'],
        requestor: 'test-user',
        status: 'pending'
      };
      
      const created = await databaseService.createBrief(briefData);
      
      // Act
      const retrieved = await databaseService.getBrief(created.briefId);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.briefId).toBe(created.briefId);
      expect(retrieved.title).toBe('Retrievable Brief');
      expect(retrieved.contentType).toBe('page');
      expect(retrieved.keywords).toContain('landing');
    });
    
    it('should update brief information', async () => {
      // Arrange
      const briefData = {
        title: 'Original Brief',
        description: 'Before update',
        contentType: 'blog',
        keywords: ['original', 'keywords'],
        requestor: 'test-user',
        status: 'pending'
      };
      
      const brief = await databaseService.createBrief(briefData);
      const updateData = {
        title: 'Updated Brief',
        description: 'After update',
        contentType: 'blog',
        keywords: ['updated', 'keywords', 'new'],
        targetAudience: 'Marketing professionals',
        status: 'in_progress',
        assignedTo: 'content-creator'
      };
      
      // Act
      const updated = await databaseService.updateBrief(brief.briefId, updateData);
      
      // Assert
      expect(updated).toBeDefined();
      expect(updated.briefId).toBe(brief.briefId);
      expect(updated.title).toBe('Updated Brief');
      expect(updated.description).toBe('After update');
      expect(updated.keywords).toContain('updated');
      expect(updated.keywords).toContain('new');
      expect(updated.keywords).not.toContain('original');
      expect(updated.targetAudience).toBe('Marketing professionals');
      expect(updated.status).toBe('in_progress');
      expect(updated.assignedTo).toBe('content-creator');
      expect(updated.requestor).toBe('test-user'); // Unchanged
    });
    
    it('should throw error when updating non-existent brief', async () => {
      // Arrange
      const nonExistentId = 'non-existent-brief-id';
      const updateData = {
        title: 'Will Fail',
        status: 'pending'
      };
      
      // Act & Assert
      await expect(databaseService.updateBrief(nonExistentId, updateData))
        .rejects.toThrow(`Brief with ID ${nonExistentId} not found`);
    });
  });
  
  describe('Brief Workflow Integration', () => {
    it('should link content to brief', async () => {
      // Arrange
      const briefData = {
        title: 'Integration Brief',
        contentType: 'blog',
        requestor: 'test-user',
        status: 'pending'
      };
      
      const brief = await databaseService.createBrief(briefData);
      
      // Create content based on brief
      const contentData = {
        title: 'Content from Brief',
        type: 'blog',
        status: 'draft',
        briefId: brief.briefId,
        createdBy: 'content-creator'
      };
      
      const content = await databaseService.createContent(contentData);
      
      // Act - Update brief to reference content
      const updatedBrief = await databaseService.updateBrief(brief.briefId, {
        status: 'completed',
        contentIds: [content.contentId]
      });
      
      // Assert
      expect(updatedBrief.status).toBe('completed');
      expect(updatedBrief.contentIds).toContain(content.contentId);
      
      // The content should reference the brief
      const retrievedContent = await databaseService.getContent(content.contentId);
      expect(retrievedContent.briefId).toBe(brief.briefId);
    });
  });
});