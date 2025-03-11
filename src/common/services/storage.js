/**
 * Storage Service
 * Provides database access for the agent system using Mongoose models
 */

class StorageService {
  /**
   * Create a new storage service
   * @param {Object} models - Mongoose model instances
   */
  constructor(models) {
    this.models = models;
  }
  
  // =====================================
  // Content Methods
  // =====================================
  
  /**
   * Store content
   * @param {Object} contentData - Content data
   * @returns {string} - Content ID
   */
  async storeContent(contentData) {
    try {
      const content = await this.models.Content.create(contentData);
      return content.contentId;
    } catch (error) {
      throw new Error(`Failed to store content: ${error.message}`);
    }
  }
  
  /**
   * Get content by ID
   * @param {string} contentId - Content ID
   * @returns {Object|null} - Content document or null if not found
   */
  async getContent(contentId) {
    try {
      return await this.models.Content.findOne({ contentId });
    } catch (error) {
      throw new Error(`Failed to get content ${contentId}: ${error.message}`);
    }
  }
  
  /**
   * Update content
   * @param {string} contentId - Content ID
   * @param {Object} updateData - Update data
   * @returns {boolean} - Success indicator
   */
  async updateContent(contentId, updateData) {
    try {
      const result = await this.models.Content.findOneAndUpdate(
        { contentId },
        updateData,
        { new: true }
      );
      
      return !!result;
    } catch (error) {
      throw new Error(`Failed to update content ${contentId}: ${error.message}`);
    }
  }
  
  /**
   * Delete content
   * @param {string} contentId - Content ID
   * @returns {boolean} - Success indicator
   */
  async deleteContent(contentId) {
    try {
      const result = await this.models.Content.findOneAndUpdate(
        { contentId },
        { status: 'deleted', updatedAt: new Date() }
      );
      
      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete content ${contentId}: ${error.message}`);
    }
  }
  
  /**
   * Archive content
   * @param {string} contentId - Content ID
   * @param {Object} archiveData - Archive data
   * @returns {boolean} - Success indicator
   */
  async archiveContent(contentId, archiveData) {
    try {
      // Get the content first
      const content = await this.getContent(contentId);
      
      if (!content) {
        throw new Error(`Content ${contentId} not found`);
      }
      
      // Create a content version as archive record
      const archiveVersion = await this.models.ContentVersion.create({
        contentId,
        version: content.version,
        data: content.toObject(),
        reason: archiveData.reason || 'archive',
        createdBy: archiveData.archivedBy || 'system'
      });
      
      return !!archiveVersion;
    } catch (error) {
      throw new Error(`Failed to archive content ${contentId}: ${error.message}`);
    }
  }
  
  /**
   * Add content history
   * @param {Object} historyData - History data
   * @returns {boolean} - Success indicator
   */
  async addContentHistory(historyData) {
    try {
      const { contentId, previousVersion, updatedAt, updatedBy } = historyData;
      
      const contentVersion = await this.models.ContentVersion.create({
        contentId,
        version: previousVersion.version,
        data: previousVersion,
        createdBy: updatedBy || 'system'
      });
      
      return !!contentVersion;
    } catch (error) {
      throw new Error(`Failed to add content history: ${error.message}`);
    }
  }
  
  /**
   * Get content history
   * @param {string} contentId - Content ID
   * @returns {Array} - Array of content versions
   */
  async getContentHistory(contentId) {
    try {
      return await this.models.ContentVersion.find(
        { contentId },
        null,
        { sort: { version: -1 } }
      );
    } catch (error) {
      throw new Error(`Failed to get content history for ${contentId}: ${error.message}`);
    }
  }
  
  /**
   * Get all contents
   * @param {Object} filter - Filter criteria
   * @param {Object} options - Query options
   * @returns {Array} - Array of content documents
   */
  async getAllContents(filter = {}, options = {}) {
    try {
      return await this.models.Content.find(filter)
        .sort(options.sort || { updatedAt: -1 })
        .skip(options.skip || 0)
        .limit(options.limit || 20);
    } catch (error) {
      throw new Error(`Failed to get contents: ${error.message}`);
    }
  }
  
  /**
   * Count contents
   * @param {Object} filter - Filter criteria
   * @returns {number} - Count of matching contents
   */
  async countContents(filter = {}) {
    try {
      return await this.models.Content.countDocuments(filter);
    } catch (error) {
      throw new Error(`Failed to count contents: ${error.message}`);
    }
  }
  
  /**
   * Get content analytics
   * @param {string} contentId - Content ID
   * @param {string} timeframe - Timeframe for analytics
   * @returns {Object} - Content analytics
   */
  async getContentAnalytics(contentId, timeframe = 'month') {
    try {
      // Get the most recent metrics
      const metrics = await this.models.Metric.findOne(
        { contentId },
        null,
        { sort: { 'dateRange.end': -1 } }
      );
      
      if (!metrics) {
        return {
          contentId,
          available: false,
          message: 'No analytics data available'
        };
      }
      
      return {
        contentId,
        available: true,
        metrics
      };
    } catch (error) {
      throw new Error(`Failed to get content analytics for ${contentId}: ${error.message}`);
    }
  }
  
  // =====================================
  // Brief Methods
  // =====================================
  
  /**
   * Store brief
   * @param {Object} briefData - Brief data
   * @returns {string} - Brief ID
   */
  async storeBrief(briefData) {
    try {
      const brief = await this.models.Brief.create(briefData);
      return brief.briefId;
    } catch (error) {
      throw new Error(`Failed to store brief: ${error.message}`);
    }
  }
  
  /**
   * Get brief by ID
   * @param {string} briefId - Brief ID
   * @returns {Object|null} - Brief document or null if not found
   */
  async getBrief(briefId) {
    try {
      return await this.models.Brief.findOne({ briefId });
    } catch (error) {
      throw new Error(`Failed to get brief ${briefId}: ${error.message}`);
    }
  }
  
  /**
   * Update brief
   * @param {string} briefId - Brief ID
   * @param {Object} updateData - Update data
   * @returns {boolean} - Success indicator
   */
  async updateBrief(briefId, updateData) {
    try {
      const result = await this.models.Brief.findOneAndUpdate(
        { briefId },
        updateData,
        { new: true }
      );
      
      return !!result;
    } catch (error) {
      throw new Error(`Failed to update brief ${briefId}: ${error.message}`);
    }
  }
  
  // =====================================
  // Brand Guidelines Methods
  // =====================================
  
  /**
   * Get brand guidelines
   * @returns {Object|null} - Brand guidelines document or null if not found
   */
  async getBrandGuidelines() {
    try {
      return await this.models.BrandGuideline.findOne({}, null, { sort: { updatedAt: -1 } });
    } catch (error) {
      throw new Error(`Failed to get brand guidelines: ${error.message}`);
    }
  }
  
  /**
   * Update brand guidelines
   * @param {Object} guidelineData - Brand guidelines data
   * @returns {boolean} - Success indicator
   */
  async updateBrandGuidelines(guidelineData) {
    try {
      // Check if guidelines exist
      const existingGuidelines = await this.models.BrandGuideline.findOne();
      
      if (existingGuidelines) {
        // Update existing guidelines
        const updated = await this.models.BrandGuideline.findByIdAndUpdate(
          existingGuidelines._id,
          {
            ...guidelineData,
            version: (parseFloat(existingGuidelines.version) + 0.1).toFixed(1),
            lastUpdated: new Date()
          },
          { new: true }
        );
        
        return !!updated;
      } else {
        // Create new guidelines
        const guideline = await this.models.BrandGuideline.create({
          guidelineId: this.models.BrandGuideline.generateGuidelineId(),
          version: '1.0',
          lastUpdated: new Date(),
          ...guidelineData
        });
        
        return !!guideline;
      }
    } catch (error) {
      throw new Error(`Failed to update brand guidelines: ${error.message}`);
    }
  }
  
  // =====================================
  // Workflow Methods
  // =====================================
  
  /**
   * Create workflow
   * @param {Object} workflowData - Workflow data
   * @returns {string} - Workflow ID
   */
  async createWorkflow(workflowData) {
    try {
      const workflow = await this.models.Workflow.create(workflowData);
      return workflow.workflowId;
    } catch (error) {
      throw new Error(`Failed to create workflow: ${error.message}`);
    }
  }
  
  /**
   * Get workflow
   * @param {string} workflowId - Workflow ID
   * @returns {Object|null} - Workflow document or null if not found
   */
  async getWorkflow(workflowId) {
    try {
      return await this.models.Workflow.findOne({ workflowId });
    } catch (error) {
      throw new Error(`Failed to get workflow ${workflowId}: ${error.message}`);
    }
  }
  
  /**
   * Update workflow
   * @param {string} workflowId - Workflow ID
   * @param {Object} updateData - Update data
   * @returns {boolean} - Success indicator
   */
  async updateWorkflow(workflowId, updateData) {
    try {
      const result = await this.models.Workflow.findOneAndUpdate(
        { workflowId },
        updateData,
        { new: true }
      );
      
      return !!result;
    } catch (error) {
      throw new Error(`Failed to update workflow ${workflowId}: ${error.message}`);
    }
  }
  
  /**
   * Get active workflows
   * @returns {Array} - Array of active workflows
   */
  async getActiveWorkflows() {
    try {
      return await this.models.Workflow.find({
        status: { $in: ['pending', 'in_progress'] }
      }).sort({ priority: -1, createdAt: 1 });
    } catch (error) {
      throw new Error(`Failed to get active workflows: ${error.message}`);
    }
  }
  
  // =====================================
  // Report & Analytics Methods
  // =====================================
  
  /**
   * Store metrics
   * @param {Object} metricsData - Metrics data
   * @returns {string} - Performance ID
   */
  async storeMetrics(metricsData) {
    try {
      const metrics = await this.models.Metric.create(metricsData);
      return metrics.performanceId;
    } catch (error) {
      throw new Error(`Failed to store metrics: ${error.message}`);
    }
  }
  
  /**
   * Get metrics
   * @param {string} contentId - Content ID
   * @returns {Object|null} - Latest metrics document or null if not found
   */
  async getMetrics(contentId) {
    try {
      return await this.models.Metric.findOne(
        { contentId },
        null,
        { sort: { 'dateRange.end': -1 } }
      );
    } catch (error) {
      throw new Error(`Failed to get metrics for ${contentId}: ${error.message}`);
    }
  }
  
  /**
   * Store report
   * @param {Object} reportData - Report data
   * @returns {string} - Report ID
   */
  async storeReport(reportData) {
    try {
      const report = await this.models.Report.create(reportData);
      return report.reportId;
    } catch (error) {
      throw new Error(`Failed to store report: ${error.message}`);
    }
  }
  
  /**
   * Get topic performance
   * @param {Object} options - Query options
   * @returns {Array} - Array of topic performance data
   */
  async getTopicPerformance(options = {}) {
    try {
      // In a real implementation, this would involve aggregation queries
      // For now, return a simplified implementation
      const { timeframe, limit, sortMetric, category } = options;
      
      // Mock implementation - in real system, this would be a complex aggregation
      return [
        {
          topic: 'AI Website Builder',
          metrics: {
            views: 12500,
            engagement: 78.3,
            conversions: 234
          },
          trend: '+12%'
        },
        {
          topic: 'Small Business Websites',
          metrics: {
            views: 8700,
            engagement: 65.1,
            conversions: 189
          },
          trend: '+8%'
        }
      ].slice(0, limit || 10);
    } catch (error) {
      throw new Error(`Failed to get topic performance: ${error.message}`);
    }
  }
  
  /**
   * Get channel performance
   * @param {Object} options - Query options
   * @returns {Array} - Array of channel performance data
   */
  async getChannelPerformance(options = {}) {
    try {
      // Mock implementation
      return [
        {
          channel: 'Blog',
          metrics: {
            views: 45200,
            engagement: 72.3,
            conversions: 567
          },
          trend: '+5%'
        },
        {
          channel: 'Social Media',
          metrics: {
            views: 87300,
            engagement: 45.7,
            conversions: 312
          },
          trend: '+15%'
        }
      ];
    } catch (error) {
      throw new Error(`Failed to get channel performance: ${error.message}`);
    }
  }
  
  /**
   * Get audience data
   * @param {Object} options - Query options
   * @returns {Object} - Audience data
   */
  async getAudienceData(options = {}) {
    try {
      // Mock implementation
      return {
        segments: [
          {
            name: 'Small Business Owners',
            percentage: 45.2,
            engagement: 76.4,
            conversion: 3.2
          },
          {
            name: 'Marketing Professionals',
            percentage: 28.7,
            engagement: 82.1,
            conversion: 4.5
          }
        ],
        demographics: {
          age: {
            '18-24': 12.3,
            '25-34': 28.7,
            '35-44': 32.5,
            '45-54': 18.2,
            '55+': 8.3
          },
          gender: {
            male: 54.7,
            female: 45.3
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to get audience data: ${error.message}`);
    }
  }
  
  /**
   * Get recent activity
   * @param {Object} options - Query options
   * @returns {Array} - Array of recent activity
   */
  async getRecentActivity(options = {}) {
    try {
      const { limit = 10, userId } = options;
      
      // In a real implementation, this would query recent content changes, workflow updates, etc.
      // For now, return mock data
      return [
        {
          type: 'content_created',
          contentTitle: 'How AI is Transforming Web Design',
          timestamp: new Date(Date.now() - 86400000),
          user: 'content_creation_agent'
        },
        {
          type: 'workflow_completed',
          workflowName: 'Weekly SEO Review',
          timestamp: new Date(Date.now() - 172800000),
          user: 'optimization_agent'
        }
      ].slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to get recent activity: ${error.message}`);
    }
  }
}

module.exports = StorageService;