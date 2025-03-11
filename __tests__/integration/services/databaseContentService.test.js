/**
 * Integration tests for the Database Service - Content Operations
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

describe('DatabaseService Content Operations', () => {
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

  describe('Content CRUD Operations', () => {
    it('should create content with generated ID', async () => {
      // Arrange
      const contentData = {
        title: 'Test Content',
        type: 'blog',
        status: 'draft',
        content: {
          body: 'This is test content',
          format: 'markdown'
        },
        createdBy: 'test-user'
      };
      
      // Act
      const content = await databaseService.createContent(contentData);
      
      // Assert
      expect(content).toBeDefined();
      expect(content.contentId).toBeDefined();
      expect(content.title).toBe('Test Content');
      expect(content.type).toBe('blog');
      expect(content.status).toBe('draft');
      expect(content.content.body).toBe('This is test content');
      expect(content.content.format).toBe('markdown');
      expect(content.createdBy).toBe('test-user');
      
      // Verify content was saved
      const savedContent = await databaseService.getContent(content.contentId);
      expect(savedContent).toBeDefined();
      expect(savedContent.contentId).toBe(content.contentId);
      
      // Verify version was created
      const versions = await databaseService.getContentVersions(content.contentId);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
    });
    
    it('should create content with provided ID', async () => {
      // Arrange
      const contentId = 'custom-content-id';
      const contentData = {
        contentId,
        title: 'Custom ID Content',
        type: 'blog', // Using valid enum value from schema
        status: 'draft',
        content: {
          body: 'Custom ID content body',
          format: 'markdown'
        },
        createdBy: 'test-user'
      };
      
      // Act
      const content = await databaseService.createContent(contentData);
      
      // Assert
      expect(content.contentId).toBe(contentId);
    });
    
    it('should retrieve content by ID', async () => {
      // Arrange
      const contentData = {
        title: 'Retrievable Content',
        type: 'blog',
        status: 'published',
        content: {
          body: 'This is retrievable content',
          format: 'html'
        },
        createdBy: 'test-user'
      };
      
      const created = await databaseService.createContent(contentData);
      
      // Act
      const retrieved = await databaseService.getContent(created.contentId);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.contentId).toBe(created.contentId);
      expect(retrieved.title).toBe('Retrievable Content');
      expect(retrieved.status).toBe('published');
    });
    
    it('should update content and create a new version', async () => {
      // Arrange
      const contentData = {
        title: 'Original Title',
        type: 'blog',
        status: 'draft',
        content: {
          body: 'Original body',
          format: 'markdown'
        },
        createdBy: 'test-user'
      };
      
      const content = await databaseService.createContent(contentData);
      const updateData = {
        title: 'Updated Title',
        content: {
          body: 'Updated body',
          format: 'markdown'
        },
        status: 'published',
        updatedBy: 'editor-user'
      };
      
      // Act
      const updated = await databaseService.updateContent(content.contentId, updateData);
      
      // Assert
      expect(updated).toBeDefined();
      expect(updated.contentId).toBe(content.contentId);
      expect(updated.title).toBe('Updated Title');
      expect(updated.content.body).toBe('Updated body');
      expect(updated.content.format).toBe('markdown');
      expect(updated.status).toBe('published');
      expect(updated.updatedBy).toBe('editor-user');
      
      // Verify a new version was created
      const versions = await databaseService.getContentVersions(content.contentId);
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2); // Newest version first
      expect(versions[1].version).toBe(1);
      
      // Verify the original version data
      expect(versions[1].data.title).toBe('Original Title');
      expect(versions[1].data.content.body).toBe('Original body');
      expect(versions[1].data.content.format).toBe('markdown');
    });
    
    it('should perform soft-delete of content', async () => {
      // Arrange
      const contentData = {
        title: 'Content To Delete',
        type: 'blog',
        status: 'published',
        content: {
          body: 'This content will be deleted',
          format: 'markdown'
        },
        createdBy: 'test-user'
      };
      
      const content = await databaseService.createContent(contentData);
      
      // Act
      const deleted = await databaseService.deleteContent(content.contentId, true);
      
      // Assert
      expect(deleted).toBe(true);
      
      // Verify content still exists but has status "deleted"
      const retrievedAfterDelete = await databaseService.getContent(content.contentId);
      expect(retrievedAfterDelete).toBeDefined();
      expect(retrievedAfterDelete.status).toBe('deleted');
    });
    
    it('should perform hard-delete of content', async () => {
      // Arrange
      const contentData = {
        title: 'Content To Hard Delete',
        type: 'blog',
        status: 'published',
        content: {
          body: 'This content will be permanently deleted',
          format: 'markdown'
        },
        createdBy: 'test-user'
      };
      
      const content = await databaseService.createContent(contentData);
      
      // Act
      const deleted = await databaseService.deleteContent(content.contentId, false);
      
      // Assert
      expect(deleted).toBe(true);
      
      // Verify content no longer exists
      const retrievedAfterDelete = await databaseService.getContent(content.contentId);
      expect(retrievedAfterDelete).toBeNull();
    });
  });
  
  describe('Content Search', () => {
    beforeEach(async () => {
      // Create test content
      const contents = [
        {
          title: 'Blog Post About JavaScript',
          type: 'blog',
          status: 'published',
          content: { 
            body: 'JavaScript is a versatile programming language used for web development.',
            format: 'markdown'
          },
          categories: ['programming', 'web-development'],
          tags: ['javascript', 'nodejs', 'development'],
          createdBy: 'author1',
          createdAt: new Date('2023-01-01')
        },
        {
          title: 'Python Development Guide',
          type: 'blog',
          status: 'published',
          content: { 
            body: 'Python is a powerful programming language for data science and web applications.',
            format: 'markdown'
          },
          categories: ['programming', 'data-science'],
          tags: ['python', 'pandas', 'development'],
          createdBy: 'author2',
          createdAt: new Date('2023-02-01')
        },
        {
          title: 'Landing Page Design Tips',
          type: 'blog', // Changed from 'page' to match schema enum
          status: 'published',
          content: { 
            body: 'Design effective landing pages to increase conversion rates.',
            format: 'markdown'
          },
          categories: ['design', 'marketing'],
          tags: ['design', 'conversion', 'ux'],
          createdBy: 'author1',
          createdAt: new Date('2023-03-01')
        },
        {
          title: 'Social Media Strategy',
          type: 'social', // Changed from 'guide' to match schema enum
          status: 'draft',
          content: { 
            body: 'Develop an effective social media strategy for your business.',
            format: 'markdown'
          },
          categories: ['marketing', 'social-media'],
          tags: ['facebook', 'twitter', 'instagram', 'strategy'],
          createdBy: 'author3',
          createdAt: new Date('2023-04-01')
        }
      ];
      
      for (const content of contents) {
        await databaseService.createContent(content);
      }
    });
    
    it('should search content by type', async () => {
      // Act
      const result = await databaseService.searchContent({ type: 'blog' });
      
      // Assert
      expect(result.contents).toHaveLength(3); // We created 3 blog content items
      expect(result.contents.every(content => content.type === 'blog')).toBe(true);
    });
    
    it('should search content by status', async () => {
      // Act
      const result = await databaseService.searchContent({ status: 'draft' });
      
      // Assert
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].status).toBe('draft');
      expect(result.contents[0].title).toBe('Social Media Strategy');
    });
    
    it('should search content by category', async () => {
      // Act
      const result = await databaseService.searchContent({ categories: 'marketing' });
      
      // Assert
      expect(result.contents).toHaveLength(2);
      expect(result.contents.every(content => 
        content.categories.includes('marketing')
      )).toBe(true);
    });
    
    it('should search content by tag', async () => {
      // Act
      const result = await databaseService.searchContent({ tags: 'development' });
      
      // Assert
      expect(result.contents).toHaveLength(2);
      expect(result.contents.every(content => 
        content.tags.includes('development')
      )).toBe(true);
    });
    
    it('should search content by creator', async () => {
      // Act
      const result = await databaseService.searchContent({ createdBy: 'author1' });
      
      // Assert
      expect(result.contents).toHaveLength(2);
      expect(result.contents.every(content => 
        content.createdBy === 'author1'
      )).toBe(true);
    });
    
    it('should search content by date range', async () => {
      // Act
      const result = await databaseService.searchContent({ 
        dateFrom: '2023-02-01',
        dateTo: '2023-03-31'
      });
      
      // Assert
      expect(result.contents).toHaveLength(2);
      expect(result.contents[0].title).toBe('Landing Page Design Tips');
      expect(result.contents[1].title).toBe('Python Development Guide');
    });
    
    it('should paginate search results', async () => {
      // Act - Get first page with 2 items
      const page1 = await databaseService.searchContent({ 
        page: 1,
        limit: 2
      });
      
      // Get second page with 2 items
      const page2 = await databaseService.searchContent({ 
        page: 2,
        limit: 2
      });
      
      // Assert
      expect(page1.contents).toHaveLength(2);
      expect(page2.contents).toHaveLength(2);
      
      // Different items on different pages
      const page1Ids = page1.contents.map(c => c.contentId);
      const page2Ids = page2.contents.map(c => c.contentId);
      
      expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
      
      // Pagination info correct
      expect(page1.pagination.total).toBe(4);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.pages).toBe(2);
      expect(page1.pagination.limit).toBe(2);
    });
  });
  
  describe('Content Versioning', () => {
    it('should create and retrieve content versions', async () => {
      // Arrange
      const contentData = {
        title: 'Versioned Content',
        type: 'blog',
        status: 'draft',
        content: {
          body: 'Initial version content',
          format: 'markdown'
        },
        createdBy: 'test-user'
      };
      
      // Create content
      const content = await databaseService.createContent(contentData);
      
      // Update 1 - update the title
      const updateData1 = { 
        title: 'Updated Title V2',
        updatedBy: 'editor1'
      };
      const update1 = await databaseService.updateContent(content.contentId, updateData1);
      
      // Update 2 - update title and status
      const updateData2 = { 
        title: 'Final Title V3',
        status: 'published',
        updatedBy: 'editor2'
      };
      const update2 = await databaseService.updateContent(content.contentId, updateData2);
      
      // Get all versions
      const allVersions = await databaseService.getContentVersions(content.contentId);
      
      // Sort by version
      const sortedVersions = [...allVersions].sort((a, b) => b.version - a.version);
      
      // Get the latest content directly for comparison
      const latestContent = await databaseService.getContent(content.contentId);
      
      // Assert version count
      expect(allVersions.length).toBe(3);
      
      // Version 1 is the original content
      expect(sortedVersions[2].data.title).toBe('Versioned Content');
      expect(sortedVersions[2].data.status).toBe('draft');
      
      // Version 2 saved the original content when update 1 was applied
      expect(sortedVersions[1].data.title).toBe('Versioned Content');
      expect(sortedVersions[1].data.status).toBe('draft');
      
      // Version 3 saved the content after update 1 (but before update 2)
      expect(sortedVersions[0].data.title).toBe('Updated Title V2');
      expect(sortedVersions[0].data.status).toBe('draft');
      
      // The latest content state is after all updates
      expect(latestContent.title).toBe('Final Title V3');
      expect(latestContent.status).toBe('published');
    });
  });
});