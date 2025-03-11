/**
 * Storage Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides a unified interface for data storage and retrieval:
 * - MongoDB for structured data
 * - File system for content and assets
 * - In-memory cache for frequently accessed data
 */

const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');
const ConfigService = require('./ConfigService');
const logger = require('./LoggerService');

class StorageService {
  constructor() {
    this.config = ConfigService.getConfig('storage');
    this.logger = logger.createLogger('storage');
    this.client = null;
    this.db = null;
    this.collections = {};
    this.cache = new Map();
    this.connected = false;
  }

  /**
   * Initialize the storage service
   */
  async initialize() {
    try {
      this.logger.info('Initializing storage service');
      
      // Connect to MongoDB
      await this._connectToMongoDB();
      
      // Set up file storage
      await this._setupFileStorage();
      
      // Initialize cache
      this._initializeCache();
      
      this.logger.info('Storage service initialized');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize storage service: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get a collection
   * @param {string} collectionName - Collection name
   * @returns {Object} - MongoDB collection
   */
  getCollection(collectionName) {
    if (!this.connected) {
      throw new Error('Storage service not connected');
    }
    
    if (!this.collections[collectionName]) {
      this.collections[collectionName] = this.db.collection(collectionName);
    }
    
    return this.collections[collectionName];
  }

  /**
   * Store data in a collection
   * @param {string} collectionName - Collection name
   * @param {Object} data - Data to store
   * @returns {Promise<Object>} - Stored document
   */
  async storeData(collectionName, data) {
    try {
      this.logger.info(`Storing data in collection: ${collectionName}`);
      
      const collection = this.getCollection(collectionName);
      
      // Add timestamps
      const document = {
        ...data,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date()
      };
      
      // Insert document
      const result = await collection.insertOne(document);
      
      // Add _id to document
      document._id = result.insertedId;
      
      this.logger.info(`Data stored in collection ${collectionName} with ID: ${result.insertedId}`);
      
      return document;
    } catch (error) {
      this.logger.error(`Failed to store data in collection ${collectionName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update data in a collection
   * @param {string} collectionName - Collection name
   * @param {Object} query - Query to find document
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} - Updated document
   */
  async updateData(collectionName, query, data) {
    try {
      this.logger.info(`Updating data in collection: ${collectionName}`);
      
      const collection = this.getCollection(collectionName);
      
      // Add updatedAt timestamp
      const updateData = {
        $set: {
          ...data,
          updatedAt: new Date()
        }
      };
      
      // Update document
      const result = await collection.findOneAndUpdate(
        query,
        updateData,
        { returnDocument: 'after' }
      );
      
      if (!result.value) {
        throw new Error(`Document not found in collection ${collectionName}`);
      }
      
      this.logger.info(`Data updated in collection ${collectionName}`);
      
      return result.value;
    } catch (error) {
      this.logger.error(`Failed to update data in collection ${collectionName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find data in a collection
   * @param {string} collectionName - Collection name
   * @param {Object} query - Query to find documents
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Found documents
   */
  async findData(collectionName, query, options = {}) {
    try {
      this.logger.info(`Finding data in collection: ${collectionName}`);
      
      const collection = this.getCollection(collectionName);
      
      // Execute query
      const cursor = collection.find(query, options);
      
      // Apply sort if specified
      if (options.sort) {
        cursor.sort(options.sort);
      }
      
      // Apply limit if specified
      if (options.limit) {
        cursor.limit(options.limit);
      }
      
      // Apply skip if specified
      if (options.skip) {
        cursor.skip(options.skip);
      }
      
      // Get results
      const results = await cursor.toArray();
      
      this.logger.info(`Found ${results.length} documents in collection ${collectionName}`);
      
      return results;
    } catch (error) {
      this.logger.error(`Failed to find data in collection ${collectionName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find a single document in a collection
   * @param {string} collectionName - Collection name
   * @param {Object} query - Query to find document
   * @returns {Promise<Object>} - Found document
   */
  async findOne(collectionName, query) {
    try {
      this.logger.info(`Finding one document in collection: ${collectionName}`);
      
      const collection = this.getCollection(collectionName);
      
      // Execute query
      const result = await collection.findOne(query);
      
      if (!result) {
        this.logger.info(`Document not found in collection ${collectionName}`);
        return null;
      }
      
      this.logger.info(`Found document in collection ${collectionName}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to find document in collection ${collectionName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete data from a collection
   * @param {string} collectionName - Collection name
   * @param {Object} query - Query to find documents to delete
   * @returns {Promise<number>} - Number of deleted documents
   */
  async deleteData(collectionName, query) {
    try {
      this.logger.info(`Deleting data from collection: ${collectionName}`);
      
      const collection = this.getCollection(collectionName);
      
      // Delete documents
      const result = await collection.deleteMany(query);
      
      this.logger.info(`Deleted ${result.deletedCount} documents from collection ${collectionName}`);
      
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Failed to delete data from collection ${collectionName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Store file in the file system
   * @param {string} directory - Directory name (from config)
   * @param {string} filename - File name
   * @param {string|Buffer} content - File content
   * @returns {Promise<string>} - File path
   */
  async storeFile(directory, filename, content) {
    try {
      this.logger.info(`Storing file: ${filename} in directory: ${directory}`);
      
      // Get directory path
      const dirPath = this._getDirectoryPath(directory);
      
      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });
      
      // Full file path
      const filePath = path.join(dirPath, filename);
      
      // Write file
      await fs.writeFile(filePath, content);
      
      this.logger.info(`File stored: ${filePath}`);
      
      return filePath;
    } catch (error) {
      this.logger.error(`Failed to store file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Read file from the file system
   * @param {string} directory - Directory name (from config)
   * @param {string} filename - File name
   * @returns {Promise<string|Buffer>} - File content
   */
  async readFile(directory, filename) {
    try {
      this.logger.info(`Reading file: ${filename} from directory: ${directory}`);
      
      // Get directory path
      const dirPath = this._getDirectoryPath(directory);
      
      // Full file path
      const filePath = path.join(dirPath, filename);
      
      // Read file
      const content = await fs.readFile(filePath);
      
      this.logger.info(`File read: ${filePath}`);
      
      return content;
    } catch (error) {
      this.logger.error(`Failed to read file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete file from the file system
   * @param {string} directory - Directory name (from config)
   * @param {string} filename - File name
   * @returns {Promise<boolean>} - Success
   */
  async deleteFile(directory, filename) {
    try {
      this.logger.info(`Deleting file: ${filename} from directory: ${directory}`);
      
      // Get directory path
      const dirPath = this._getDirectoryPath(directory);
      
      // Full file path
      const filePath = path.join(dirPath, filename);
      
      // Delete file
      await fs.unlink(filePath);
      
      this.logger.info(`File deleted: ${filePath}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * List files in a directory
   * @param {string} directory - Directory name (from config)
   * @returns {Promise<Array>} - File names
   */
  async listFiles(directory) {
    try {
      this.logger.info(`Listing files in directory: ${directory}`);
      
      // Get directory path
      const dirPath = this._getDirectoryPath(directory);
      
      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });
      
      // Read directory
      const files = await fs.readdir(dirPath);
      
      this.logger.info(`Found ${files.length} files in directory: ${directory}`);
      
      return files;
    } catch (error) {
      this.logger.error(`Failed to list files in directory: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Store activity in the database
   * @param {Object} activity - Activity data
   * @returns {Promise<Object>} - Stored activity
   */
  async storeActivity(activity) {
    return await this.storeData('activities', activity);
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {*} - Cached value
   */
  getCached(key) {
    return this.cache.get(key);
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {boolean} - Success
   */
  setCached(key, value, ttl = null) {
    try {
      this.cache.set(key, {
        value,
        expires: ttl ? Date.now() + (ttl * 1000) : null
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set cached value: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Shutdown the storage service
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down storage service');
      
      // Close MongoDB connection
      if (this.client) {
        await this.client.close();
        this.client = null;
        this.db = null;
        this.collections = {};
        this.connected = false;
      }
      
      // Clear cache
      this.cache.clear();
      
      this.logger.info('Storage service shut down');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down storage service: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Connect to MongoDB
   * @private
   */
  async _connectToMongoDB() {
    try {
      this.logger.info('Connecting to MongoDB');
      
      // Get connection URI
      const uri = this.config.mongodb.uri;
      
      // Connect
      this.client = new MongoClient(uri, this.config.mongodb.options);
      await this.client.connect();
      
      // Get database
      this.db = this.client.db();
      
      this.connected = true;
      
      this.logger.info('Connected to MongoDB');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to MongoDB: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Set up file storage
   * @private
   */
  async _setupFileStorage() {
    try {
      this.logger.info('Setting up file storage');
      
      // Create base directory
      const basePath = path.resolve(this.config.fileStorage.basePath);
      await fs.mkdir(basePath, { recursive: true });
      
      // Create subdirectories
      for (const dirName of Object.values(this.config.fileStorage.directories)) {
        const dirPath = path.join(basePath, dirName);
        await fs.mkdir(dirPath, { recursive: true });
        this.logger.info(`Created directory: ${dirPath}`);
      }
      
      this.logger.info('File storage set up');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set up file storage: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Initialize cache
   * @private
   */
  _initializeCache() {
    // Set up cache cleanup interval
    const cacheCleanupInterval = setInterval(() => {
      this._cleanupCache();
    }, 60000); // Every minute
    
    // Ensure interval is cleaned up on exit
    process.on('exit', () => {
      clearInterval(cacheCleanupInterval);
    });
    
    this.logger.info('Cache initialized');
    
    return true;
  }

  /**
   * Clean up expired cache entries
   * @private
   */
  _cleanupCache() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires && entry.expires < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.logger.info(`Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  /**
   * Get directory path
   * @private
   * @param {string} directory - Directory name (from config)
   * @returns {string} - Full directory path
   */
  _getDirectoryPath(directory) {
    // Get directory name from config
    const dirName = this.config.fileStorage.directories[directory];
    
    if (!dirName) {
      throw new Error(`Directory not found in config: ${directory}`);
    }
    
    // Return full path
    return path.join(path.resolve(this.config.fileStorage.basePath), dirName);
  }
}

// Singleton instance
const instance = new StorageService();

module.exports = instance;
