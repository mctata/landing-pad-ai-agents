/**
 * API tests for Content Controller
 */

const express = require('express');
const { setupApiTest } = require('../../../testing/setupApiTests');
const { createMockContent } = require('../../../testing/mockFactories');
const mongoose = require('mongoose');

// Create Express app for testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock agent container
  const mockStorage = {
    getAllContents: jest.fn(),
    countContents: jest.fn(),
    getContent: jest.fn(),
    storeContent: jest.fn(),
    updateContent: jest.fn(),
    deleteContent: jest.fn(),
    archiveContent: jest.fn(),
    addContentHistory: jest.fn(),
    getContentHistory: jest.fn(),
    getContentAnalytics: jest.fn()
  };
  
  const mockBrandAgent = {
    isRunning: true,
    getModule: jest.fn().mockReturnValue({
      check: jest.fn().mockResolvedValue(true)
    })
  };
  
  const mockOptimisationAgent = {
    isRunning: true,
    getModule: jest.fn().mockReturnValue({
      analyze: jest.fn().mockResolvedValue({
        views: 1000,
        shares: 50,
        conversions: 10,
        engagementRate: 0.05
      })
    })
  };
  
  const mockAgentContainer = {
    storage: mockStorage,
    agents: {
      brandConsistency: mockBrandAgent,
      optimisation: mockOptimisationAgent
    }
  };
  
  app.locals.agentContainer = mockAgentContainer;
  app.locals.logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  
  // Mock auth middleware
  app.use((req, res, next) => {
    req.user = req.user || { id: 'test-user', roles: ['admin'] };
    next();
  });
  
  // Import controller and setup routes
  const contentController = require('../../../src/api/controllers/contentController');
  
  // Setup test routes
  app.get('/api/content', contentController.listContent);
  app.get('/api/content/:id', contentController.getContent);
  app.post('/api/content', contentController.createContent);
  app.put('/api/content/:id', contentController.updateContent);
  app.delete('/api/content/:id', contentController.deleteContent);
  app.get('/api/content/:id/history', contentController.getContentHistory);
  app.get('/api/content/:id/analytics', contentController.getContentAnalytics);
  
  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: {
        message: err.message,
        status: err.status
      }
    });
  });
  
  return { app, mockAgentContainer };
}

describe('Content Controller API', () => {
  let testUtils;
  let mockAgentContainer;
  
  beforeAll(async () => {
    const { app, mockAgentContainer: mock } = createTestApp();
    testUtils = await setupApiTest(app);
    mockAgentContainer = mock;
  });
  
  afterAll(async () => {
    await testUtils.closeApiTest();
  });
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockAgentContainer.storage.getAllContents.mockResolvedValue([]);
    mockAgentContainer.storage.countContents.mockResolvedValue(0);
    mockAgentContainer.storage.getContent.mockResolvedValue(null);
  });
  
  describe('GET /api/content', () => {
    it('should return a list of content with pagination', async () => {
      // Arrange
      const mockContents = [
        createMockContent({ contentId: 'content-1', title: 'Content 1' }),
        createMockContent({ contentId: 'content-2', title: 'Content 2' })
      ];
      
      mockAgentContainer.storage.getAllContents.mockResolvedValue(mockContents);
      mockAgentContainer.storage.countContents.mockResolvedValue(2);
      
      // Act
      const response = await testUtils.authRequest()
        .get('/api/content')
        .query({ page: 1, limit: 10 })
        .expect(200);
      
      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.contents).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBe(2);
      
      // Verify call parameters
      expect(mockAgentContainer.storage.getAllContents).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          skip: 0,
          limit: 10
        })
      );
    });
    
    it('should apply filters when provided', async () => {
      // Arrange
      const mockContents = [
        createMockContent({ contentId: 'blog-1', title: 'Blog 1', type: 'blog' })
      ];
      
      mockAgentContainer.storage.getAllContents.mockResolvedValue(mockContents);
      mockAgentContainer.storage.countContents.mockResolvedValue(1);
      
      // Act
      const response = await testUtils.authRequest()
        .get('/api/content')
        .query({ type: 'blog', status: 'published', category: 'technology' })
        .expect(200);
      
      // Assert
      expect(response.body.contents).toHaveLength(1);
      
      // Verify filter parameters
      expect(mockAgentContainer.storage.getAllContents).toHaveBeenCalledWith(
        {
          type: 'blog',
          status: 'published',
          categories: { $in: ['technology'] }
        },
        expect.any(Object)
      );
    });
  });
  
  describe('GET /api/content/:id', () => {
    it('should return content by ID', async () => {
      // Arrange
      const mockContent = createMockContent({
        contentId: 'test-content',
        title: 'Test Content',
        content: 'This is the content body'
      });
      
      mockAgentContainer.storage.getContent.mockResolvedValue(mockContent);
      
      // Act
      const response = await testUtils.authRequest()
        .get('/api/content/test-content')
        .expect(200);
      
      // Assert
      expect(response.body).toEqual(mockContent);
      expect(mockAgentContainer.storage.getContent).toHaveBeenCalledWith('test-content');
    });
    
    it('should return 404 for non-existent content', async () => {
      // Arrange
      mockAgentContainer.storage.getContent.mockResolvedValue(null);
      
      // Act & Assert
      const response = await testUtils.authRequest()
        .get('/api/content/non-existent')
        .expect(404);
      
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('content_not_found');
    });
  });
  
  describe('POST /api/content', () => {
    it('should create new content', async () => {
      // Arrange
      const contentId = 'new-content-123';
      mockAgentContainer.storage.storeContent.mockResolvedValue(contentId);
      
      const newContent = {
        title: 'New Content',
        type: 'blog',
        content: 'This is new content for testing',
        meta_description: 'Test description',
        keywords: ['test', 'content', 'api'],
        categories: ['testing'],
        status: 'draft'
      };
      
      // Act
      const response = await testUtils.authRequest()
        .post('/api/content')
        .send(newContent)
        .expect(201);
      
      // Assert
      expect(response.body.message).toContain('created successfully');
      expect(response.body.contentId).toBe(contentId);
      
      // Verify storage call
      expect(mockAgentContainer.storage.storeContent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: newContent.title,
          type: newContent.type,
          content: newContent.content,
          createdBy: 'test-user'
        })
      );
    });
    
    it('should run brand consistency check for non-draft content', async () => {
      // Arrange
      const contentId = 'published-content-123';
      mockAgentContainer.storage.storeContent.mockResolvedValue(contentId);
      
      const publishedContent = {
        title: 'Published Content',
        type: 'blog',
        content: 'This is content ready for publishing',
        status: 'published'
      };
      
      // Act
      await testUtils.authRequest()
        .post('/api/content')
        .send(publishedContent)
        .expect(201);
      
      // Assert
      const brandAgent = mockAgentContainer.agents.brandConsistency;
      const consistencyChecker = brandAgent.getModule();
      
      expect(consistencyChecker.check).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId,
          level: 'normal',
          userId: 'test-user'
        })
      );
    });
    
    it('should not run brand check for draft content', async () => {
      // Arrange
      mockAgentContainer.storage.storeContent.mockResolvedValue('draft-content-123');
      
      const draftContent = {
        title: 'Draft Content',
        type: 'blog',
        content: 'This is draft content',
        status: 'draft'
      };
      
      // Act
      await testUtils.authRequest()
        .post('/api/content')
        .send(draftContent)
        .expect(201);
      
      // Assert
      const brandAgent = mockAgentContainer.agents.brandConsistency;
      const consistencyChecker = brandAgent.getModule();
      
      expect(consistencyChecker.check).not.toHaveBeenCalled();
    });
  });
  
  describe('PUT /api/content/:id', () => {
    it('should update existing content', async () => {
      // Arrange
      const contentId = 'existing-content';
      const existingContent = createMockContent({
        contentId,
        title: 'Original Title',
        content: 'Original content',
        status: 'draft'
      });
      
      mockAgentContainer.storage.getContent.mockResolvedValue(existingContent);
      
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content',
        status: 'pending_review'
      };
      
      // Act
      const response = await testUtils.authRequest()
        .put(`/api/content/${contentId}`)
        .send(updateData)
        .expect(200);
      
      // Assert
      expect(response.body.message).toContain('updated successfully');
      expect(response.body.contentId).toBe(contentId);
      
      // Verify update call
      expect(mockAgentContainer.storage.updateContent).toHaveBeenCalledWith(
        contentId,
        expect.objectContaining({
          title: updateData.title,
          content: updateData.content,
          status: updateData.status,
          updatedBy: 'test-user'
        })
      );
      
      // Verify history was added
      expect(mockAgentContainer.storage.addContentHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId,
          previousVersion: existingContent
        })
      );
    });
    
    it('should return 404 when updating non-existent content', async () => {
      // Arrange
      mockAgentContainer.storage.getContent.mockResolvedValue(null);
      
      // Act & Assert
      const response = await testUtils.authRequest()
        .put('/api/content/non-existent')
        .send({ title: 'Updated Title' })
        .expect(404);
      
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('content_not_found');
      expect(mockAgentContainer.storage.updateContent).not.toHaveBeenCalled();
    });
    
    it('should run brand check when changing status to published', async () => {
      // Arrange
      const contentId = 'to-publish';
      const existingContent = createMockContent({
        contentId,
        title: 'Draft Content',
        status: 'draft'
      });
      
      mockAgentContainer.storage.getContent.mockResolvedValue(existingContent);
      
      // Act
      await testUtils.authRequest()
        .put(`/api/content/${contentId}`)
        .send({ status: 'published' })
        .expect(200);
      
      // Assert
      const brandAgent = mockAgentContainer.agents.brandConsistency;
      const consistencyChecker = brandAgent.getModule();
      
      expect(consistencyChecker.check).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId,
          level: 'normal',
          userId: 'test-user'
        })
      );
    });
  });
  
  describe('DELETE /api/content/:id', () => {
    it('should delete existing content', async () => {
      // Arrange
      const contentId = 'to-delete';
      const existingContent = createMockContent({
        contentId,
        title: 'Content to Delete'
      });
      
      mockAgentContainer.storage.getContent.mockResolvedValue(existingContent);
      
      // Act
      const response = await testUtils.authRequest()
        .delete(`/api/content/${contentId}`)
        .query({ reason: 'test_deletion' })
        .expect(200);
      
      // Assert
      expect(response.body.message).toContain('deleted successfully');
      
      // Verify archive and delete calls
      expect(mockAgentContainer.storage.archiveContent).toHaveBeenCalledWith(
        contentId,
        expect.objectContaining({
          archivedBy: 'test-user',
          reason: 'test_deletion'
        })
      );
      
      expect(mockAgentContainer.storage.deleteContent).toHaveBeenCalledWith(contentId);
    });
    
    it('should return 404 when deleting non-existent content', async () => {
      // Arrange
      mockAgentContainer.storage.getContent.mockResolvedValue(null);
      
      // Act & Assert
      const response = await testUtils.authRequest()
        .delete('/api/content/non-existent')
        .expect(404);
      
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('content_not_found');
      expect(mockAgentContainer.storage.deleteContent).not.toHaveBeenCalled();
    });
  });
  
  describe('GET /api/content/:id/history', () => {
    it('should return content history', async () => {
      // Arrange
      const contentId = 'content-with-history';
      const existingContent = createMockContent({ contentId });
      
      const mockHistory = [
        {
          versionNumber: 2,
          content: 'Version 2 content',
          updatedAt: new Date(),
          updatedBy: 'user-1'
        },
        {
          versionNumber: 1,
          content: 'Version 1 content',
          updatedAt: new Date(Date.now() - 86400000),
          updatedBy: 'user-1'
        }
      ];
      
      mockAgentContainer.storage.getContent.mockResolvedValue(existingContent);
      mockAgentContainer.storage.getContentHistory.mockResolvedValue(mockHistory);
      
      // Act
      const response = await testUtils.authRequest()
        .get(`/api/content/${contentId}/history`)
        .expect(200);
      
      // Assert
      expect(response.body.contentId).toBe(contentId);
      expect(response.body.history).toEqual(mockHistory);
      expect(mockAgentContainer.storage.getContentHistory).toHaveBeenCalledWith(contentId);
    });
    
    it('should return 404 for non-existent content history', async () => {
      // Arrange
      mockAgentContainer.storage.getContent.mockResolvedValue(null);
      
      // Act & Assert
      await testUtils.authRequest()
        .get('/api/content/non-existent/history')
        .expect(404);
      
      expect(mockAgentContainer.storage.getContentHistory).not.toHaveBeenCalled();
    });
  });
  
  describe('GET /api/content/:id/analytics', () => {
    it('should return content analytics from optimisation agent', async () => {
      // Arrange
      const contentId = 'content-with-analytics';
      const existingContent = createMockContent({ contentId });
      
      mockAgentContainer.storage.getContent.mockResolvedValue(existingContent);
      
      const mockAnalytics = {
        views: 1000,
        shares: 50,
        conversions: 10,
        engagementRate: 0.05
      };
      
      const performanceAnalyzer = mockAgentContainer.agents.optimisation.getModule();
      performanceAnalyzer.analyze.mockResolvedValue(mockAnalytics);
      
      // Act
      const response = await testUtils.authRequest()
        .get(`/api/content/${contentId}/analytics`)
        .query({ timeframe: 'week' })
        .expect(200);
      
      // Assert
      expect(response.body.contentId).toBe(contentId);
      expect(response.body.timeframe).toBe('week');
      expect(response.body.analytics).toEqual(mockAnalytics);
      
      // Verify optimisation agent was called
      expect(performanceAnalyzer.analyze).toHaveBeenCalledWith(
        expect.objectContaining({
          contentId,
          timeframe: 'week',
          userId: 'test-user'
        })
      );
    });
    
    it('should fall back to storage analytics if optimisation agent fails', async () => {
      // Arrange
      const contentId = 'fallback-analytics';
      const existingContent = createMockContent({ contentId });
      
      mockAgentContainer.storage.getContent.mockResolvedValue(existingContent);
      
      const mockStorageAnalytics = {
        views: 500,
        shares: 20
      };
      
      // Make optimization agent fail
      const performanceAnalyzer = mockAgentContainer.agents.optimisation.getModule();
      performanceAnalyzer.analyze.mockRejectedValue(new Error('Optimization failed'));
      
      // Set up fallback analytics
      mockAgentContainer.storage.getContentAnalytics.mockResolvedValue(mockStorageAnalytics);
      
      // Act
      const response = await testUtils.authRequest()
        .get(`/api/content/${contentId}/analytics`)
        .expect(200);
      
      // Assert
      expect(response.body.analytics).toEqual(mockStorageAnalytics);
      
      // Verify fallback was called
      expect(mockAgentContainer.storage.getContentAnalytics).toHaveBeenCalledWith(
        contentId,
        'month' // Default timeframe
      );
    });
  });
});