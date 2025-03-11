/**
 * Test Helpers for Landing Pad AI Agents
 * 
 * This file contains utility functions to help with testing.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createServer } = require('http');

/**
 * MongoDB Memory Server instance for test database
 */
let mongoServer;

/**
 * Connect to a MongoDB memory server for testing
 * @returns {Promise<string>} Connection URI
 */
async function connectToTestDatabase() {
  try {
    // Create MongoDB memory server if it doesn't exist
    if (!mongoServer) {
      mongoServer = await MongoMemoryServer.create();
    }
    
    // Get connection string
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    return mongoUri;
  } catch (error) {
    console.error('Error connecting to test database:', error);
    throw error;
  }
}

/**
 * Close connection to test database
 * @returns {Promise<void>}
 */
async function closeTestDatabase() {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  } catch (error) {
    console.error('Error closing test database:', error);
    throw error;
  }
}

/**
 * Generate a JWT token for testing
 * @param {Object} payload - Token payload
 * @returns {string} JWT token
 */
function generateTestToken(payload = {}) {
  const defaultPayload = {
    sub: 'test-user',
    roles: ['user'],
    ...payload
  };
  
  return jwt.sign(defaultPayload, process.env.JWT_SECRET || 'test-jwt-secret', { expiresIn: '1h' });
}

/**
 * Create HTTP server with Express app for API testing
 * @param {Express} app - Express application
 * @returns {Object} - Server and cleanup function
 */
function createTestServer(app) {
  const server = createServer(app);
  
  // Start server on random port
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;
      
      resolve({
        server,
        baseUrl,
        close: () => new Promise(resolve => server.close(resolve))
      });
    });
  });
}

/**
 * Create a test agent for API testing
 * @param {Object} data - Agent data
 * @returns {Object} Agent object
 */
async function createTestAgent(data = {}) {
  const { Agent } = mongoose.models;
  
  const defaultData = {
    agentId: `test-agent-${Date.now()}`,
    name: 'Test Agent',
    description: 'Agent created for testing',
    status: 'active',
    type: 'test',
    modules: [
      {
        name: 'test-module',
        description: 'Test module',
        enabled: true
      }
    ],
    createdBy: 'system'
  };
  
  return await Agent.create({ ...defaultData, ...data });
}

/**
 * Create a test user for API testing
 * @param {Object} data - User data
 * @returns {Object} User object
 */
async function createTestUser(data = {}) {
  const { User } = mongoose.models;
  
  const defaultData = {
    userId: `test-user-${Date.now()}`,
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@example.com`,
    password: 'password123',
    roles: ['user'],
    status: 'active',
    createdBy: 'system'
  };
  
  return await User.create({ ...defaultData, ...data });
}

/**
 * Create test content for API testing
 * @param {Object} data - Content data
 * @returns {Object} Content object
 */
async function createTestContent(data = {}) {
  const { Content } = mongoose.models;
  
  const defaultData = {
    contentId: `test-content-${Date.now()}`,
    title: 'Test Content',
    contentType: 'blog',
    content: 'This is test content',
    status: 'draft',
    workflowStatus: 'created',
    author: 'test-user',
    keywords: ['test', 'content'],
    categories: ['test'],
    createdBy: 'system'
  };
  
  return await Content.create({ ...defaultData, ...data });
}

/**
 * Wait for a specified time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  connectToTestDatabase,
  closeTestDatabase,
  generateTestToken,
  createTestServer,
  createTestAgent,
  createTestUser,
  createTestContent,
  wait
};