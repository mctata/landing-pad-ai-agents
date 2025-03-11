/**
 * Content Tracker Module
 * Tracks content across different platforms and provides status updates
 */

const BaseModule = require('../../../common/models/base-module');

class ContentTracker extends BaseModule {
  constructor(config, storage, logger) {
    super(config, storage, logger);
    this.name = 'content_tracker';
    
    // Define default tracking settings
    this.defaultTrackingSettings = {
      checkFrequency: 24, // hours
      trackPublishStatus: true,
      trackEngagementMetrics: true,
      trackSocialShares: true,
      trackComments: true,
      requiredUpdateFrequency: 30, // days
    };
    
    // Platforms to track
    this.platforms = config.platforms || [
      'website',
      'blog',
      'twitter',
      'linkedin',
      'facebook',
      'instagram'
    ];
    
    // Cache for content status to reduce DB queries
    this.contentStatusCache = new Map();
    this.cacheExpiryTime = 15 * 60 * 1000; // 15 minutes
  }
  
  async initialize() {
    this.logger.info('Initializing content tracker module');
    
    // Create necessary database indexes
    try {
      await this.storage.collections.content_status.createIndex({ 
        content_id: 1, 
        platform: 1 
      }, { unique: true });
      
      await this.storage.collections.content_status.createIndex({ 
        last_updated: 1 
      });
      
      this.logger.info('Content status indexes created');
    } catch (error) {
      this.logger.warn('Failed to create content status indexes:', error);
    }
    
    // Validate and merge configuration
    this.trackingSettings = {
      ...this.defaultTrackingSettings,
      ...(this.config.tracking || {})
    };
    
    this.logger.info('Content tracker module initialized with settings:', {
      platforms: this.platforms,
      trackingSettings: this.trackingSettings
    });
  }
  
  async start() {
    await super.start();
    this.logger.info('Content tracker module started');
    
    // Start scheduled status updates if enabled
    if (this.trackingSettings.checkFrequency > 0) {
      this._scheduleStatusUpdates();
    }
  }
  
  async stop() {
    await super.stop();
    this.logger.info('Content tracker module stopped');
    
    // Clear any scheduled updates
    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
      this._updateTimer = null;
    }
  }
  
  /**
   * Track content on a specific platform
   * @param {string} contentId - Content ID
   * @param {string} platform - Platform name
   * @param {Object} status - Status data
   * @returns {Object} Updated status record
   */
  async trackContent(contentId, platform, status) {
    this.logger.info('Tracking content status', { contentId, platform });
    
    if (!this.platforms.includes(platform)) {
      this.logger.warn('Unsupported platform for tracking', { platform });
      throw new Error(`Unsupported platform: ${platform}`);
    }
    
    try {
      // Get content item to verify it exists
      const contentItem = await this.storage.collections.content_items.findOne({
        _id: this.storage.ObjectId(contentId)
      });
      
      if (!contentItem) {
        throw new Error(`Content not found: ${contentId}`);
      }
      
      // Create or update status record
      const now = new Date();
      const statusData = {
        content_id: this.storage.ObjectId(contentId),
        platform,
        status: status.status || 'unknown',
        url: status.url,
        published_at: status.published_at ? new Date(status.published_at) : null,
        last_updated: now,
        metrics: {
          views: status.metrics?.views || 0,
          likes: status.metrics?.likes || 0,
          shares: status.metrics?.shares || 0,
          comments: status.metrics?.comments || 0,
          clicks: status.metrics?.clicks || 0,
          conversion_rate: status.metrics?.conversion_rate || 0
        },
        metadata: status.metadata || {}
      };
      
      // Upsert the status record
      const result = await this.storage.collections.content_status.updateOne(
        { content_id: this.storage.ObjectId(contentId), platform },
        { $set: statusData },
        { upsert: true }
      );
      
      // Update cache
      const cacheKey = `${contentId}:${platform}`;
      this.contentStatusCache.set(cacheKey, {
        data: statusData,
        expiresAt: Date.now() + this.cacheExpiryTime
      });
      
      this.logger.info('Content status tracked successfully', {
        contentId,
        platform,
        status: status.status,
        operation: result.upsertedCount > 0 ? 'created' : 'updated'
      });
      
      return statusData;
    } catch (error) {
      this.logger.error('Error tracking content status:', error);
      throw error;
    }
  }
  
  /**
   * Get content status for a specific content item
   * @param {string} contentId - Content ID
   * @param {string} platform - Optional platform filter
   * @returns {Array|Object} Status records
   */
  async getContentStatus(contentId, platform = null) {
    this.logger.info('Getting content status', { contentId, platform });
    
    // Check cache first if looking for a specific platform
    if (platform) {
      const cacheKey = `${contentId}:${platform}`;
      const cachedStatus = this.contentStatusCache.get(cacheKey);
      
      if (cachedStatus && cachedStatus.expiresAt > Date.now()) {
        this.logger.debug('Using cached content status', { contentId, platform });
        return cachedStatus.data;
      }
    }
    
    try {
      const query = { content_id: this.storage.ObjectId(contentId) };
      
      if (platform) {
        query.platform = platform;
        
        // Get single platform status
        const status = await this.storage.collections.content_status.findOne(query);
        
        // Update cache
        if (status) {
          const cacheKey = `${contentId}:${platform}`;
          this.contentStatusCache.set(cacheKey, {
            data: status,
            expiresAt: Date.now() + this.cacheExpiryTime
          });
        }
        
        return status || null;
      }
      
      // Get all platform statuses
      return await this.storage.collections.content_status.find(query).toArray();
    } catch (error) {
      this.logger.error('Error getting content status:', error);
      throw error;
    }
  }
  
  /**
   * Find content items that need attention (not published, stale, etc.)
   * @param {Object} filters - Optional filters
   * @returns {Array} Content items that need attention
   */
  async findContentNeedingAttention(filters = {}) {
    this.logger.info('Finding content that needs attention', { filters });
    
    try {
      const now = new Date();
      const requiredUpdateTime = new Date(now);
      requiredUpdateTime.setDate(now.getDate() - this.trackingSettings.requiredUpdateFrequency);
      
      // Build query conditions
      const statusQuery = {
        $or: [
          { status: 'draft' },
          { status: 'scheduled' },
          { status: 'needs_review' },
          {
            status: 'published',
            last_updated: { $lt: requiredUpdateTime }
          }
        ]
      };
      
      // Apply platform filter if provided
      if (filters.platform) {
        statusQuery.platform = filters.platform;
      }
      
      // Apply content type filter if provided
      if (filters.contentType) {
        // First get content IDs of the specified type
        const contentItems = await this.storage.collections.content_items.find({
          type: filters.contentType
        }).toArray();
        
        const contentIds = contentItems.map(item => item._id);
        statusQuery.content_id = { $in: contentIds };
      }
      
      // Find status records that match the criteria
      const statusRecords = await this.storage.collections.content_status.find(statusQuery).toArray();
      
      // Get full content details for each status record
      const contentItems = await Promise.all(
        statusRecords.map(async status => {
          const content = await this.storage.collections.content_items.findOne({
            _id: status.content_id
          });
          
          return {
            content,
            status
          };
        })
      );
      
      // Filter out any null content items (in case some were deleted but status remains)
      const validItems = contentItems.filter(item => item.content !== null);
      
      this.logger.info('Found content items needing attention', {
        count: validItems.length
      });
      
      return validItems;
    } catch (error) {
      this.logger.error('Error finding content needing attention:', error);
      throw error;
    }
  }
  
  /**
   * Get all tracked platforms for a specific content item
   * @param {string} contentId - Content ID
   * @returns {Array} Platforms where content is tracked
   */
  async getTrackedPlatforms(contentId) {
    try {
      const records = await this.storage.collections.content_status.find({
        content_id: this.storage.ObjectId(contentId)
      }).toArray();
      
      return records.map(record => record.platform);
    } catch (error) {
      this.logger.error('Error getting tracked platforms:', error);
      throw error;
    }
  }
  
  /**
   * Get publishing statistics
   * @param {Object} filters - Optional filters
   * @returns {Object} Publishing statistics
   */
  async getPublishingStats(filters = {}) {
    this.logger.info('Getting publishing statistics', { filters });
    
    try {
      // Build base query
      const query = {};
      
      // Apply platform filter
      if (filters.platform) {
        query.platform = filters.platform;
      }
      
      // Apply date range filter
      if (filters.startDate) {
        query.last_updated = query.last_updated || {};
        query.last_updated.$gte = new Date(filters.startDate);
      }
      
      if (filters.endDate) {
        query.last_updated = query.last_updated || {};
        query.last_updated.$lte = new Date(filters.endDate);
      }
      
      // Get status counts by platform and status
      const platforms = await this.storage.collections.content_status.aggregate([
        { $match: query },
        { 
          $group: {
            _id: { platform: '$platform', status: '$status' },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.platform',
            statuses: {
              $push: {
                status: '$_id.status',
                count: '$count'
              }
            },
            total: { $sum: '$count' }
          }
        }
      ]).toArray();
      
      // Get overall metrics
      const metrics = await this.storage.collections.content_status.aggregate([
        { $match: { ...query, status: 'published' } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$metrics.views' },
            totalLikes: { $sum: '$metrics.likes' },
            totalShares: { $sum: '$metrics.shares' },
            totalComments: { $sum: '$metrics.comments' },
            totalClicks: { $sum: '$metrics.clicks' },
            averageConversionRate: { $avg: '$metrics.conversion_rate' }
          }
        }
      ]).toArray();
      
      return {
        platforms,
        metrics: metrics.length > 0 ? metrics[0] : {
          totalViews: 0,
          totalLikes: 0,
          totalShares: 0,
          totalComments: 0,
          totalClicks: 0,
          averageConversionRate: 0
        }
      };
    } catch (error) {
      this.logger.error('Error getting publishing statistics:', error);
      throw error;
    }
  }
  
  /**
   * Schedule regular status updates
   * @private
   */
  _scheduleStatusUpdates() {
    const updateIntervalMs = this.trackingSettings.checkFrequency * 60 * 60 * 1000;
    
    const performUpdate = async () => {
      try {
        this.logger.info('Running scheduled content status update');
        
        // Find content items published within the update frequency timeframe
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - this.trackingSettings.checkFrequency);
        
        const recentStatuses = await this.storage.collections.content_status.find({
          status: 'published',
          last_updated: { $lt: cutoffDate }
        }).limit(100).toArray();
        
        this.logger.info(`Found ${recentStatuses.length} content items for status update`);
        
        // Process in batches to avoid overwhelming the system
        for (const status of recentStatuses) {
          await this._refreshContentStatus(status.content_id.toString(), status.platform);
        }
        
        this.logger.info('Scheduled content status update completed');
      } catch (error) {
        this.logger.error('Error in scheduled content status update:', error);
      }
      
      // Schedule next update
      this._updateTimer = setTimeout(performUpdate, updateIntervalMs);
    };
    
    // Start the update cycle
    this._updateTimer = setTimeout(performUpdate, updateIntervalMs);
    this.logger.info(`Scheduled content status updates every ${this.trackingSettings.checkFrequency} hours`);
  }
  
  /**
   * Refresh content status from the platform
   * This would typically connect to the platform's API
   * @param {string} contentId - Content ID
   * @param {string} platform - Platform to refresh from
   * @private
   */
  async _refreshContentStatus(contentId, platform) {
    this.logger.debug('Refreshing content status', { contentId, platform });
    
    // This is a placeholder. In a real implementation, this would:
    // 1. Connect to the platform's API
    // 2. Fetch current status and metrics
    // 3. Update the database
    
    // For now, we'll just update the last_updated timestamp
    try {
      await this.storage.collections.content_status.updateOne(
        { 
          content_id: this.storage.ObjectId(contentId),
          platform 
        },
        { 
          $set: { 
            last_updated: new Date()
          } 
        }
      );
      
      // Clear cache for this content/platform
      const cacheKey = `${contentId}:${platform}`;
      this.contentStatusCache.delete(cacheKey);
      
      this.logger.debug('Content status refreshed', { contentId, platform });
    } catch (error) {
      this.logger.error('Error refreshing content status:', error);
    }
  }
}

module.exports = ContentTracker;