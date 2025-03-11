/**
 * Integration tests for the Database Service
 */

const testDatabase = require('../../../testing/setupTestDatabase');
const DatabaseService = require('../../../src/common/services/databaseService');
const mongoose = require('mongoose');

describe('DatabaseService Integration', () => {
  let databaseService;

  // Connect to test database before all tests
  beforeAll(async () => {
    await testDatabase.connect();
    
    // Initialize database service with test URI
    databaseService = new DatabaseService({
      uri: process.env.MONGODB_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    });
    
    await databaseService.connect();
  });

  // Clear database before each test
  beforeEach(async () => {
    await testDatabase.clearDatabase();
  });

  // Disconnect from database after all tests
  afterAll(async () => {
    await databaseService.disconnect();
    await testDatabase.closeDatabase();
  });

  describe('Collection Operations', () => {
    it('should create a document in a collection', async () => {
      // Arrange
      const collection = 'test_collection';
      const document = { name: 'Test Document', createdAt: new Date() };
      
      // Act
      const result = await databaseService.insertOne(collection, document);
      
      // Assert
      expect(result).toBeTruthy();
      expect(result._id).toBeDefined();
      
      // Verify document was inserted
      const foundDocument = await databaseService.findOne(collection, { _id: result._id });
      expect(foundDocument).toMatchObject(document);
    });
    
    it('should find documents by query', async () => {
      // Arrange
      const collection = 'test_collection';
      const documents = [
        { name: 'Document 1', type: 'test', value: 10 },
        { name: 'Document 2', type: 'test', value: 20 },
        { name: 'Document 3', type: 'other', value: 30 }
      ];
      
      await databaseService.insertMany(collection, documents);
      
      // Act
      const results = await databaseService.find(collection, { type: 'test' });
      
      // Assert
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results.every(doc => doc.type === 'test')).toBe(true);
    });
    
    it('should update a document', async () => {
      // Arrange
      const collection = 'test_collection';
      const document = { name: 'Original Name', status: 'draft' };
      
      const inserted = await databaseService.insertOne(collection, document);
      
      // Act
      const updateResult = await databaseService.updateOne(
        collection,
        { _id: inserted._id },
        { $set: { name: 'Updated Name', status: 'published' } }
      );
      
      // Assert
      expect(updateResult.modifiedCount).toBe(1);
      
      // Verify update
      const updated = await databaseService.findOne(collection, { _id: inserted._id });
      expect(updated.name).toBe('Updated Name');
      expect(updated.status).toBe('published');
    });
    
    it('should delete a document', async () => {
      // Arrange
      const collection = 'test_collection';
      const document = { name: 'Document to Delete' };
      
      const inserted = await databaseService.insertOne(collection, document);
      
      // Act
      const deleteResult = await databaseService.deleteOne(collection, { _id: inserted._id });
      
      // Assert
      expect(deleteResult.deletedCount).toBe(1);
      
      // Verify deletion
      const found = await databaseService.findOne(collection, { _id: inserted._id });
      expect(found).toBeNull();
    });
  });

  describe('Transactions', () => {
    it('should execute operations in a transaction', async () => {
      // Define the transaction function
      const transactionFn = async (session) => {
        // Insert two documents in different collections
        await databaseService.insertOne('collection_a', { name: 'Document A' }, { session });
        await databaseService.insertOne('collection_b', { name: 'Document B' }, { session });
        
        return true;
      };
      
      // Act
      const result = await databaseService.withTransaction(transactionFn);
      
      // Assert
      expect(result).toBe(true);
      
      // Verify both documents were inserted
      const docA = await databaseService.findOne('collection_a', { name: 'Document A' });
      const docB = await databaseService.findOne('collection_b', { name: 'Document B' });
      
      expect(docA).not.toBeNull();
      expect(docB).not.toBeNull();
    });
    
    it('should rollback a transaction on error', async () => {
      // Define the transaction function that will fail
      const transactionFn = async (session) => {
        // Insert one document
        await databaseService.insertOne('collection_a', { name: 'Before Error' }, { session });
        
        // Throw an error to trigger rollback
        throw new Error('Test transaction error');
      };
      
      // Act & Assert
      await expect(databaseService.withTransaction(transactionFn)).rejects.toThrow('Test transaction error');
      
      // Verify document was not inserted (rollback worked)
      const doc = await databaseService.findOne('collection_a', { name: 'Before Error' });
      expect(doc).toBeNull();
    });
  });

  describe('Connection Management', () => {
    it('should disconnect and reconnect', async () => {
      // Disconnect
      await databaseService.disconnect();
      expect(databaseService.isConnected()).toBe(false);
      
      // Reconnect
      await databaseService.connect();
      expect(databaseService.isConnected()).toBe(true);
      
      // Verify functionality still works
      const collection = 'test_collection';
      const document = { name: 'After Reconnection' };
      
      const result = await databaseService.insertOne(collection, document);
      expect(result._id).toBeDefined();
    });
  });
});