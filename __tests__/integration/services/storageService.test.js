/**
 * Integration tests for Storage Service
 */

const testDatabase = require('../../../testing/setupTestDatabase');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// Mock dependencies
jest.mock('../../../services/ConfigService', () => ({
  getConfig: jest.fn().mockReturnValue({
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    },
    fileStorage: {
      basePath: path.join(os.tmpdir(), 'storage-service-test'),
      directories: {
        content: 'content',
        assets: 'assets',
        logs: 'logs',
        temp: 'temp'
      }
    }
  })
}));

jest.mock('../../../services/LoggerService', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

// Import after mocks
const storageService = require('../../../services/StorageService');

describe('StorageService Integration', () => {
  // Test data
  const testData = {
    name: 'Test Object',
    description: 'Integration test data',
    tags: ['test', 'integration'],
    status: 'active'
  };

  // Temp directory for file tests
  const tempDir = path.join(os.tmpdir(), 'storage-service-test');

  beforeAll(async () => {
    await testDatabase.connect();
    
    // Initialize storage service
    await storageService.initialize();
    
    // Ensure test directories exist
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    // Shutdown storage service
    await storageService.shutdown();
    
    // Close test database
    await testDatabase.closeDatabase();
    
    // Clean up test directories
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directories', error);
    }
  });

  beforeEach(async () => {
    // Clear test collections
    if (storageService.connected) {
      await storageService.getCollection('test_collection').deleteMany({});
      await storageService.getCollection('activities').deleteMany({});
    }
  });

  describe('MongoDB Operations', () => {
    it('should store and retrieve data', async () => {
      // Act - Store data
      const storedData = await storageService.storeData('test_collection', testData);
      
      // Assert - Stored data
      expect(storedData).toBeDefined();
      expect(storedData._id).toBeDefined();
      expect(storedData.name).toBe(testData.name);
      expect(storedData.createdAt).toBeDefined();
      expect(storedData.updatedAt).toBeDefined();
      
      // Act - Retrieve data
      const foundData = await storageService.findOne('test_collection', { _id: storedData._id });
      
      // Assert - Retrieved data
      expect(foundData).toBeDefined();
      expect(foundData._id).toEqual(storedData._id);
      expect(foundData.name).toBe(testData.name);
    });

    it('should update data', async () => {
      // Arrange - Store initial data
      const storedData = await storageService.storeData('test_collection', testData);
      
      // Act - Update data
      const updateData = {
        name: 'Updated Test Object',
        status: 'inactive'
      };
      
      const updatedData = await storageService.updateData(
        'test_collection', 
        { _id: storedData._id }, 
        updateData
      );
      
      // Assert
      expect(updatedData).toBeDefined();
      expect(updatedData._id).toEqual(storedData._id);
      expect(updatedData.name).toBe(updateData.name);
      expect(updatedData.status).toBe(updateData.status);
      expect(updatedData.description).toBe(testData.description); // Unchanged field
      expect(updatedData.updatedAt).not.toEqual(storedData.updatedAt); // Updated timestamp
    });

    it('should find multiple documents with query', async () => {
      // Arrange - Store multiple documents
      await storageService.storeData('test_collection', { ...testData, type: 'typeA', score: 10 });
      await storageService.storeData('test_collection', { ...testData, type: 'typeA', score: 20 });
      await storageService.storeData('test_collection', { ...testData, type: 'typeB', score: 30 });
      await storageService.storeData('test_collection', { ...testData, type: 'typeB', score: 40 });
      
      // Act - Find data with query
      const results = await storageService.findData('test_collection', { type: 'typeA' });
      
      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results.every(item => item.type === 'typeA')).toBe(true);
    });

    it('should find data with options (sort, limit, skip)', async () => {
      // Arrange - Store multiple documents
      await storageService.storeData('test_collection', { ...testData, name: 'Item A', score: 10 });
      await storageService.storeData('test_collection', { ...testData, name: 'Item B', score: 20 });
      await storageService.storeData('test_collection', { ...testData, name: 'Item C', score: 30 });
      await storageService.storeData('test_collection', { ...testData, name: 'Item D', score: 40 });
      await storageService.storeData('test_collection', { ...testData, name: 'Item E', score: 50 });
      
      // Act - Find with sort (descending), skip, and limit
      const options = {
        sort: { score: -1 },
        skip: 1,
        limit: 2
      };
      
      const results = await storageService.findData('test_collection', {}, options);
      
      // Assert
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].name).toBe('Item D'); // Skip Item E (score 50), get Item D (score 40)
      expect(results[1].name).toBe('Item C'); // Then get Item C (score 30)
    });

    it('should delete data', async () => {
      // Arrange - Store data
      const storedData = await storageService.storeData('test_collection', testData);
      
      // Verify data exists
      const foundData = await storageService.findOne('test_collection', { _id: storedData._id });
      expect(foundData).toBeDefined();
      
      // Act - Delete data
      const deleteCount = await storageService.deleteData('test_collection', { _id: storedData._id });
      
      // Assert
      expect(deleteCount).toBe(1);
      
      // Verify data is deleted
      const deletedData = await storageService.findOne('test_collection', { _id: storedData._id });
      expect(deletedData).toBeNull();
    });

    it('should store activity data', async () => {
      // Arrange
      const activityData = {
        type: 'content_creation',
        action: 'create',
        userId: 'test-user',
        entityId: 'test-entity',
        details: {
          contentType: 'blog',
          title: 'Test Blog Post'
        }
      };
      
      // Act
      const storedActivity = await storageService.storeActivity(activityData);
      
      // Assert
      expect(storedActivity).toBeDefined();
      expect(storedActivity._id).toBeDefined();
      expect(storedActivity.type).toBe(activityData.type);
      expect(storedActivity.action).toBe(activityData.action);
      
      // Verify in activities collection
      const foundActivity = await storageService.findOne('activities', { _id: storedActivity._id });
      expect(foundActivity).toBeDefined();
      expect(foundActivity.type).toBe(activityData.type);
    });
  });

  describe('File Operations', () => {
    it('should store and read a file', async () => {
      // Arrange
      const directory = 'content';
      const filename = `test-file-${Date.now()}.txt`;
      const content = 'This is test content for file operations';
      
      // Act - Store file
      const filePath = await storageService.storeFile(directory, filename, content);
      
      // Assert - File path
      expect(filePath).toBeDefined();
      expect(filePath).toContain(filename);
      expect(filePath).toContain('content');
      
      // Act - Read file
      const readContent = await storageService.readFile(directory, filename);
      
      // Assert - File content
      expect(readContent.toString()).toBe(content);
    });

    it('should list files in a directory', async () => {
      // Arrange - Store multiple files
      const directory = 'assets';
      const files = [
        `test-file-1-${Date.now()}.txt`,
        `test-file-2-${Date.now()}.txt`,
        `test-file-3-${Date.now()}.txt`
      ];
      
      for (const filename of files) {
        await storageService.storeFile(directory, filename, 'Test content');
      }
      
      // Act - List files
      const listedFiles = await storageService.listFiles(directory);
      
      // Assert
      expect(listedFiles).toBeDefined();
      expect(Array.isArray(listedFiles)).toBe(true);
      expect(listedFiles.length).toBeGreaterThanOrEqual(files.length);
      
      // All stored files should be in the list
      for (const filename of files) {
        expect(listedFiles).toContain(filename);
      }
    });

    it('should delete a file', async () => {
      // Arrange - Store file
      const directory = 'temp';
      const filename = `to-delete-${Date.now()}.txt`;
      
      await storageService.storeFile(directory, filename, 'This file will be deleted');
      
      // Verify file exists
      const files = await storageService.listFiles(directory);
      expect(files).toContain(filename);
      
      // Act - Delete file
      const result = await storageService.deleteFile(directory, filename);
      
      // Assert
      expect(result).toBe(true);
      
      // Verify file is deleted
      const updatedFiles = await storageService.listFiles(directory);
      expect(updatedFiles).not.toContain(filename);
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached values', async () => {
      // Arrange
      const key = 'test-cache-key';
      const value = { data: 'test-cache-value', number: 42 };
      
      // Act - Set cache
      const setCacheResult = storageService.setCached(key, value);
      
      // Assert - Set result
      expect(setCacheResult).toBe(true);
      
      // Act - Get cache
      const cachedValue = storageService.getCached(key);
      
      // Assert - Get result
      expect(cachedValue).toBeDefined();
      expect(cachedValue.value).toEqual(value);
      expect(cachedValue.expires).toBeNull(); // No TTL
    });

    it('should set cached values with TTL', async () => {
      // Arrange
      const key = 'test-ttl-key';
      const value = 'test-ttl-value';
      const ttl = 0.1; // 100ms TTL
      
      // Act - Set cache with TTL
      storageService.setCached(key, value, ttl);
      
      // Assert - Value exists
      const cachedValue = storageService.getCached(key);
      expect(cachedValue).toBeDefined();
      expect(cachedValue.value).toBe(value);
      expect(cachedValue.expires).toBeDefined();
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Manually trigger cache cleanup
      storageService._cleanupCache();
      
      // Assert - Value is gone
      const expiredValue = storageService.getCached(key);
      expect(expiredValue).toBeUndefined();
    });
  });

  describe('Connection Management', () => {
    it('should reconnect after shutdown', async () => {
      // Act - Shutdown
      await storageService.shutdown();
      
      // Assert - Not connected
      expect(storageService.connected).toBe(false);
      
      // Act - Initialize again
      await storageService.initialize();
      
      // Assert - Connected
      expect(storageService.connected).toBe(true);
      
      // Verify functionality
      const storedData = await storageService.storeData('test_collection', testData);
      expect(storedData).toBeDefined();
    });
  });
});