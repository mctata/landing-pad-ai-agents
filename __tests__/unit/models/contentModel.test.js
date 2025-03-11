/**
 * Unit tests for Content Model
 */

const mongoose = require('mongoose');
const Content = require('../../../src/models/contentModel');

// Use in-memory mongoose to avoid affecting real database
describe('Content Model', () => {
  beforeAll(async () => {
    // Create mongoose connection for testing
    await mongoose.connect(global.__MONGO_URI__ || 'mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear content collection before each test
    await mongoose.connection.collection('contents').deleteMany({});
  });

  it('should generate a valid contentId', () => {
    const contentId = Content.generateContentId();
    expect(contentId).toBeDefined();
    expect(typeof contentId).toBe('string');
    expect(contentId).toMatch(/^CNT-[A-Z0-9]+$/);
    expect(contentId.length).toBeGreaterThan(10); // Reasonable length check
  });

  it('should create a new content document', async () => {
    // Arrange
    const contentData = {
      contentId: Content.generateContentId(),
      type: 'blog',
      title: 'Test Content',
      content: '<p>This is test content</p>',
      createdBy: 'test-user'
    };

    // Act
    const content = new Content(contentData);
    const savedContent = await content.save();

    // Assert
    expect(savedContent._id).toBeDefined();
    expect(savedContent.contentId).toBe(contentData.contentId);
    expect(savedContent.title).toBe(contentData.title);
    expect(savedContent.status).toBe('draft'); // Default value check
    expect(savedContent.version).toBe(1); // Default version
    expect(savedContent.slug).toBe('test-content'); // Slug generation
  });

  it('should automatically create a slug from title', async () => {
    // Arrange
    const contentData = {
      contentId: Content.generateContentId(),
      type: 'blog',
      title: 'This is a Test Title with Special@#$ Chars!!!',
      content: 'Test content',
      createdBy: 'test-user'
    };
    
    // Act
    const content = new Content(contentData);
    const savedContent = await content.save();
    
    // Assert
    expect(savedContent.slug).toBe('this-is-a-test-title-with-special-chars');
  });

  it('should increment version number when updating content', async () => {
    // Arrange
    const contentData = {
      contentId: Content.generateContentId(),
      type: 'blog',
      title: 'Original Title',
      content: 'Original content',
      createdBy: 'test-user'
    };
    
    // Act - Create content
    const content = new Content(contentData);
    const savedContent = await content.save();
    expect(savedContent.version).toBe(1);
    
    // Act - Update content
    savedContent.title = 'Updated Title';
    savedContent.content = 'Updated content';
    const updatedContent = await savedContent.save();
    
    // Assert
    expect(updatedContent.version).toBe(2);
    expect(updatedContent.slug).toBe('updated-title');
  });

  it('should enforce required fields', async () => {
    // Arrange
    const contentData = {
      // Missing contentId
      type: 'blog',
      // Missing title
      content: 'Test content',
      createdBy: 'test-user'
    };
    
    // Act
    const content = new Content(contentData);
    
    // Assert
    await expect(content.save()).rejects.toThrow();
  });

  it('should enforce enum values for type field', async () => {
    // Arrange
    const contentData = {
      contentId: Content.generateContentId(),
      type: 'invalid-type', // Invalid type
      title: 'Test Content',
      content: 'Test content',
      createdBy: 'test-user'
    };
    
    // Act
    const content = new Content(contentData);
    
    // Assert
    await expect(content.save()).rejects.toThrow();
  });

  it('should enforce enum values for status field', async () => {
    // Arrange
    const contentData = {
      contentId: Content.generateContentId(),
      type: 'blog',
      title: 'Test Content',
      content: 'Test content',
      status: 'invalid-status', // Invalid status
      createdBy: 'test-user'
    };
    
    // Act
    const content = new Content(contentData);
    
    // Assert
    await expect(content.save()).rejects.toThrow();
  });
});