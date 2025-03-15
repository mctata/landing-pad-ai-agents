// src/core/data/sharedDataStore.js
const { Sequelize, DataTypes, Op } = require('sequelize');
const config = require('../../config');
const logger = require('../utils/logger');

class SharedDataStore {
  constructor() {
    this.sequelize = null;
    this.models = {
      Content: null,
      ContentVersion: null,
      Metadata: null,
      Asset: null
    };
    this.isConnected = false;
  }

  async connect() {
    try {
      // Initialize Sequelize with the same database configuration
      const dbConfig = config.database.postgres;
      this.sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
          host: dbConfig.host,
          port: dbConfig.port,
          dialect: 'postgres',
          logging: false,
        }
      );

      // Define the Content model
      this.models.Content = this.sequelize.define('content_store', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        contentId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'draft'
        },
        contentType: {
          type: DataTypes.STRING,
          allowNull: true
        },
        tags: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          defaultValue: []
        },
        title: {
          type: DataTypes.STRING,
          allowNull: true
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        content: {
          type: DataTypes.JSONB,
          defaultValue: {}
        },
        createdBy: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'system'
        },
        updatedBy: {
          type: DataTypes.STRING,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });

      // Define the ContentVersion model
      this.models.ContentVersion = this.sequelize.define('content_version_store', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        contentId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: false
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      }, {
        indexes: [
          {
            unique: true,
            fields: ['contentId', 'version']
          }
        ]
      });

      // Define the Metadata model
      this.models.Metadata = this.sequelize.define('metadata_store', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        contentId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });

      // Define the Asset model
      this.models.Asset = this.sequelize.define('asset_store', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        assetId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        contentId: {
          type: DataTypes.STRING,
          allowNull: false
        },
        assetType: {
          type: DataTypes.STRING,
          allowNull: true
        },
        url: {
          type: DataTypes.STRING,
          allowNull: true
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      });

      // Sync all models
      await this.sequelize.sync();
      
      this.isConnected = true;
      logger.info('SharedDataStore connected to PostgreSQL');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect SharedDataStore to PostgreSQL', error);
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
      
      // Insert the content
      const result = await this.models.Content.create(contentDocument);
      
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
      const [updated] = await this.models.Content.update(updateDoc, {
        where: { contentId }
      });
      
      if (updated === 0) {
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
        data: contentData,
        createdAt: new Date()
      };
      
      // Insert the version
      const result = await this.models.ContentVersion.create(versionDocument);
      
      logger.debug(`Saved version ${contentData.version} for content ${contentId}`);
      
      return result.id;
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
      const content = await this.models.Content.findOne({
        where: { contentId }
      });
      
      if (!content) {
        return null;
      }
      
      return content.get({ plain: true });
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
      const limit = options.limit || 100;
      const offset = options.skip || 0;
      
      const versions = await this.models.ContentVersion.findAll({
        where: { contentId },
        order: [['version', 'DESC']],
        limit,
        offset
      });
      
      return versions.map(v => v.get({ plain: true }));
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
      const versionDoc = await this.models.ContentVersion.findOne({
        where: { contentId, version }
      });
      
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
        const deleted = await this.models.Content.destroy({
          where: { contentId }
        });
        
        if (deleted === 0) {
          throw new Error(`Content ${contentId} not found for deletion`);
        }
        
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
      const whereClause = {};
      
      // Build the query
      if (query.contentType) {
        whereClause.contentType = query.contentType;
      }
      
      if (query.status) {
        whereClause.status = query.status;
      }
      
      if (query.tags && query.tags.length > 0) {
        whereClause.tags = { [Op.contains]: query.tags };
      }
      
      if (query.createdBy) {
        whereClause.createdBy = query.createdBy;
      }
      
      if (query.updatedBy) {
        whereClause.updatedBy = query.updatedBy;
      }
      
      if (query.dateRange) {
        whereClause.createdAt = {};
        
        if (query.dateRange.from) {
          whereClause.createdAt[Op.gte] = new Date(query.dateRange.from);
        }
        
        if (query.dateRange.to) {
          whereClause.createdAt[Op.lte] = new Date(query.dateRange.to);
        }
      }
      
      // Text search
      if (query.text) {
        // Use tsvector for full-text search in PostgreSQL if available
        // For simplicity, we'll just search in title and description
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${query.text}%` } },
          { description: { [Op.iLike]: `%${query.text}%` } }
        ];
      }
      
      // Set options
      const limit = options.limit || 50;
      const offset = options.skip || 0;
      
      // Define order
      let order = [['updatedAt', 'DESC']];
      if (options.sort) {
        order = Object.entries(options.sort).map(([key, value]) => [key, value === 1 ? 'ASC' : 'DESC']);
      }
      
      // Execute query
      const { count, rows } = await this.models.Content.findAndCountAll({
        where: whereClause,
        order,
        limit,
        offset
      });
      
      return {
        results: rows.map(r => r.get({ plain: true })),
        total: count,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        pages: Math.ceil(count / limit)
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
      const existing = await this.models.Metadata.findOne({
        where: { contentId }
      });
      
      if (existing) {
        // Update existing metadata
        await this.models.Metadata.update(
          { 
            metadata,
            updatedAt: new Date() 
          },
          { where: { contentId } }
        );
      } else {
        // Create new metadata document
        await this.models.Metadata.create({
          contentId,
          metadata,
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
      const result = await this.models.Metadata.findOne({
        where: { contentId }
      });
      
      if (!result) {
        return null;
      }
      
      return result.get({ plain: true });
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
        url: asset.url || null,
        assetType: asset.assetType || null,
        data: asset,
        createdAt: new Date()
      };
      
      // Save the asset
      const result = await this.models.Asset.create(assetDocument);
      
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
      const where = { contentId };
      
      if (assetType) {
        where.assetType = assetType;
      }
      
      const assets = await this.models.Asset.findAll({ where });
      
      return assets.map(a => a.get({ plain: true }));
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
    if (this.sequelize) {
      await this.sequelize.close();
      this.isConnected = false;
      logger.info('SharedDataStore disconnected from PostgreSQL');
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
