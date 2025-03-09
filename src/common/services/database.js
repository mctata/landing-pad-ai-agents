/**
 * Database Service
 * Provides MongoDB connection and collection management
 */

const { MongoClient, ObjectId } = require('mongodb');

class DatabaseService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.client = null;
    this.db = null;
    this.collections = {};
    this.ObjectId = ObjectId; // Expose ObjectId for use in agents
  }

  async connect() {
    try {
      this.logger.info('Connecting to database...');
      
      this.client = new MongoClient(this.config.connection_string, this.config.options);
      await this.client.connect();
      
      this.db = this.client.db(this.config.database);
      
      // Initialize collections with defined indexes
      for (const [collectionName, collectionConfig] of Object.entries(this.config.collections)) {
        this.collections[collectionName] = this.db.collection(collectionName);
        
        // Create indexes if specified
        if (collectionConfig.indexes && collectionConfig.indexes.length > 0) {
          for (const index of collectionConfig.indexes) {
            await this.collections[collectionName].createIndex(
              index.fields,
              index.options || {}
            );
          }
        }
      }
      
      this.logger.info('Database connection established');
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.collections = {};
        this.logger.info('Database connection closed');
      } catch (error) {
        this.logger.error('Error disconnecting from database:', error);
        throw error;
      }
    }
  }

  isConnected() {
    return this.client !== null && this.client.isConnected();
  }
}

module.exports = DatabaseService;