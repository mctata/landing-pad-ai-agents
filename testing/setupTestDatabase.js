/**
 * Test Database Setup
 * 
 * This module handles setting up and tearing down the test database.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

class TestDatabase {
  constructor() {
    this.mongoServer = null;
    this.isConnected = false;
  }

  /**
   * Connect to the in-memory database
   */
  async connect() {
    if (this.isConnected) return;

    try {
      // Create a new MongoDB memory server
      this.mongoServer = await MongoMemoryServer.create();
      
      // Get connection string
      const mongoUri = this.mongoServer.getUri();
      
      // Set environment variable
      process.env.MONGODB_URI = mongoUri;
      
      // Connect Mongoose
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      
      this.isConnected = true;
      console.log(`Connected to test database at ${mongoUri}`);
    } catch (error) {
      console.error('Error connecting to test database:', error);
      throw error;
    }
  }

  /**
   * Drop database, close the connection and stop mongod
   */
  async closeDatabase() {
    if (!this.isConnected) return;

    try {
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
      
      if (this.mongoServer) {
        await this.mongoServer.stop();
        this.mongoServer = null;
      }
      
      this.isConnected = false;
      console.log('Test database connection closed');
    } catch (error) {
      console.error('Error closing test database:', error);
      throw error;
    }
  }

  /**
   * Clear all data in the database
   */
  async clearDatabase() {
    if (!this.isConnected) return;

    try {
      const collections = mongoose.connection.collections;
      
      for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
      }
      
      console.log('Test database cleared');
    } catch (error) {
      console.error('Error clearing test database:', error);
      throw error;
    }
  }
}

module.exports = new TestDatabase();