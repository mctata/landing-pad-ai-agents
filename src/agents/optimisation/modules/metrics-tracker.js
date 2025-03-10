/**
 * Metrics Tracker Module for Optimisation Agent
 * Tracks and stores content performance metrics
 */

const BaseModule = require('../../../common/models/base-module');

class MetricsTracker extends BaseModule {
  constructor(config, storage, logger) {
    super(config, storage, logger);
    this.name = 'metrics_tracker';
    
    // Define valid metrics and their validation rules
    this.validMetrics = {
      views: { type: 'number', min: 0 },
      unique_views: { type: 'number', min: 0 },
      clicks: { type: 'number', min: 0 },
      engagement_rate: { type: 'number', min: 0, max: 1 },
      conversion_rate: { type: 'number', min: 0, max: 1 },
      bounce_rate: { type: 'number', min: 0, max: 1 },
      avg_time_on_page: { type: 'number', min: 0 },
      social_shares: { type: 'number', min: 0 },
      comments: { type: 'number', min: 0 },
      likes: { type: 'number', min: 0 },
      backlinks: { type: 'number', min: 0 }
    };
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing metrics tracker module');
    
    // Create collection for performance metrics if it doesn't exist
    if (!this.storage.collections.performance_metrics) {
      await this.storage.db.createCollection('performance_metrics');
      this.storage.collections.performance_metrics = this.storage.db.collection('performance_metrics');
      
      // Create indexes
      await this.storage.collections.performance_metrics.createIndex({ content_id: 1 });
      await this.storage.collections.performance_metrics.createIndex({ timestamp: -1 });
      await this.storage.collections.performance_metrics.createIndex({ content_id: 1, timestamp: -1 });
    }
    
    this.logger.info('Metrics tracker module initialized');
  }

  /**
   * Track content metrics
   * 
   * @param {string} contentId - ID of the content to track metrics for
   * @param {Object} metrics - Metrics to track
   * @returns {Object} Tracking result
   */
  async trackMetrics(contentId, metrics) {
    this.logger.info('Tracking metrics for content', { 
      contentId, 
      metricKeys: Object.keys(metrics) 
    });
    
    // Validate content ID
    if (!contentId) {
      throw new Error('Content ID is required');
    }
    
    // Validate metrics
    const validatedMetrics = this._validateMetrics(metrics);
    
    // Create metrics record
    const metricsRecord = {
      content_id: this.storage.ObjectId(contentId),
      timestamp: new Date(),
      ...validatedMetrics
    };
    
    // Store metrics in database
    const result = await this.storage.collections.performance_metrics.insertOne(metricsRecord);
    
    this.logger.info('Metrics tracked successfully', { 
      contentId, 
      recordId: result.insertedId 
    });
    
    // Return success result
    return {
      metrics_id: result.insertedId,
      content_id: contentId,
      metrics: validatedMetrics,
      timestamp: metricsRecord.timestamp
    };
  }

  /**
   * Get latest metrics for content
   * 
   * @param {string} contentId - Content ID to get metrics for
   * @returns {Object} Latest metrics
   */
  async getLatestMetrics(contentId) {
    this.logger.info('Getting latest metrics for content', { contentId });
    
    const result = await this.storage.collections.performance_metrics
      .find({ content_id: this.storage.ObjectId(contentId) })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    
    if (result.length === 0) {
      return null;
    }
    
    const { _id, content_id, timestamp, ...metrics } = result[0];
    
    return {
      metrics_id: _id,
      content_id: content_id.toString(),
      timestamp,
      metrics
    };
  }

  /**
   * Get historical metrics for content
   * 
   * @param {string} contentId - Content ID to get metrics for
   * @param {Object} options - Query options
   * @param {Date} options.startDate - Start date for metrics
   * @param {Date} options.endDate - End date for metrics
   * @param {number} options.limit - Maximum number of records to return
   * @returns {Array} Historical metrics
   */
  async getHistoricalMetrics(contentId, options = {}) {
    const { startDate, endDate, limit = 100 } = options;
    
    this.logger.info('Getting historical metrics for content', { 
      contentId, 
      startDate, 
      endDate, 
      limit 
    });
    
    const query = { content_id: this.storage.ObjectId(contentId) };
    
    // Add date range if provided
    if (startDate || endDate) {
      query.timestamp = {};
      
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }
    
    const results = await this.storage.collections.performance_metrics
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return results.map(record => {
      const { _id, content_id, timestamp, ...metrics } = record;
      
      return {
        metrics_id: _id,
        content_id: content_id.toString(),
        timestamp,
        metrics
      };
    });
  }

  /**
   * Calculate aggregated metrics for a time period
   * 
   * @param {string} contentId - Content ID to aggregate metrics for
   * @param {string} timeframe - Timeframe to aggregate (day, week, month, etc.)
   * @returns {Object} Aggregated metrics
   */
  async getAggregatedMetrics(contentId, timeframe = 'week') {
    this.logger.info('Getting aggregated metrics for content', { 
      contentId, 
      timeframe 
    });
    
    const startDate = this._getStartDateForTimeframe(timeframe);
    
    const query = { 
      content_id: this.storage.ObjectId(contentId),
      timestamp: { $gte: startDate }
    };
    
    const records = await this.storage.collections.performance_metrics
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
    
    if (records.length === 0) {
      return null;
    }
    
    // Aggregate metrics
    const aggregatedMetrics = this._aggregateMetricsRecords(records);
    
    return {
      content_id: contentId,
      timeframe,
      start_date: startDate,
      end_date: new Date(),
      metrics: aggregatedMetrics,
      record_count: records.length
    };
  }

  /**
   * Batch track metrics for multiple content items
   * 
   * @param {Array} batchMetrics - Array of {contentId, metrics} objects
   * @returns {Object} Batch tracking result
   */
  async batchTrackMetrics(batchMetrics) {
    this.logger.info('Batch tracking metrics', { 
      count: batchMetrics.length 
    });
    
    const metricsRecords = [];
    const errors = [];
    
    // Process each item in batch
    for (const item of batchMetrics) {
      try {
        const { contentId, metrics } = item;
        
        // Validate content ID
        if (!contentId) {
          errors.push({ contentId, error: 'Content ID is required' });
          continue;
        }
        
        // Validate metrics
        const validatedMetrics = this._validateMetrics(metrics);
        
        // Create metrics record
        metricsRecords.push({
          content_id: this.storage.ObjectId(contentId),
          timestamp: new Date(),
          ...validatedMetrics
        });
      } catch (error) {
        errors.push({ contentId: item.contentId, error: error.message });
      }
    }
    
    // Insert all valid records in a single batch operation
    if (metricsRecords.length > 0) {
      const result = await this.storage.collections.performance_metrics.insertMany(metricsRecords);
      
      this.logger.info('Batch metrics tracked successfully', { 
        inserted: result.insertedCount,
        errors: errors.length
      });
      
      return {
        success: true,
        inserted_count: result.insertedCount,
        error_count: errors.length,
        errors: errors.length > 0 ? errors : undefined
      };
    } else {
      this.logger.warn('No valid metrics to track in batch');
      
      return {
        success: false,
        inserted_count: 0,
        error_count: errors.length,
        errors
      };
    }
  }

  /**
   * Validate metrics object against rules
   * @private
   */
  _validateMetrics(metrics) {
    if (!metrics || typeof metrics !== 'object') {
      throw new Error('Metrics must be an object');
    }
    
    const validatedMetrics = {};
    
    // Validate each metric against defined rules
    for (const [key, value] of Object.entries(metrics)) {
      // Check if metric is valid
      if (!this.validMetrics[key]) {
        this.logger.warn(`Ignoring unknown metric: ${key}`);
        continue;
      }
      
      const rules = this.validMetrics[key];
      
      // Type validation
      if (rules.type === 'number' && typeof value !== 'number') {
        throw new Error(`Metric ${key} must be a number`);
      }
      
      // Range validation for numbers
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          throw new Error(`Metric ${key} must be at least ${rules.min}`);
        }
        
        if (rules.max !== undefined && value > rules.max) {
          throw new Error(`Metric ${key} must be at most ${rules.max}`);
        }
      }
      
      // Add validated metric
      validatedMetrics[key] = value;
    }
    
    return validatedMetrics;
  }

  /**
   * Aggregate metrics from multiple records
   * @private
   */
  _aggregateMetricsRecords(records) {
    if (records.length === 0) return {};
    
    const aggregated = {};
    const counts = {};
    
    // Cumulative metrics (sum)
    const cumulativeMetrics = ['views', 'unique_views', 'clicks', 'social_shares', 'comments', 'likes', 'backlinks'];
    
    // Rate metrics (average)
    const rateMetrics = ['engagement_rate', 'conversion_rate', 'bounce_rate', 'avg_time_on_page'];
    
    // Process each record
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        // Skip non-metric fields
        if (['_id', 'content_id', 'timestamp'].includes(key)) continue;
        
        // Initialize if needed
        if (aggregated[key] === undefined) {
          aggregated[key] = 0;
          counts[key] = 0;
        }
        
        // Add value
        if (typeof value === 'number') {
          aggregated[key] += value;
          counts[key]++;
        }
      }
    }
    
    // Post-process metrics based on their type
    for (const metric of rateMetrics) {
      if (aggregated[metric] !== undefined && counts[metric] > 0) {
        // Calculate average for rate metrics
        aggregated[metric] = aggregated[metric] / counts[metric];
      }
    }
    
    // For cumulative metrics like views, we may want to use the latest value instead
    // This depends on whether the metrics are incremental or absolute
    // Here we assume they are absolute, so we use the sum across all records
    
    return aggregated;
  }

  /**
   * Get start date based on timeframe
   * @private
   */
  _getStartDateForTimeframe(timeframe) {
    const now = new Date();
    
    switch (timeframe.toLowerCase()) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'quarter':
        return new Date(now.setMonth(now.getMonth() - 3));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setDate(now.getDate() - 7)); // Default to week
    }
  }
}

module.exports = MetricsTracker;