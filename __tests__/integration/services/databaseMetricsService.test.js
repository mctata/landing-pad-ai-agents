/**
 * Integration tests for the Database Service - Metrics Operations
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

describe('DatabaseService Metrics Operations', () => {
  let databaseService;
  let testContentId;

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
    
    // Create a test content item for metrics
    const content = await databaseService.createContent({
      title: 'Test Content for Metrics',
      type: 'blog',
      status: 'published',
      createdBy: 'test-user'
    });
    
    testContentId = content.contentId;
  });

  // Disconnect from database after all tests
  afterAll(async () => {
    await databaseService.disconnect();
    await testDatabase.closeDatabase();
  });

  describe('Metrics CRUD Operations', () => {
    it('should create metrics with generated ID', async () => {
      // Arrange
      const metricData = {
        contentId: testContentId,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-31')
        },
        views: 1000,
        uniqueVisitors: 750,
        avgTimeOnPage: 120, // seconds
        bounceRate: 0.35,
        conversionRate: 0.05,
        engagementRate: 0.28,
        shareCount: {
          facebook: 25,
          twitter: 35,
          linkedin: 15
        },
        commentCount: 12,
        likeCount: 45,
        source: 'google-analytics'
      };
      
      // Act
      const metrics = await databaseService.createMetrics(metricData);
      
      // Assert
      expect(metrics).toBeDefined();
      expect(metrics.performanceId).toBeDefined();
      expect(metrics.contentId).toBe(testContentId);
      expect(metrics.views).toBe(1000);
      expect(metrics.uniqueVisitors).toBe(750);
      expect(metrics.bounceRate).toBe(0.35);
      expect(metrics.shareCount.facebook).toBe(25);
      expect(metrics.commentCount).toBe(12);
      
      // Verify metrics were saved
      const savedMetrics = await databaseService.getMetrics(metrics.performanceId);
      expect(savedMetrics).toBeDefined();
      expect(savedMetrics.performanceId).toBe(metrics.performanceId);
    });
    
    it('should create metrics with provided ID', async () => {
      // Arrange
      const performanceId = 'custom-metrics-id';
      const metricData = {
        performanceId,
        contentId: testContentId,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-31')
        },
        views: 500,
        source: 'manual'
      };
      
      // Act
      const metrics = await databaseService.createMetrics(metricData);
      
      // Assert
      expect(metrics.performanceId).toBe(performanceId);
    });
    
    it('should retrieve metrics by ID', async () => {
      // Arrange
      const metricData = {
        contentId: testContentId,
        dateRange: {
          start: new Date('2023-02-01'),
          end: new Date('2023-02-28')
        },
        views: 2500,
        uniqueVisitors: 1800,
        source: 'google-analytics'
      };
      
      const created = await databaseService.createMetrics(metricData);
      
      // Act
      const retrieved = await databaseService.getMetrics(created.performanceId);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.performanceId).toBe(created.performanceId);
      expect(retrieved.contentId).toBe(testContentId);
      expect(retrieved.views).toBe(2500);
      expect(retrieved.uniqueVisitors).toBe(1800);
    });
  });
  
  describe('Content Metrics Retrieval', () => {
    beforeEach(async () => {
      // Create multiple metrics records for the test content
      const metrics = [
        {
          contentId: testContentId,
          dateRange: {
            start: new Date('2023-01-01'),
            end: new Date('2023-01-31')
          },
          views: 1000,
          uniqueVisitors: 750,
          source: 'google-analytics'
        },
        {
          contentId: testContentId,
          dateRange: {
            start: new Date('2023-02-01'),
            end: new Date('2023-02-28')
          },
          views: 1500,
          uniqueVisitors: 1200,
          source: 'google-analytics'
        },
        {
          contentId: testContentId,
          dateRange: {
            start: new Date('2023-03-01'),
            end: new Date('2023-03-31')
          },
          views: 2000,
          uniqueVisitors: 1600,
          source: 'google-analytics'
        }
      ];
      
      for (const metric of metrics) {
        await databaseService.createMetrics(metric);
      }
      
      // Create metrics for another content item to ensure filtering works
      const otherContent = await databaseService.createContent({
        title: 'Another Test Content',
        type: 'blog',
        status: 'published'
      });
      
      await databaseService.createMetrics({
        contentId: otherContent.contentId,
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-31')
        },
        views: 500,
        source: 'google-analytics'
      });
    });
    
    it('should retrieve all metrics for a content item', async () => {
      // Act
      const contentMetrics = await databaseService.getContentMetrics(testContentId);
      
      // Assert
      expect(contentMetrics).toHaveLength(3);
      
      // Should be sorted by date (newest first)
      expect(contentMetrics[0].dateRange.start.getMonth()).toBe(2); // March (0-indexed)
      expect(contentMetrics[1].dateRange.start.getMonth()).toBe(1); // February
      expect(contentMetrics[2].dateRange.start.getMonth()).toBe(0); // January
      
      // All metrics should belong to the test content
      expect(contentMetrics.every(m => m.contentId === testContentId)).toBe(true);
    });
    
    it('should limit the number of metrics returned', async () => {
      // Act
      const contentMetrics = await databaseService.getContentMetrics(testContentId, { limit: 2 });
      
      // Assert
      expect(contentMetrics).toHaveLength(2);
      
      // Should return the 2 most recent metrics
      expect(contentMetrics[0].dateRange.start.getMonth()).toBe(2); // March
      expect(contentMetrics[1].dateRange.start.getMonth()).toBe(1); // February
    });
    
    it('should filter metrics by date range', async () => {
      // Act - Get metrics from February only
      const contentMetrics = await databaseService.getContentMetrics(testContentId, {
        dateStart: '2023-02-01',
        dateEnd: '2023-02-28'
      });
      
      // Assert
      expect(contentMetrics).toHaveLength(1);
      expect(contentMetrics[0].dateRange.start.getMonth()).toBe(1); // February
      expect(contentMetrics[0].views).toBe(1500);
    });
    
    it('should return empty array for non-existent content', async () => {
      // Act
      const contentMetrics = await databaseService.getContentMetrics('non-existent-content-id');
      
      // Assert
      expect(contentMetrics).toEqual([]);
    });
  });
});