/**
 * Test Helpers
 * 
 * Utility functions and factories for testing.
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Factory functions to create test data
const mockFactories = {
  /**
   * Create a mock user
   */
  createUser: (overrides = {}) => {
    return {
      _id: overrides._id || new mongoose.Types.ObjectId(),
      email: overrides.email || `test.user.${uuidv4().substring(0, 8)}@example.com`,
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'User',
      role: overrides.role || 'user',
      password: overrides.password || 'password123',
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides
    };
  },
  
  /**
   * Create a mock agent
   */
  createAgent: (overrides = {}) => {
    const id = overrides.id || uuidv4();
    const type = overrides.type || 'content_creation';
    
    return {
      _id: overrides._id || new mongoose.Types.ObjectId(),
      id,
      name: overrides.name || `${type}-agent-${id.substring(0, 8)}`,
      type,
      description: overrides.description || `Test ${type} agent`,
      status: overrides.status || 'active',
      modules: overrides.modules || ['blog-generator', 'social-media-generator'],
      configuration: overrides.configuration || {},
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides
    };
  },
  
  /**
   * Create a mock content item
   */
  createContent: (overrides = {}) => {
    const id = overrides.id || uuidv4();
    const title = overrides.title || `Test Content ${id.substring(0, 8)}`;
    
    return {
      _id: overrides._id || new mongoose.Types.ObjectId(),
      id,
      title,
      slug: overrides.slug || title.toLowerCase().replace(/\s+/g, '-'),
      type: overrides.type || 'blog',
      status: overrides.status || 'draft',
      body: overrides.body || 'Test content body',
      metadata: overrides.metadata || {},
      author: overrides.author || mockFactories.createUser()._id,
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides
    };
  },
  
  /**
   * Create a mock workflow
   */
  createWorkflow: (overrides = {}) => {
    const id = overrides.id || uuidv4();
    
    return {
      _id: overrides._id || new mongoose.Types.ObjectId(),
      id,
      name: overrides.name || `Test Workflow ${id.substring(0, 8)}`,
      description: overrides.description || 'Test workflow description',
      status: overrides.status || 'active',
      steps: overrides.steps || [
        {
          id: 'step1',
          name: 'Generate Content',
          agent: 'content_creation',
          module: 'blog-generator',
          config: {}
        },
        {
          id: 'step2',
          name: 'Optimize Content',
          agent: 'optimisation',
          module: 'seo-optimizer',
          config: {}
        }
      ],
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides
    };
  },
  
  /**
   * Create a mock brief
   */
  createBrief: (overrides = {}) => {
    const id = overrides.id || uuidv4();
    
    return {
      _id: overrides._id || new mongoose.Types.ObjectId(),
      id,
      title: overrides.title || `Test Brief ${id.substring(0, 8)}`,
      description: overrides.description || 'Test brief description',
      contentType: overrides.contentType || 'blog',
      keywords: overrides.keywords || ['test', 'brief', 'keywords'],
      targetAudience: overrides.targetAudience || 'Test audience',
      tone: overrides.tone || 'professional',
      requestor: overrides.requestor || mockFactories.createUser()._id,
      status: overrides.status || 'pending',
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides
    };
  },
  
  /**
   * Create mock metrics
   */
  createMetrics: (overrides = {}) => {
    return {
      _id: overrides._id || new mongoose.Types.ObjectId(),
      contentId: overrides.contentId || mockFactories.createContent()._id,
      views: overrides.views || Math.floor(Math.random() * 1000),
      shares: overrides.shares || Math.floor(Math.random() * 100),
      comments: overrides.comments || Math.floor(Math.random() * 50),
      conversionRate: overrides.conversionRate || Math.random() * 10,
      engagementRate: overrides.engagementRate || Math.random() * 20,
      timePeriod: overrides.timePeriod || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      },
      createdAt: overrides.createdAt || new Date(),
      updatedAt: overrides.updatedAt || new Date(),
      ...overrides
    };
  }
};

module.exports = { mockFactories };