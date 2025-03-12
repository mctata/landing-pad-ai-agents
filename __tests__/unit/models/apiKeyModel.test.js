/**
 * Unit tests for API Key Model
 */

const mongoose = require('mongoose');
const ApiKey = require('../../../src/models/apiKeyModel');
const crypto = require('crypto');

// Mock crypto for API key generation
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockImplementation(() => ({
    toString: jest.fn().mockReturnValue('mocked-api-key')
  }))
}));

describe('API Key Model', () => {
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
    // Clear api_keys collection before each test
    await mongoose.connection.collection('apikeys').deleteMany({});
    // Clear all mock calls
    jest.clearAllMocks();
  });

  it('should create a new API key with default scopes', async () => {
    // Arrange
    const keyData = {
      name: 'Test API Key',
      owner: new mongoose.Types.ObjectId()
    };

    // Act
    const apiKey = await ApiKey.generateApiKey(keyData);

    // Assert
    expect(apiKey._id).toBeDefined();
    expect(apiKey.key).toBe('mocked-api-key');
    expect(apiKey.name).toBe('Test API Key');
    expect(apiKey.owner.toString()).toBe(keyData.owner.toString());
    expect(apiKey.scopes).toEqual(['agents:read', 'content:read']);
    expect(apiKey.active).toBe(true);
    expect(apiKey.createdAt).toBeDefined();
    expect(apiKey.updatedAt).toBeDefined();
    expect(crypto.randomBytes).toHaveBeenCalledWith(32);
  });

  it('should create a new API key with custom scopes', async () => {
    // Arrange
    const keyData = {
      name: 'Admin API Key',
      owner: new mongoose.Types.ObjectId(),
      scopes: ['agents:read', 'agents:write', 'content:read', 'content:write', 'analytics:read']
    };

    // Act
    const apiKey = await ApiKey.generateApiKey(keyData);

    // Assert
    expect(apiKey.scopes).toEqual([
      'agents:read',
      'agents:write',
      'content:read',
      'content:write',
      'analytics:read'
    ]);
  });

  it('should create a new API key with expiration date', async () => {
    // Arrange
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days in the future
    const keyData = {
      name: 'Temporary API Key',
      owner: new mongoose.Types.ObjectId(),
      expiresAt
    };

    // Act
    const apiKey = await ApiKey.generateApiKey(keyData);

    // Assert
    expect(apiKey.expiresAt).toEqual(expiresAt);
  });

  it('should enforce required fields', async () => {
    // Arrange - Missing required fields
    const incompleteData = {
      // Missing name
      // Missing owner
    };

    // Act & Assert
    await expect(ApiKey.generateApiKey(incompleteData)).rejects.toThrow();
  });

  it('should enforce scope enum values', async () => {
    // Arrange
    const keyData = {
      name: 'Invalid Scope Key',
      owner: new mongoose.Types.ObjectId(),
      scopes: ['invalid-scope'] // Invalid scope
    };

    // Act & Assert
    await expect(ApiKey.generateApiKey(keyData)).rejects.toThrow();
  });

  it('should update last used timestamp', async () => {
    // Arrange
    const keyData = {
      name: 'Test API Key',
      owner: new mongoose.Types.ObjectId()
    };
    const apiKey = await ApiKey.generateApiKey(keyData);
    
    // Mock Date.now
    const originalDateNow = Date.now;
    const mockNow = new Date('2025-03-15T12:00:00Z').getTime();
    global.Date.now = jest.fn(() => mockNow);
    
    // Act
    await ApiKey.updateLastUsed(apiKey._id);
    
    // Find the updated key
    const updatedKey = await ApiKey.findById(apiKey._id);
    
    // Assert
    expect(updatedKey.lastUsed).toEqual(new Date(mockNow));
    
    // Restore original Date.now
    global.Date.now = originalDateNow;
  });

  it('should revoke an API key', async () => {
    // Arrange
    const keyData = {
      name: 'Test API Key',
      owner: new mongoose.Types.ObjectId()
    };
    const apiKey = await ApiKey.generateApiKey(keyData);
    
    // Act
    await ApiKey.revoke(apiKey._id);
    
    // Find the updated key
    const updatedKey = await ApiKey.findById(apiKey._id);
    
    // Assert
    expect(updatedKey.active).toBe(false);
  });
});