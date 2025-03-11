/**
 * Mock Factories for Landing Pad AI Agents
 * 
 * This file contains factory functions for creating mock objects for testing.
 */

/**
 * Create a mock agent
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock agent object
 */
function createMockAgent(overrides = {}) {
  return {
    agentId: `mock-agent-${Date.now()}`,
    name: 'Mock Agent',
    description: 'Agent created for testing',
    status: 'active',
    type: 'content_creation',
    modules: [
      {
        name: 'blog-generator',
        description: 'Generates blog posts',
        enabled: true
      }
    ],
    metrics: {
      requestsProcessed: 0,
      successRate: 100,
      averageProcessingTime: 0,
      lastActivity: new Date()
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    ...overrides
  };
}

/**
 * Create a mock content item
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock content object
 */
function createMockContent(overrides = {}) {
  const title = overrides.title || 'Mock Content Title';
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  return {
    contentId: `mock-content-${Date.now()}`,
    title,
    slug,
    description: 'Mock content description',
    contentType: 'blog',
    content: 'This is mock content for testing purposes.',
    html: '<p>This is mock content for testing purposes.</p>',
    status: 'draft',
    workflowStatus: 'created',
    author: 'mock-user',
    keywords: ['mock', 'test', 'content'],
    categories: ['test'],
    tags: ['mock'],
    versions: [],
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    ...overrides
  };
}

/**
 * Create a mock user
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock user object
 */
function createMockUser(overrides = {}) {
  return {
    userId: `mock-user-${Date.now()}`,
    firstName: 'Mock',
    lastName: 'User',
    email: `mock-${Date.now()}@example.com`,
    password: '$2b$10$mockHashedPasswordForTesting',
    roles: ['user'],
    status: 'active',
    lastLogin: new Date(),
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    ...overrides
  };
}

/**
 * Create a mock content brief
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock brief object
 */
function createMockBrief(overrides = {}) {
  return {
    briefId: `mock-brief-${Date.now()}`,
    title: 'Mock Brief Title',
    contentType: 'blog',
    description: 'Mock brief description',
    requirements: 'Create a blog post about testing',
    audience: ['developers', 'testers'],
    keywords: ['testing', 'jest', 'mock'],
    tone: 'professional',
    length: { min: 500, max: 1000, unit: 'words' },
    status: 'pending',
    deadline: new Date(Date.now() + 86400000), // Tomorrow
    assignedTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    ...overrides
  };
}

/**
 * Create a mock workflow
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock workflow object
 */
function createMockWorkflow(overrides = {}) {
  return {
    workflowId: `mock-workflow-${Date.now()}`,
    name: 'Mock Workflow',
    description: 'Workflow created for testing',
    steps: [
      {
        stepId: 'step-1',
        name: 'Create Brief',
        description: 'Create content brief',
        order: 1,
        assignedTo: 'content_strategy',
        requiredModules: ['brief-generator'],
        completionCriteria: { status: 'completed' }
      },
      {
        stepId: 'step-2',
        name: 'Generate Content',
        description: 'Generate content from brief',
        order: 2,
        assignedTo: 'content_creation',
        requiredModules: ['blog-generator'],
        completionCriteria: { status: 'completed' }
      }
    ],
    status: 'active',
    contentTypes: ['blog'],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    ...overrides
  };
}

/**
 * Create a mock AIProviderService response
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock AIProviderService response
 */
function createMockAIResponse(overrides = {}) {
  return {
    text: 'This is a mock AI response for testing purposes.',
    model: 'mock-model',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30
    },
    requestId: `mock-req-${Date.now()}`,
    ...overrides
  };
}

/**
 * Create mock metrics data
 * @param {Object} overrides - Optional property overrides
 * @returns {Object} Mock metrics object
 */
function createMockMetrics(overrides = {}) {
  return {
    metricId: `mock-metric-${Date.now()}`,
    contentId: `mock-content-${Date.now()}`,
    metricType: 'views',
    value: 100,
    unit: 'count',
    source: 'analytics',
    timestamp: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

module.exports = {
  createMockAgent,
  createMockContent,
  createMockUser,
  createMockBrief,
  createMockWorkflow,
  createMockAIResponse,
  createMockMetrics
};