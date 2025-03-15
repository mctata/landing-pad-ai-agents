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
    // Use logger directly since it's already a winston instance
    this.logger = logger;
    this.models = models;
    this.isConnected = false;
    this.sequelize = null;
  }

  /**
   * Connect to PostgreSQL with optimized settings
   */
  async connect() {
    try {
      this.logger.info('Connecting to PostgreSQL database...');
      
      // Get environment
      const environment = process.env.NODE_ENV || 'development';
      
      // Default pool configuration
      const poolConfig = {
        max: environment === 'production' ? 20 : 10,
        min: environment === 'production' ? 2 : 0,
        acquire: 30000,
        idle: environment === 'production' ? 10000 : 10000
      };
      
      // Override with config values if provided
      if (this.config.pool) {
        Object.assign(poolConfig, this.config.pool);
      }
      
      // Optimize for production environment
      const dialectOptions = {
        ssl: this.config.ssl ? {
          require: true,
          rejectUnauthorized: false
        } : false
      };
      
      // For production, add statement timeout to prevent long-running queries
      if (environment === 'production') {
        dialectOptions.statement_timeout = 30000; // 30 seconds
        
        // Add application_name for easier identification in pg_stat_activity
        dialectOptions.application_name = 'landing-pad-ai-agents';
      }
      
      // Create Sequelize instance with optimized settings
      this.sequelize = new Sequelize(
        this.config.database,
        this.config.username,
        this.config.password,
        {
          host: this.config.host,
          port: this.config.port,
          dialect: 'postgres',
          logging: (msg) => this.logger.debug(msg),
          pool: poolConfig,
          dialectOptions,
          timezone: '+00:00',
          // Use query caching in production
          query: {
            raw: false,
            // For high-traffic applications in production, use prepared statements
            prepared: environment === 'production',
          },
          // Define replication settings if read replicas are available
          ...(this.config.replication ? { replication: this.config.replication } : {})
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
   * Create new content with transaction support
   * @param {Object} contentData - Content data
   * @param {Object} options - Additional options (transaction, etc.)
   * @returns {Object} - Created content
   */
  async createContent(contentData, options = {}) {
    let transaction = options.transaction;
    let managedTransaction = false;
    
    try {
      // Start transaction if not provided
      if (!transaction) {
        transaction = await this.sequelize.transaction();
        managedTransaction = true;
      }
      
      // Generate contentId if not provided
      if (!contentData.contentId) {
        contentData.contentId = await this.models.Content.generateContentId();
      }
      
      // Create content with transaction
      const content = await this.models.Content.create(contentData, { 
        transaction 
      });
      
      // Create initial version with the same transaction
      await this.createContentVersion(
        content.contentId, 
        content.toJSON(), 
        content.createdBy, 
        { transaction }
      );
      
      // Commit transaction if we started it
      if (managedTransaction) {
        await transaction.commit();
      }
      
      this.logger.info(`Content created with ID: ${content.contentId}`);
      return content;
    } catch (error) {
      // Rollback transaction if we started it
      if (managedTransaction && transaction) {
        await transaction.rollback();
      }
      
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
   * Update content with transaction support
   * @param {string} contentId - Content ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Additional options (transaction, etc.)
   * @returns {Object} - Updated content
   */
  async updateContent(contentId, updateData, options = {}) {
    let transaction = options.transaction;
    let managedTransaction = false;
    
    try {
      // Start transaction if not provided
      if (!transaction) {
        transaction = await this.sequelize.transaction();
        managedTransaction = true;
      }
      
      // Get current content to save as a version, with transaction
      const content = await this.models.Content.findOne({ 
        where: { contentId },
        transaction 
      });
      
      if (!content) {
        // Roll back transaction if we started it
        if (managedTransaction) {
          await transaction.rollback();
        }
        throw new Error(`Content with ID ${contentId} not found`);
      }
      
      // Save current state as a version (before applying updates)
      await this.createContentVersion(
        contentId, 
        content.toJSON(), 
        updateData.updatedBy || 'system',
        { transaction }
      );
      
      // Update content with transaction
      await content.update(updateData, { transaction });
      
      // Commit transaction if we started it
      if (managedTransaction) {
        await transaction.commit();
      }
      
      this.logger.info(`Content ${contentId} updated`);
      return content;
    } catch (error) {
      // Rollback transaction if we started it
      if (managedTransaction && transaction) {
        await transaction.rollback();
      }
      
      this.logger.error(`Error updating content ${contentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create content version with transaction support
   * @param {string} contentId - Content ID
   * @param {Object} contentData - Content data
   * @param {string} createdBy - User who created the version
   * @param {Object} options - Additional options (transaction, etc.)
   * @returns {Object} - Content version
   */
  async createContentVersion(contentId, contentData, createdBy, options = {}) {
    const transaction = options.transaction;
    
    try {
      // Find the latest version and increment it
      const findOptions = {
        where: { contentId },
        order: [['version', 'DESC']]
      };
      
      // Add transaction if provided
      if (transaction) findOptions.transaction = transaction;
      
      let version = 1;
      const latestVersion = await this.models.ContentVersion.findOne(findOptions);
      
      if (latestVersion) {
        version = latestVersion.version + 1;
      }
      
      // Create options for the new version
      const createOptions = {};
      if (transaction) createOptions.transaction = transaction;
      
      const contentVersion = await this.models.ContentVersion.create({
        contentId,
        version,
        data: contentData,
        createdBy
      }, createOptions);
      
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
   * Search content using PostgreSQL full-text search and advanced filtering
   * @param {Object} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - Search results with pagination
   */
  async searchContent(query = {}, options = {}) {
    const transaction = options.transaction;
    
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
        limit = 20,
        includeVersions = false,
        includeAuthor = false
      } = query;
      
      // Build where clause
      const where = {};
      
      if (type) {
        // Handle multiple types
        if (Array.isArray(type)) {
          where.type = { [Sequelize.Op.in]: type };
        } else {
          where.type = type;
        }
      }
      
      if (status) {
        // Handle multiple statuses
        if (Array.isArray(status)) {
          where.status = { [Sequelize.Op.in]: status };
        } else {
          where.status = status;
        }
      }
      
      if (createdBy) where.createdBy = createdBy;
      if (updatedBy) where.updatedBy = updatedBy;
      
      // Date range
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt[Sequelize.Op.gte] = new Date(dateFrom);
        if (dateTo) where.createdAt[Sequelize.Op.lte] = new Date(dateTo);
      }
      
      // Handle categories - using PostgreSQL array operators
      if (categories) {
        const categoryArray = Array.isArray(categories) ? categories : [categories];
        where[Sequelize.Op.and] = categoryArray.map(category => 
          Sequelize.literal(`'${category}' = ANY(categories)`)
        );
      }
      
      // Handle tags - using PostgreSQL array operators
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : [tags];
        where[Sequelize.Op.and] = (where[Sequelize.Op.and] || []).concat(
          tagArray.map(tag => Sequelize.literal(`'${tag}' = ANY(tags)`))
        );
      }
      
      // For text search, we use PostgreSQL full-text search
      if (searchText) {
        // Create a PostgreSQL tsquery from the search text
        const tsquery = searchText
          .trim()
          .split(/\s+/)
          .map(term => `${term}:*`)
          .join(' & ');
        
        // Add the full-text search condition to the where clause
        where[Sequelize.Op.and] = [
          Sequelize.literal(`search_vector @@ to_tsquery('english', '${tsquery}')`)
        ].concat(where[Sequelize.Op.and] || []);
      }
      
      // Setup includes for related models
      const include = [];
      
      if (includeAuthor) {
        include.push({
          model: this.models.User,
          as: 'author',
          attributes: ['userId', 'name', 'email', 'profilePicture']
        });
      }
      
      if (includeVersions) {
        include.push({
          model: this.models.ContentVersion,
          limit: 5,
          order: [['version', 'DESC']]
        });
      }
      
      // Execute query with pagination
      const offset = (page - 1) * limit;
      
      // Convert sort to sequelize format
      const order = [];
      
      // If using full-text search, add rank ordering
      if (searchText) {
        const tsquery = searchText
          .trim()
          .split(/\s+/)
          .map(term => `${term}:*`)
          .join(' & ');
          
        order.push([
          Sequelize.literal(`ts_rank(search_vector, to_tsquery('english', '${tsquery}'))`),
          'DESC'
        ]);
      }
      
      // Add other sort fields
      for (const [field, direction] of Object.entries(sort)) {
        order.push([field, direction]);
      }
      
      // Get total count with the transaction if provided
      const countOptions = { where };
      if (transaction) countOptions.transaction = transaction;
      const total = await this.models.Content.count(countOptions);
      
      // Query options
      const queryOptions = {
        where,
        order,
        offset,
        limit,
        include
      };
      
      // Add transaction if provided
      if (transaction) queryOptions.transaction = transaction;
      
      // Get results
      const contents = await this.models.Content.findAll(queryOptions);
      
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
   * Get workflow steps
   * @param {string} workflowId - Workflow ID
   * @param {Object} options - Additional options
   * @returns {Array} - Workflow steps
   */
  async getWorkflowSteps(workflowId, options = {}) {
    const transaction = options.transaction;
    
    try {
      const findOptions = {
        where: { workflowId },
        order: [['order', 'ASC']]
      };
      
      if (transaction) findOptions.transaction = transaction;
      
      return await this.models.WorkflowStep.findAll(findOptions);
    } catch (error) {
      this.logger.error(`Error getting workflow steps for ${workflowId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get workflow step
   * @param {string} stepId - Step ID
   * @param {Object} options - Additional options
   * @returns {Object} - Workflow step
   */
  async getWorkflowStep(stepId, options = {}) {
    const transaction = options.transaction;
    
    try {
      const findOptions = {
        where: { stepId }
      };
      
      if (transaction) findOptions.transaction = transaction;
      
      return await this.models.WorkflowStep.findOne(findOptions);
    } catch (error) {
      this.logger.error(`Error getting workflow step ${stepId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create workflow step
   * @param {Object} stepData - Step data
   * @param {Object} options - Additional options
   * @returns {Object} - Created workflow step
   */
  async createWorkflowStep(stepData, options = {}) {
    const transaction = options.transaction;
    let managedTransaction = false;
    
    try {
      // Start transaction if not provided
      if (!transaction) {
        transaction = await this.sequelize.transaction();
        managedTransaction = true;
      }
      
      // Generate stepId if not provided
      if (!stepData.stepId) {
        stepData.stepId = await this.models.WorkflowStep.generateStepId();
      }
      
      // Create step with transaction
      const step = await this.models.WorkflowStep.create(stepData, {
        transaction
      });
      
      // Update workflow's currentStepId if this is the first step
      const workflow = await this.models.Workflow.findOne({
        where: { workflowId: stepData.workflowId },
        transaction
      });
      
      if (workflow && !workflow.currentStepId) {
        await workflow.update({ currentStepId: step.stepId }, { transaction });
      }
      
      // Commit transaction if we started it
      if (managedTransaction) {
        await transaction.commit();
      }
      
      this.logger.info(`Workflow step created with ID: ${step.stepId}`);
      return step;
    } catch (error) {
      // Rollback transaction if we started it
      if (managedTransaction && transaction) {
        await transaction.rollback();
      }
      
      this.logger.error('Error creating workflow step:', error);
      throw error;
    }
  }
  
  /**
   * Update workflow step
   * @param {string} stepId - Step ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Additional options
   * @returns {Object} - Updated workflow step
   */
  async updateWorkflowStep(stepId, updateData, options = {}) {
    const transaction = options.transaction;
    let managedTransaction = false;
    
    try {
      // Start transaction if not provided
      if (!transaction) {
        transaction = await this.sequelize.transaction();
        managedTransaction = true;
      }
      
      // Get step with transaction
      const step = await this.models.WorkflowStep.findOne({
        where: { stepId },
        transaction
      });
      
      if (!step) {
        // Roll back transaction if we started it
        if (managedTransaction) {
          await transaction.rollback();
        }
        throw new Error(`Step with ID ${stepId} not found`);
      }
      
      // Update step with transaction
      await step.update(updateData, { transaction });
      
      // Update workflow if the step was completed and there are next steps
      if (updateData.status === 'completed') {
        const workflow = await this.models.Workflow.findOne({
          where: { workflowId: step.workflowId },
          transaction
        });
        
        if (workflow) {
          // Find the next step
          const nextStep = await this.models.WorkflowStep.findOne({
            where: {
              workflowId: step.workflowId,
              order: { [Sequelize.Op.gt]: step.order }
            },
            order: [['order', 'ASC']],
            transaction
          });
          
          if (nextStep) {
            // Update workflow to point to the next step
            await workflow.update({ 
              currentStepId: nextStep.stepId,
              status: 'in_progress'
            }, { transaction });
          } else {
            // No more steps, workflow is completed
            await workflow.update({ 
              status: 'completed',
              completedAt: new Date(),
              duration: workflow.startedAt ? 
                Math.floor((Date.now() - workflow.startedAt.getTime()) / 1000) : null
            }, { transaction });
          }
        }
      }
      
      // Commit transaction if we started it
      if (managedTransaction) {
        await transaction.commit();
      }
      
      this.logger.info(`Workflow step ${stepId} updated`);
      return step;
    } catch (error) {
      // Rollback transaction if we started it
      if (managedTransaction && transaction) {
        await transaction.rollback();
      }
      
      this.logger.error(`Error updating workflow step ${stepId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get current workflow step
   * @param {string} workflowId - Workflow ID
   * @param {Object} options - Additional options
   * @returns {Object} - Current workflow step
   */
  async getCurrentWorkflowStep(workflowId, options = {}) {
    const transaction = options.transaction;
    
    try {
      // Get workflow to find current step ID
      const workflow = await this.models.Workflow.findOne({
        where: { workflowId },
        transaction
      });
      
      if (!workflow || !workflow.currentStepId) {
        return null;
      }
      
      // Get current step
      return await this.models.WorkflowStep.findOne({
        where: { stepId: workflow.currentStepId },
        transaction
      });
    } catch (error) {
      this.logger.error(`Error getting current workflow step for ${workflowId}:`, error);
      throw error;
    }
  }
  
  /**
   * Migrate workflow steps from JSON to relational model
   * @param {string} workflowId - Workflow ID
   * @returns {boolean} - Success status
   */
  async migrateWorkflowSteps(workflowId) {
    let transaction;
    
    try {
      transaction = await this.sequelize.transaction();
      
      // Get workflow with transaction
      const workflow = await this.models.Workflow.findOne({
        where: { workflowId },
        transaction
      });
      
      if (!workflow || !workflow.steps || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
        await transaction.rollback();
        return false;
      }
      
      // Migrate each step to the new model
      for (let i = 0; i < workflow.steps.length; i++) {
        const oldStep = workflow.steps[i];
        const newStep = {
          stepId: oldStep.stepId || await this.models.WorkflowStep.generateStepId(),
          workflowId: workflow.workflowId,
          name: oldStep.name || `Step ${i + 1}`,
          description: oldStep.description,
          type: oldStep.type || 'automatic',
          status: oldStep.status || 'pending',
          order: i,
          config: oldStep.config || {},
          result: oldStep.result || null,
          assignedTo: oldStep.assignedTo,
          startedAt: oldStep.startedAt,
          completedAt: oldStep.completedAt,
          createdBy: workflow.createdBy,
          updatedBy: workflow.updatedBy
        };
        
        await this.models.WorkflowStep.create(newStep, { transaction });
        
        // If this is the current step, update workflow's currentStepId
        if (i === workflow.currentStep) {
          await workflow.update({ currentStepId: newStep.stepId }, { transaction });
        }
      }
      
      // Mark steps as migrated by setting a flag in metadata
      const metadata = workflow.metadata || {};
      metadata.stepsMigrated = true;
      await workflow.update({ metadata }, { transaction });
      
      await transaction.commit();
      
      this.logger.info(`Migrated ${workflow.steps.length} steps for workflow ${workflowId}`);
      return true;
    } catch (error) {
      if (transaction) await transaction.rollback();
      
      this.logger.error(`Error migrating workflow steps for ${workflowId}:`, error);
      throw error;
    }
  }
}

module.exports = DatabaseService;