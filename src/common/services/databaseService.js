/**
 * Database Service using Sequelize
 * Provides PostgreSQL connection and model management
 */

const { Sequelize } = require('sequelize');
const models = require('../../models');
const logger = require('./logger');

class DatabaseService {
  constructor(config) {
    this.config = config;
    this.logger = logger.createLogger('database');
    this.models = models;
    this.isConnected = false;
    this.sequelize = null;
  }

  /**
   * Connect to PostgreSQL
   */
  async connect() {
    try {
      this.logger.info('Connecting to PostgreSQL database...');
      
      // Create Sequelize instance
      this.sequelize = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        {
          host: this.config.host,
          port: this.config.port,
          dialect: 'postgres',
          logging: (msg) => this.logger.debug(msg),
          pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
          },
          dialectOptions: {
            ssl: this.config.ssl ? {
              require: true,
              rejectUnauthorized: false
            } : false
          },
          timezone: '+00:00'
        }
      );
      
      // Test the connection
      await this.sequelize.authenticate();
      
      this.isConnected = true;
      this.logger.info('PostgreSQL database connected successfully');
      
      // Initialize models
      this._initializeModels();
      
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  /**
   * Disconnect from PostgreSQL
   */
  async disconnect() {
    try {
      if (this.sequelize) {
        await this.sequelize.close();
        this.isConnected = false;
        this.logger.info('PostgreSQL database disconnected');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from PostgreSQL database:', error);
      throw error;
    }
  }

  /**
   * Get database connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      dialect: this.sequelize ? this.sequelize.getDialect() : null
    };
  }

  /**
   * Initialize models and create associations
   * @private
   */
  _initializeModels() {
    this.logger.info('Initializing database models...');
    
    // Initialize models with sequelize instance
    for (const modelName in this.models) {
      if (typeof this.models[modelName].init === 'function') {
        this.models[modelName].init(this.sequelize);
      }
    }
    
    // Create associations between models
    for (const modelName in this.models) {
      if (typeof this.models[modelName].associate === 'function') {
        this.models[modelName].associate(this.models);
      }
    }
    
    this.logger.info('Database models initialized');
  }

  /**
   * Sync all models with the database
   * @param {boolean} force - If true, each model will drop the table if it exists before creating it
   */
  async syncModels(force = false) {
    try {
      this.logger.info(`Syncing database models (force: ${force})...`);
      
      await this.sequelize.sync({ force });
      
      this.logger.info('Database models synced successfully');
      return true;
    } catch (error) {
      this.logger.error('Error syncing database models:', error);
      throw error;
    }
  }
  
  // =====================================
  // Content Methods
  // =====================================
  
  /**
   * Create new content
   * @param {Object} contentData - Content data
   * @returns {Object} - Created content
   */
  async createContent(contentData) {
    try {
      // Generate contentId if not provided
      if (!contentData.contentId) {
        contentData.contentId = await this.models.Content.generateContentId();
      }
      
      const content = await this.models.Content.create(contentData);
      
      // Create initial version
      await this.createContentVersion(content.contentId, content.toJSON(), content.createdBy);
      
      this.logger.info(`Content created with ID: ${content.contentId}`);
      return content;
    } catch (error) {
      this.logger.error('Error creating content:', error);
      throw error;
    }
  }
  
  /**
   * Get content by ID
   * @param {string} contentId - Content ID
   * @returns {Object} - Content document or null if not found
   */
  async getContent(contentId) {
    try {
      return await this.models.Content.findOne({ 
        where: { contentId } 
      });
    } catch (error) {
      this.logger.error(`Error getting content ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update content
   * @param {string} contentId - Content ID
   * @param {Object} updateData - Update data
   * @returns {Object} - Updated content
   */
  async updateContent(contentId, updateData) {
    try {
      // Get current content to save as a version
      const content = await this.getContent(contentId);
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`);
      }
      
      // Save current state as a version (before applying updates)
      await this.createContentVersion(contentId, content.toJSON(), updateData.updatedBy || 'system');
      
      // Update content
      await content.update(updateData);
      
      this.logger.info(`Content ${contentId} updated from "${content.title}" to "${content.title}"`);
      return content;
    } catch (error) {
      this.logger.error(`Error updating content ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create content version
   * @param {string} contentId - Content ID
   * @param {Object} contentData - Content data
   * @param {string} createdBy - User who created the version
   * @returns {Object} - Content version
   */
  async createContentVersion(contentId, contentData, createdBy) {
    try {
      // Find the latest version and increment it
      let version = 1;
      const latestVersion = await this.models.ContentVersion.findOne({
        where: { contentId },
        order: [['version', 'DESC']]
      });
      
      if (latestVersion) {
        version = latestVersion.version + 1;
      }
      
      const contentVersion = await this.models.ContentVersion.create({
        contentId,
        version,
        data: contentData,
        createdBy
      });
      
      this.logger.info(`Created version ${version} for content ${contentId}`);
      return contentVersion;
    } catch (error) {
      this.logger.error(`Error creating content version for ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get content versions
   * @param {string} contentId - Content ID
   * @returns {Array} - Array of content versions
   */
  async getContentVersions(contentId) {
    try {
      return await this.models.ContentVersion.findAll({
        where: { contentId },
        order: [['version', 'DESC']]
      });
    } catch (error) {
      this.logger.error(`Error getting content versions for ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete content
   * @param {string} contentId - Content ID
   * @param {boolean} isSoftDelete - Whether to perform soft delete
   * @returns {boolean} - Success status
   */
  async deleteContent(contentId, isSoftDelete = true) {
    try {
      if (isSoftDelete) {
        // Soft delete - update status to deleted
        await this.updateContent(contentId, { 
          status: 'deleted',
          updatedAt: new Date(),
          updatedBy: 'system'
        });
        return true;
      } else {
        // Hard delete - remove document
        const result = await this.models.Content.destroy({
          where: { contentId }
        });
        return result > 0;
      }
    } catch (error) {
      this.logger.error(`Error deleting content ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Search content
   * @param {Object} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - Search results with pagination
   */
  async searchContent(query = {}, options = {}) {
    try {
      const {
        type,
        status,
        categories,
        tags,
        createdBy,
        updatedBy,
        dateFrom,
        dateTo,
        searchText,
        sort = { createdAt: 'DESC' },
        page = 1,
        limit = 20
      } = query;
      
      // Build where clause
      const where = {};
      
      if (type) where.type = type;
      if (status) where.status = status;
      if (createdBy) where.createdBy = createdBy;
      if (updatedBy) where.updatedBy = updatedBy;
      
      // Date range
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.$gte = new Date(dateFrom);
        if (dateTo) where.createdAt.$lte = new Date(dateTo);
      }
      
      // Categories and tags in Sequelize need to be handled with associations or JSON operators
      // This is a simple example assuming categories and tags are stored as arrays in JSON fields
      if (categories) {
        where.categories = Sequelize.fn('JSON_CONTAINS', 
          Sequelize.col('categories'), 
          JSON.stringify(Array.isArray(categories) ? categories : [categories])
        );
      }
      
      if (tags) {
        where.tags = Sequelize.fn('JSON_CONTAINS', 
          Sequelize.col('tags'), 
          JSON.stringify(Array.isArray(tags) ? tags : [tags])
        );
      }
      
      // For text search, we use ILIKE for PostgreSQL
      if (searchText) {
        where.$or = [
          { title: { [Sequelize.Op.iLike]: `%${searchText}%` } },
          { description: { [Sequelize.Op.iLike]: `%${searchText}%` } },
          { content: { [Sequelize.Op.iLike]: `%${searchText}%` } }
        ];
      }
      
      // Execute query with pagination
      const offset = (page - 1) * limit;
      
      // Convert sort to sequelize format
      const order = [];
      for (const [field, direction] of Object.entries(sort)) {
        order.push([field, direction]);
      }
      
      // Get total count
      const total = await this.models.Content.count({ where });
      
      // Get results
      const contents = await this.models.Content.findAll({
        where,
        order,
        offset,
        limit
      });
      
      return {
        contents,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / limit),
          limit: Number(limit)
        }
      };
    } catch (error) {
      this.logger.error('Error searching content:', error);
      throw error;
    }
  }
  
  // =====================================
  // Brief Methods
  // =====================================
  
  /**
   * Create brief
   * @param {Object} briefData - Brief data
   * @returns {Object} - Created brief
   */
  async createBrief(briefData) {
    try {
      // Generate briefId if not provided
      if (!briefData.briefId) {
        briefData.briefId = await this.models.Brief.generateBriefId();
      }
      
      const brief = await this.models.Brief.create(briefData);
      
      this.logger.info(`Brief created with ID: ${brief.briefId}`);
      return brief;
    } catch (error) {
      this.logger.error('Error creating brief:', error);
      throw error;
    }
  }
  
  /**
   * Get brief by ID
   * @param {string} briefId - Brief ID
   * @returns {Object} - Brief document or null if not found
   */
  async getBrief(briefId) {
    try {
      return await this.models.Brief.findOne({
        where: { briefId }
      });
    } catch (error) {
      this.logger.error(`Error getting brief ${briefId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update brief
   * @param {string} briefId - Brief ID
   * @param {Object} updateData - Update data
   * @returns {Object} - Updated brief
   */
  async updateBrief(briefId, updateData) {
    try {
      const brief = await this.models.Brief.findOne({
        where: { briefId }
      });
      
      if (!brief) {
        throw new Error(`Brief with ID ${briefId} not found`);
      }
      
      await brief.update(updateData);
      
      this.logger.info(`Brief ${briefId} updated`);
      return brief;
    } catch (error) {
      this.logger.error(`Error updating brief ${briefId}:`, error);
      throw error;
    }
  }
  
  // =====================================
  // Metrics Methods
  // =====================================
  
  /**
   * Create metrics
   * @param {Object} metricData - Metric data
   * @returns {Object} - Created metric
   */
  async createMetrics(metricData) {
    try {
      // Generate performanceId if not provided
      if (!metricData.performanceId) {
        metricData.performanceId = await this.models.Metric.generatePerformanceId();
      }
      
      const metric = await this.models.Metric.create(metricData);
      
      this.logger.info(`Metrics created with ID: ${metric.performanceId}`);
      return metric;
    } catch (error) {
      this.logger.error('Error creating metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get metrics by ID
   * @param {string} performanceId - Performance ID
   * @returns {Object} - Metric document or null if not found
   */
  async getMetrics(performanceId) {
    try {
      return await this.models.Metric.findOne({
        where: { performanceId }
      });
    } catch (error) {
      this.logger.error(`Error getting metrics ${performanceId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get metrics for content
   * @param {string} contentId - Content ID
   * @param {Object} options - Query options
   * @returns {Array} - Array of metrics
   */
  async getContentMetrics(contentId, options = {}) {
    try {
      const { limit = 10, dateStart, dateEnd } = options;
      
      const where = { contentId };
      
      if (dateStart || dateEnd) {
        where['dateRange.start'] = {};
        if (dateStart) where['dateRange.start'][Sequelize.Op.gte] = new Date(dateStart);
        if (dateEnd) where['dateRange.start'][Sequelize.Op.lte] = new Date(dateEnd);
      }
      
      return await this.models.Metric.findAll({
        where,
        order: [['dateRange.start', 'DESC']],
        limit
      });
    } catch (error) {
      this.logger.error(`Error getting content metrics for ${contentId}:`, error);
      throw error;
    }
  }
  
  // =====================================
  // Brand Guidelines Methods
  // =====================================
  
  /**
   * Create brand guidelines
   * @param {Object} guidelineData - Brand guideline data
   * @returns {Object} - Created brand guideline
   */
  async createBrandGuideline(guidelineData) {
    try {
      // Generate guidelineId if not provided
      if (!guidelineData.guidelineId) {
        guidelineData.guidelineId = await this.models.BrandGuideline.generateGuidelineId();
      }
      
      const guideline = await this.models.BrandGuideline.create(guidelineData);
      
      this.logger.info(`Brand guideline created with ID: ${guideline.guidelineId}`);
      return guideline;
    } catch (error) {
      this.logger.error('Error creating brand guideline:', error);
      throw error;
    }
  }
  
  /**
   * Get brand guideline by ID
   * @param {string} guidelineId - Guideline ID
   * @returns {Object} - Brand guideline document or null if not found
   */
  async getBrandGuideline(guidelineId) {
    try {
      return await this.models.BrandGuideline.findOne({
        where: { guidelineId }
      });
    } catch (error) {
      this.logger.error(`Error getting brand guideline ${guidelineId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get latest brand guideline
   * @returns {Object} - Latest brand guideline document or null if not found
   */
  async getLatestBrandGuideline() {
    try {
      return await this.models.BrandGuideline.findOne({
        order: [['updatedAt', 'DESC']]
      });
    } catch (error) {
      this.logger.error('Error getting latest brand guideline:', error);
      throw error;
    }
  }
  
  /**
   * Update brand guideline
   * @param {string} guidelineId - Guideline ID
   * @param {Object} updateData - Update data
   * @returns {Object} - Updated brand guideline
   */
  async updateBrandGuideline(guidelineId, updateData) {
    try {
      const guideline = await this.models.BrandGuideline.findOne({
        where: { guidelineId }
      });
      
      if (!guideline) {
        throw new Error(`Brand guideline with ID ${guidelineId} not found`);
      }
      
      await guideline.update(updateData);
      
      this.logger.info(`Brand guideline ${guidelineId} updated`);
      return guideline;
    } catch (error) {
      this.logger.error(`Error updating brand guideline ${guidelineId}:`, error);
      throw error;
    }
  }
  
  // =====================================
  // User Methods
  // =====================================
  
  /**
   * Create user
   * @param {Object} userData - User data
   * @returns {Object} - Created user
   */
  async createUser(userData) {
    try {
      // Generate userId if not provided
      if (!userData.userId) {
        userData.userId = await this.models.User.generateUserId();
      }
      
      const user = await this.models.User.create(userData);
      
      this.logger.info(`User created with ID: ${user.userId}`);
      return user;
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }
  
  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Object} - User document or null if not found
   */
  async getUser(userId) {
    try {
      return await this.models.User.findOne({
        where: { userId }
      });
    } catch (error) {
      this.logger.error(`Error getting user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get user by email
   * @param {string} email - User email
   * @returns {Object} - User document or null if not found
   */
  async getUserByEmail(email) {
    try {
      return await this.models.User.findOne({ 
        where: { 
          email: email.toLowerCase() 
        } 
      });
    } catch (error) {
      this.logger.error(`Error getting user by email ${email}:`, error);
      throw error;
    }
  }
  
  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} updateData - Update data
   * @returns {Object} - Updated user
   */
  async updateUser(userId, updateData) {
    try {
      const user = await this.models.User.findOne({
        where: { userId }
      });
      
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      await user.update(updateData);
      
      this.logger.info(`User ${userId} updated`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  }
  
  // =====================================
  // Workflow Methods
  // =====================================
  
  /**
   * Create workflow
   * @param {Object} workflowData - Workflow data
   * @returns {Object} - Created workflow
   */
  async createWorkflow(workflowData) {
    try {
      // Generate workflowId if not provided
      if (!workflowData.workflowId) {
        workflowData.workflowId = await this.models.Workflow.generateWorkflowId();
      }
      
      const workflow = await this.models.Workflow.create(workflowData);
      
      this.logger.info(`Workflow created with ID: ${workflow.workflowId}`);
      return workflow;
    } catch (error) {
      this.logger.error('Error creating workflow:', error);
      throw error;
    }
  }
  
  /**
   * Get workflow by ID
   * @param {string} workflowId - Workflow ID
   * @returns {Object} - Workflow document or null if not found
   */
  async getWorkflow(workflowId) {
    try {
      return await this.models.Workflow.findOne({
        where: { workflowId }
      });
    } catch (error) {
      this.logger.error(`Error getting workflow ${workflowId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update workflow
   * @param {string} workflowId - Workflow ID
   * @param {Object} updateData - Update data
   * @returns {Object} - Updated workflow
   */
  async updateWorkflow(workflowId, updateData) {
    try {
      const workflow = await this.models.Workflow.findOne({
        where: { workflowId }
      });
      
      if (!workflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }
      
      await workflow.update(updateData);
      
      this.logger.info(`Workflow ${workflowId} updated`);
      return workflow;
    } catch (error) {
      this.logger.error(`Error updating workflow ${workflowId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get active workflows
   * @param {Object} options - Query options
   * @returns {Array} - Array of active workflows
   */
  async getActiveWorkflows(options = {}) {
    try {
      const { type, limit = 100 } = options;
      
      const where = { 
        status: { [Sequelize.Op.in]: ['pending', 'in_progress'] }
      };
      
      if (type) {
        where.type = type;
      }
      
      return await this.models.Workflow.findAll({
        where,
        order: [
          ['priority', 'DESC'],
          ['createdAt', 'ASC']
        ],
        limit
      });
    } catch (error) {
      this.logger.error('Error getting active workflows:', error);
      throw error;
    }
  }
  
  /**
   * Update workflow step
   * @param {string} workflowId - Workflow ID
   * @param {string} stepId - Step ID
   * @param {Object} updateData - Update data
   * @returns {Object} - Updated workflow
   */
  async updateWorkflowStep(workflowId, stepId, updateData) {
    try {
      const workflow = await this.getWorkflow(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }
      
      // In a relational database, the steps would typically be in a separate table
      // For now, we'll assume the workflow model includes a steps JSON array
      const steps = workflow.steps || [];
      const stepIndex = steps.findIndex(step => step.stepId === stepId);
      
      if (stepIndex === -1) {
        throw new Error(`Step with ID ${stepId} not found in workflow ${workflowId}`);
      }
      
      // Update step fields - this is doing a partial update of a JSON field in PostgreSQL
      // The exact SQL will depend on how the model is structured
      steps[stepIndex] = { ...steps[stepIndex], ...updateData };
      
      // Save the updated workflow
      await workflow.update({ steps });
      
      this.logger.info(`Workflow ${workflowId} step ${stepId} updated`);
      return workflow;
    } catch (error) {
      this.logger.error(`Error updating workflow ${workflowId} step ${stepId}:`, error);
      throw error;
    }
  }
}

module.exports = DatabaseService;