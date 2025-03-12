/**
 * Test Helpers
 * 
 * Utility functions and factories for testing.
 */

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

// MongoDB memory server instance for tests
let mongoServer;

/**
 * Set up MongoDB memory server for testing
 */
const setupTestDatabase = async () => {
  // Close any existing connection
  await mongoose.disconnect();
  
  // Create new MongoDB memory server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
};

/**
 * Close MongoDB memory server
 */
const closeTestDatabase = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

/**
 * Create a test JWT token for authentication in tests
 */
const createTestToken = (user = { id: '123', role: 'user' }, secret = 'test-secret') => {
  return jwt.sign(user, secret, { expiresIn: '1h' });
};

/**
 * Performance testing utilities
 */
const performanceHelpers = {
  /**
   * Measure execution time of an async function
   * @param {Function} fn - The async function to measure
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<Object>} - Result with execution time
   */
  measureExecutionTime: async (fn, args = []) => {
    const start = process.hrtime.bigint();
    const result = await fn(...args);
    const end = process.hrtime.bigint();
    const executionTime = Number(end - start) / 1e6; // Convert to milliseconds
    
    return { 
      result, 
      executionTime,
      formattedTime: `${executionTime.toFixed(2)}ms`
    };
  },
  
  /**
   * Run function multiple times and calculate average execution time
   * @param {Function} fn - The async function to benchmark
   * @param {Array} args - Arguments to pass to the function
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Object>} - Benchmark results
   */
  benchmark: async (fn, args = [], iterations = 10) => {
    const times = [];
    let results = [];
    
    for (let i = 0; i < iterations; i++) {
      const { result, executionTime } = await performanceHelpers.measureExecutionTime(fn, args);
      times.push(executionTime);
      results.push(result);
    }
    
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    return {
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      iterations,
      times,
      results
    };
  }
};

/**
 * Create a mock Express response object
 */
const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create a mock Express request object
 */
const createMockRequest = (overrides = {}) => {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: mockFactories.createUser({ role: 'user' }),
    ...overrides
  };
};

/**
 * Mock services for testing
 */
const mockServices = {
  createLoggerMock() {
    return {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      })
    };
  },
  
  createAIProviderMock() {
    return {
      generateText: jest.fn().mockResolvedValue('Generated text'),
      generateImage: jest.fn().mockResolvedValue('image-url'),
      analyzeText: jest.fn().mockResolvedValue({ sentiment: 'positive', keywords: ['test'] }),
      chat: jest.fn().mockResolvedValue('Chat response')
    };
  },
  
  createMessageBusMock() {
    return {
      publishEvent: jest.fn().mockResolvedValue({}),
      publishCommand: jest.fn().mockResolvedValue({ id: 'cmd-123' }),
      subscribe: jest.fn().mockResolvedValue({}),
      subscribeToEvent: jest.fn().mockResolvedValue({}),
      consumeCommands: jest.fn().mockResolvedValue({}),
      stopConsuming: jest.fn().mockResolvedValue({}),
      isConnected: jest.fn().mockReturnValue(true)
    };
  },
  
  createStorageMock() {
    return {
      storeFile: jest.fn().mockResolvedValue('file-123'),
      getFile: jest.fn().mockResolvedValue(Buffer.from('test file content')),
      deleteFile: jest.fn().mockResolvedValue(true),
      listFiles: jest.fn().mockResolvedValue(['file-1', 'file-2']),
      storeData: jest.fn().mockResolvedValue('data-123'),
      getData: jest.fn().mockResolvedValue({ test: 'data' }),
      deleteData: jest.fn().mockResolvedValue(true)
    };
  }
};

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

module.exports = { 
  mockFactories,
  mockServices,
  createMockRequest,
  createMockResponse,
  setupTestDatabase,
  closeTestDatabase,
  createTestToken,
  performanceHelpers
};