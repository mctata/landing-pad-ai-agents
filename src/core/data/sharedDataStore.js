// src/core/data/sharedDataStore.js
const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../utils/logger');

class SharedDataStore {
  constructor() {
    this.client = null;
    this.db = null;
    this.collections = {
      content: null,
      contentVersions: null,
      metadata: null,
      assets: null
    };
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.database.url, config.database.options);
      await this.client.connect();
      
      this.db = this.client.db(config.database.name);
      
      // Initialize collections
      this.collections.content = this.db.collection('content');
      this.collections.contentVersions = this.db.collection('content_versions');
      this.collections.metadata = this.db.collection('metadata');
      this.collections.assets = this.db.collection('assets');
      
      // Create indexes for efficient lookups
      await this.collections.content.createIndex({ contentId: 1 }, { unique: true });
      await this.collections.content.createIndex({ status: 1 });
      await this.collections.content.createIndex({ contentType: 1 });
      await this.collections.content.createIndex({ tags: 1 });
      await this.collections.content.createIndex({ createdAt: 1 });
      await this.collections.content.createIndex({ updatedAt: 1 });
      
      await this.collections.contentVersions.createIndex({ contentId: 1, version: 1 }, { unique: true });
      await this.collections.contentVersions.createIndex({ createdAt: 1 });
      
      await this.collections.metadata.createIndex({ contentId: 1 }, { unique: true });
      await this.collections.metadata.createIndex({ key: 1, value: 1 });
      
      await this.collections.assets.createIndex({ contentId: 1 });
      await this.collections.assets.createIndex({ assetType: 1 });
      
      this.isConnected = true;
      logger.info('SharedDataStore connected to MongoDB');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect SharedDataStore to MongoDB', error);
      throw error;
    }
  }

  /**
   * Create a new content item
   * @param {Object} contentData - Content data
   * @returns {string} - The ID of the created content
   */
  async createContent(contentData) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Generate a content ID
      const contentId = this.generateId();
      
      // Create the content document
      const contentDocument = {
        contentId,
        version: 1,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: contentData.createdBy || 'system',
        ...contentData
      };
      
      // Remove any specified _id to let MongoDB generate its own
      delete contentDocument._id;
      
      // Insert the content
      const result = await this.collections.content.insertOne(contentDocument);
      
      // Create the first version
      await this.saveContentVersion(contentId, contentDocument);
      
      logger.info(`Created content with ID: ${contentId}`);
      
      return contentId;
    } catch (error) {
      logger.error('Failed to create content', error);
      throw error;
    }
  }

  /**
   * Update an existing content item
   * @param {string} contentId - Content ID to update
   * @param {Object} changes - Changes to apply to the content
   * @param {string} updatedBy - User or agent making the update
   * @returns {Object} - Updated content
   */
  async updateContent(contentId, changes, updatedBy = 'system') {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Get current content
      const currentContent = await this.getContent(contentId);
      
      if (!currentContent) {
        throw new Error(`Content with ID ${contentId} not found`);
      }
      
      // Increment version number
      const newVersion = currentContent.version + 1;
      
      // Create update document
      const updateDoc = {
        ...changes,
        version: newVersion,
        updatedAt: new Date(),
        updatedBy
      };
      
      // Protect certain fields from being updated
      delete updateDoc.contentId;
      delete updateDoc.createdAt;
      delete updateDoc.createdBy;
      
      // Update the content
      const result = await this.collections.content.updateOne(
        { contentId },
        { $set: updateDoc }
      );
      
      if (result.modifiedCount === 0) {
        throw new Error(`Failed to update content ${contentId}`);
      }
      
      // Get the updated document
      const updatedContent = await this.getContent(contentId);
      
      // Save a new version
      await this.saveContentVersion(contentId, updatedContent);
      
      logger.info(`Updated content ${contentId} to version ${newVersion}`);
      
      return updatedContent;
    } catch (error) {
      logger.error(`Failed to update content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Save a version of content
   * @param {string} contentId - Content ID
   * @param {Object} contentData - Content data to save as a version
   * @returns {string} - The ID of the saved version
   */
  async saveContentVersion(contentId, contentData) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Create version document
      const versionDocument = {
        contentId,
        version: contentData.version,
        data: { ...contentData },
        createdAt: new Date()
      };
      
      // Insert the version
      const result = await this.collections.contentVersions.insertOne(versionDocument);
      
      logger.debug(`Saved version ${contentData.version} for content ${contentId}`);
      
      return result.insertedId.toString();
    } catch (error) {
      logger.error(`Failed to save version for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Get content by ID
   * @param {string} contentId - Content ID to retrieve
   * @returns {Object|null} - Content document or null if not found
   */
  async getContent(contentId) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const content = await this.collections.content.findOne({ contentId });
      return content;
    } catch (error) {
      logger.error(`Failed to get content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Get content version history
   * @param {string} contentId - Content ID
   * @param {Object} options - Query options
   * @returns {Array} - Array of content versions
   */
  async getContentVersions(contentId, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const query = { contentId };
      const sort = options.sort || { version: -1 };
      const limit = options.limit || 0;
      const skip = options.skip || 0;
      
      const versions = await this.collections.contentVersions
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray();
      
      return versions;
    } catch (error) {
      logger.error(`Failed to get version history for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Get a specific version of content
   * @param {string} contentId - Content ID
   * @param {number} version - Version number
   * @returns {Object|null} - Content version or null if not found
   */
  async getContentVersion(contentId, version) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const versionDoc = await this.collections.contentVersions.findOne({ contentId, version });
      
      if (!versionDoc) {
        return null;
      }
      
      return versionDoc.data;
    } catch (error) {
      logger.error(`Failed to get version ${version} for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Change content status
   * @param {string} contentId - Content ID
   * @param {string} status - New status
   * @param {string} updatedBy - User or agent making the update
   * @returns {Object} - Updated content
   */
  async updateContentStatus(contentId, status, updatedBy = 'system') {
    return this.updateContent(contentId, { status }, updatedBy);
  }

  /**
   * Delete content
   * @param {string} contentId - Content ID to delete
   * @param {boolean} softDelete - If true, mark as deleted; if false, permanently remove
   * @param {string} deletedBy - User or agent making the deletion
   * @returns {boolean} - Success indicator
   */
  async deleteContent(contentId, softDelete = true, deletedBy = 'system') {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      if (softDelete) {
        // Soft delete - mark as deleted
        await this.updateContentStatus(contentId, 'deleted', deletedBy);
        logger.info(`Soft deleted content ${contentId}`);
        return true;
      } else {
        // Hard delete - remove from database
        const result = await this.collections.content.deleteOne({ contentId });
        
        if (result.deletedCount === 0) {
          throw new Error(`Content ${contentId} not found for deletion`);
        }
        
        // Delete versions (but keep them for a time-based cleanup)
        logger.info(`Hard deleted content ${contentId}`);
        return true;
      }
    } catch (error) {
      logger.error(`Failed to delete content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Search for content
   * @param {Object} query - Search criteria
   * @param {Object} options - Search options
   * @returns {Array} - Array of matching content
   */
  async searchContent(query = {}, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const mongoQuery = {};
      
      // Build the query
      if (query.contentType) {
        mongoQuery.contentType = query.contentType;
      }
      
      if (query.status) {
        mongoQuery.status = query.status;
      }
      
      if (query.tags && query.tags.length > 0) {
        mongoQuery.tags = { $all: query.tags };
      }
      
      if (query.createdBy) {
        mongoQuery.createdBy = query.createdBy;
      }
      
      if (query.updatedBy) {
        mongoQuery.updatedBy = query.updatedBy;
      }
      
      if (query.dateRange) {
        mongoQuery.createdAt = {};
        
        if (query.dateRange.from) {
          mongoQuery.createdAt.$gte = new Date(query.dateRange.from);
        }
        
        if (query.dateRange.to) {
          mongoQuery.createdAt.$lte = new Date(query.dateRange.to);
        }
      }
      
      // Text search
      if (query.text) {
        mongoQuery.$text = { $search: query.text };
      }
      
      // Set options
      const sort = options.sort || { updatedAt: -1 };
      const limit = options.limit || 50;
      const skip = options.skip || 0;
      
      // Execute query
      const cursor = this.collections.content
        .find(mongoQuery)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // Get results
      const results = await cursor.toArray();
      const total = await this.collections.content.countDocuments(mongoQuery);
      
      return {
        results,
        total,
        page: Math.floor(skip / limit) + 1,
        pageSize: limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Failed to search content', error);
      throw error;
    }
  }

  /**
   * Store metadata for content
   * @param {string} contentId - Content ID
   * @param {Object} metadata - Metadata to store
   * @returns {boolean} - Success indicator
   */
  async saveMetadata(contentId, metadata) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Check if metadata already exists for this content
      const existing = await this.collections.metadata.findOne({ contentId });
      
      if (existing) {
        // Update existing metadata
        await this.collections.metadata.updateOne(
          { contentId },
          { 
            $set: { 
              ...metadata,
              updatedAt: new Date() 
            } 
          }
        );
      } else {
        // Create new metadata document
        await this.collections.metadata.insertOne({
          contentId,
          ...metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      logger.debug(`Saved metadata for content ${contentId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save metadata for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Get metadata for content
   * @param {string} contentId - Content ID
   * @returns {Object|null} - Metadata or null if not found
   */
  async getMetadata(contentId) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const metadata = await this.collections.metadata.findOne({ contentId });
      return metadata;
    } catch (error) {
      logger.error(`Failed to get metadata for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Store an asset related to content
   * @param {string} contentId - Content ID
   * @param {Object} asset - Asset data
   * @returns {string} - Asset ID
   */
  async saveAsset(contentId, asset) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Generate asset ID
      const assetId = this.generateId();
      
      // Create asset document
      const assetDocument = {
        assetId,
        contentId,
        createdAt: new Date(),
        ...asset
      };
      
      // Save the asset
      const result = await this.collections.assets.insertOne(assetDocument);
      
      logger.debug(`Saved asset ${assetId} for content ${contentId}`);
      
      return assetId;
    } catch (error) {
      logger.error(`Failed to save asset for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Get assets for content
   * @param {string} contentId - Content ID
   * @param {string} assetType - Optional asset type filter
   * @returns {Array} - Array of assets
   */
  async getAssets(contentId, assetType = null) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const query = { contentId };
      
      if (assetType) {
        query.assetType = assetType;
      }
      
      const assets = await this.collections.assets.find(query).toArray();
      
      return assets;
    } catch (error) {
      logger.error(`Failed to get assets for content ${contentId}`, error);
      throw error;
    }
  }

  /**
   * Generate a unique ID
   * @returns {string} - Generated ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('SharedDataStore disconnected from MongoDB');
    }
  }
}

// Singleton instance
let sharedDataStoreInstance = null;

module.exports = {
  getInstance: async () => {
    if (!sharedDataStoreInstance) {
      sharedDataStoreInstance = new SharedDataStore();
      await sharedDataStoreInstance.connect();
    }
    return sharedDataStoreInstance;
  }
};
