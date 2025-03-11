/**
 * Database Service using Mongoose
 * Provides MongoDB connection and model management
 */

const mongoose = require('mongoose');
const models = require('../../models');

class DatabaseService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.models = models;
    this.isConnected = false;
    
    // Connection options
    this.options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
  }

  /**
   * Connect to MongoDB
   */
  async connect() {
    try {
      this.logger.info('Connecting to MongoDB database...');
      
      // Set up mongoose connection
      mongoose.set('strictQuery', false);
      
      // Connect to MongoDB
      await mongoose.connect(this.config.uri, this.options);
      
      this.isConnected = true;
      this.logger.info('MongoDB database connected successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB database:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    try {
      if (mongoose.connection) {
        await mongoose.connection.close();
        this.isConnected = false;
        this.logger.info('MongoDB database disconnected');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from MongoDB database:', error);
      throw error;
    }
  }

  /**
   * Get database connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection ? mongoose.connection.readyState : 0
    };
  }

  /**
   * Create indexes for all models
   */
  async createIndexes() {
    try {
      this.logger.info('Creating indexes for all models...');
      
      const modelNames = Object.keys(this.models);
      for (const modelName of modelNames) {
        this.logger.debug(`Creating indexes for ${modelName} model...`);
        await this.models[modelName].createIndexes();
      }
      
      this.logger.info('All indexes created successfully');
      return true;
    } catch (error) {
      this.logger.error('Error creating indexes:', error);
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
        contentData.contentId = this.models.Content.generateContentId();
      }
      
      const content = new this.models.Content(contentData);
      await content.save();
      
      // Create initial version
      await this.createContentVersion(content.contentId, content.toObject(), content.createdBy);
      
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
      return await this.models.Content.findOne({ contentId });
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
      // Get current content
      const content = await this.getContent(contentId);
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`);
      }
      
      // Create version before updating
      await this.createContentVersion(contentId, content.toObject(), updateData.updatedBy || 'system');
      
      // Update content
      const updatedContent = await this.models.Content.findOneAndUpdate(
        { contentId },
        updateData,
        { new: true, runValidators: true }
      );
      
      this.logger.info(`Content ${contentId} updated`);
      return updatedContent;
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
      const version = contentData.version || 1;
      
      const contentVersion = new this.models.ContentVersion({
        contentId,
        version,
        data: contentData,
        createdBy
      });
      
      await contentVersion.save();
      
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
      return await this.models.ContentVersion.find(
        { contentId },
        null,
        { sort: { version: -1 } }
      );
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
        const result = await this.models.Content.deleteOne({ contentId });
        return result.deletedCount > 0;
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
        sort = { createdAt: -1 },
        page = 1,
        limit = 20
      } = query;
      
      // Build filter
      const filter = {};
      
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (categories) filter.categories = { $in: Array.isArray(categories) ? categories : [categories] };
      if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      if (createdBy) filter.createdBy = createdBy;
      if (updatedBy) filter.updatedBy = updatedBy;
      
      // Date range
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo);
      }
      
      // Text search
      if (searchText) {
        filter.$text = { $search: searchText };
      }
      
      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      // Get total count
      const total = await this.models.Content.countDocuments(filter);
      
      // Get results
      const contents = await this.models.Content.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
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
        briefData.briefId = this.models.Brief.generateBriefId();
      }
      
      const brief = new this.models.Brief(briefData);
      await brief.save();
      
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
      return await this.models.Brief.findOne({ briefId });
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
      const updatedBrief = await this.models.Brief.findOneAndUpdate(
        { briefId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedBrief) {
        throw new Error(`Brief with ID ${briefId} not found`);
      }
      
      this.logger.info(`Brief ${briefId} updated`);
      return updatedBrief;
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
        metricData.performanceId = this.models.Metric.generatePerformanceId();
      }
      
      const metric = new this.models.Metric(metricData);
      await metric.save();
      
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
      return await this.models.Metric.findOne({ performanceId });
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
      
      const query = { contentId };
      
      if (dateStart || dateEnd) {
        query['dateRange.start'] = {};
        if (dateStart) query['dateRange.start'].$gte = new Date(dateStart);
        if (dateEnd) query['dateRange.start'].$lte = new Date(dateEnd);
      }
      
      return await this.models.Metric.find(query)
        .sort({ 'dateRange.start': -1 })
        .limit(limit);
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
        guidelineData.guidelineId = this.models.BrandGuideline.generateGuidelineId();
      }
      
      const guideline = new this.models.BrandGuideline(guidelineData);
      await guideline.save();
      
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
      return await this.models.BrandGuideline.findOne({ guidelineId });
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
      return await this.models.BrandGuideline.findOne()
        .sort({ updatedAt: -1 });
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
      const updatedGuideline = await this.models.BrandGuideline.findOneAndUpdate(
        { guidelineId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedGuideline) {
        throw new Error(`Brand guideline with ID ${guidelineId} not found`);
      }
      
      this.logger.info(`Brand guideline ${guidelineId} updated`);
      return updatedGuideline;
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
        userData.userId = this.models.User.generateUserId();
      }
      
      const user = new this.models.User(userData);
      await user.save();
      
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
      return await this.models.User.findOne({ userId });
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
      return await this.models.User.findOne({ email: email.toLowerCase() });
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
      const updatedUser = await this.models.User.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedUser) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      this.logger.info(`User ${userId} updated`);
      return updatedUser;
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
        workflowData.workflowId = this.models.Workflow.generateWorkflowId();
      }
      
      const workflow = new this.models.Workflow(workflowData);
      await workflow.save();
      
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
      return await this.models.Workflow.findOne({ workflowId });
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
      const updatedWorkflow = await this.models.Workflow.findOneAndUpdate(
        { workflowId },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!updatedWorkflow) {
        throw new Error(`Workflow with ID ${workflowId} not found`);
      }
      
      this.logger.info(`Workflow ${workflowId} updated`);
      return updatedWorkflow;
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
      
      const query = { 
        status: { $in: ['pending', 'in_progress'] }
      };
      
      if (type) {
        query.type = type;
      }
      
      return await this.models.Workflow.find(query)
        .sort({ priority: -1, createdAt: 1 })
        .limit(limit);
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
      
      const stepIndex = workflow.steps.findIndex(step => step.stepId === stepId);
      
      if (stepIndex === -1) {
        throw new Error(`Step with ID ${stepId} not found in workflow ${workflowId}`);
      }
      
      // Update step fields
      for (const [key, value] of Object.entries(updateData)) {
        workflow.steps[stepIndex][key] = value;
      }
      
      // Save the updated workflow
      await workflow.save();
      
      this.logger.info(`Workflow ${workflowId} step ${stepId} updated`);
      return workflow;
    } catch (error) {
      this.logger.error(`Error updating workflow ${workflowId} step ${stepId}:`, error);
      throw error;
    }
  }
}

module.exports = DatabaseService;