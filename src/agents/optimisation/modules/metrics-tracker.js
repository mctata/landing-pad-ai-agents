/**
 * Metrics Tracker Module for Optimisation Agent
 * Tracks and stores content performance metrics
 */

const BaseModule = require('../../../common/models/base-module');

class MetricsTracker extends BaseModule {
  constructor(config, storage, logger) {
    super(config, storage, logger);
    this.name = 'metrics_tracker';
    
    // Define standard metrics for validation
    this.standardMetrics = [
      'views', 
      'unique_views', 
      'clicks',
      'conversions',
      'bounce_rate',
      'avg_time_on_page',
      'scroll_depth',
      'engagement_rate',
      'conversion_rate',
      'social_shares',
      'comments',
      'likes',
      'backlinks'
    ];
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing metrics tracker module');
    
    // Create performance metrics collection if it doesn't exist
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
   * Track metrics for content
   * 
   * @param {string} contentId - ID of the content
   * @param {Object} metrics - Metrics to track
   * @returns {Object} Tracking result
   */
  async trackMetrics(contentId, metrics) {
    this.logger.info('Tracking metrics for content', { contentId });
    
    // Validate content ID
    if (!contentId) {
      throw new Error('Content ID is required');
    }
    
    // Validate metrics
    const validatedMetrics = this._validateMetrics(metrics);
    
    // Prepare record
    const metricsRecord = {
      content_id: this.storage.ObjectId(contentId),
      timestamp: new Date(),
      ...validatedMetrics
    };
    
    // Store metrics
    const result = await this.storage.collections.performance_metrics.insertOne(metricsRecord);
    
    this.logger.info('Metrics tracked successfully', { 
      contentId,
      metricCount: Object.keys(validatedMetrics).length,
      recordId: result.insertedId
    });
    
    // Calculate and update derived metrics
    await this._updateDerivedMetrics(contentId);
    
    return {
      record_id: result.insertedId,
      content_id: contentId,
      metrics: validatedMetrics,
      timestamp: metricsRecord.timestamp
    };
  }

  /**
   * Get metrics for content
   * 
   * @param {string} contentId - ID of the content
   * @param {Object} options - Query options
   * @returns {Array} Metrics records
   */
  async getMetrics(contentId, options = {}) {
    const { 
      startDate = new Date(0), 
      endDate = new Date(),
      limit = 100,
      sort = 'desc'
    } = options;
    
    this.logger.info('Getting metrics for content', { 
      contentId,
      startDate,
      endDate,
      limit
    });
    
    // Build query
    const query = { 
      content_id: this.storage.ObjectId(contentId),
      timestamp: { 
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    // Execute query
    const metrics = await this.storage.collections.performance_metrics
      .find(query)
      .sort({ timestamp: sort === 'desc' ? -1 : 1 })
      .limit(limit)
      .toArray();
    
    return metrics;
  }

  /**
   * Get aggregated metrics for content
   * 
   * @param {string} contentId - ID of the content
   * @param {string} timeframe - Timeframe to aggregate by (day, week, month)
   * @returns {Array} Aggregated metrics
   */
  async getAggregatedMetrics(contentId, timeframe = 'day') {
    this.logger.info('Getting aggregated metrics for content', { 
      contentId,
      timeframe
    });
    
    // Define grouping based on timeframe
    let dateFormat;
    switch (timeframe) {
      case 'hour':
        dateFormat = { year: '$year', month: '$month', day: '$dayOfMonth', hour: '$hour' };
        break;
      case 'day':
        dateFormat = { year: '$year', month: '$month', day: '$dayOfMonth' };
        break;
      case 'week':
        dateFormat = { year: '$year', week: '$week' };
        break;
      case 'month':
        dateFormat = { year: '$year', month: '$month' };
        break;
      default:
        dateFormat = { year: '$year', month: '$month', day: '$dayOfMonth' };
    }
    
    // Aggregate metrics
    const aggregatedMetrics = await this.storage.collections.performance_metrics.aggregate([
      {
        $match: {
          content_id: this.storage.ObjectId(contentId)
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateFromParts: dateFormat
            }
          },
          views: { $sum: '$views' },
          unique_views: { $sum: '$unique_views' },
          clicks: { $sum: '$clicks' },
          conversions: { $sum: '$conversions' },
          avg_time_on_page: { $avg: '$avg_time_on_page' },
          bounce_rate: { $avg: '$bounce_rate' },
          engagement_rate: { $avg: '$engagement_rate' },
          conversion_rate: { $avg: '$conversion_rate' },
          social_shares: { $sum: '$social_shares' },
          comments: { $sum: '$comments' },
          likes: { $sum: '$likes' }
        }
      },
      {
        $sort: {
          '_id.date': 1
        }
      }
    ]).toArray();
    
    // Format results
    return aggregatedMetrics.map(item => ({
      date: item._id.date,
      metrics: {
        views: item.views || 0,
        unique_views: item.unique_views || 0,
        clicks: item.clicks || 0,
        conversions: item.conversions || 0,
        avg_time_on_page: item.avg_time_on_page || 0,
        bounce_rate: item.bounce_rate || 0,
        engagement_rate: item.engagement_rate || 0,
        conversion_rate: item.conversion_rate || 0,
        social_shares: item.social_shares || 0,
        comments: item.comments || 0,
        likes: item.likes || 0
      }
    }));
  }

  /**
   * Get comparative metrics across content types
   * 
   * @param {Array} contentTypes - Content types to compare
   * @param {string} metric - Metric to compare
   * @param {Object} options - Query options
   * @returns {Object} Comparative metrics
   */
  async getComparativeMetrics(contentTypes, metric = 'views', options = {}) {
    const {
      startDate = new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate = new Date(),
      limit = 10
    } = options;
    
    this.logger.info('Getting comparative metrics', {
      contentTypes,
      metric,
      startDate,
      endDate
    });
    
    // Get content items of specified types
    const contentItems = await this.storage.collections.content_items.find({
      type: { $in: contentTypes },
      created_at: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).toArray();
    
    // Get content IDs
    const contentIds = contentItems.map(item => item._id);
    
    // Get metrics for each content type
    const metricsByType = {};
    for (const type of contentTypes) {
      // Get content IDs for this type
      const typeContentIds = contentItems
        .filter(item => item.type === type)
        .map(item => item._id);
      
      // Skip if no content of this type
      if (typeContentIds.length === 0) {
        metricsByType[type] = {
          average: 0,
          highest: 0,
          lowest: 0,
          total: 0,
          sample_size: 0
        };
        continue;
      }
      
      // Aggregate metrics for this type
      const aggregation = await this.storage.collections.performance_metrics.aggregate([
        {
          $match: {
            content_id: { $in: typeContentIds },
            timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
          }
        },
        {
          $group: {
            _id: '$content_id',
            total: { $sum: `$${metric}` }
          }
        },
        {
          $group: {
            _id: null,
            average: { $avg: '$total' },
            highest: { $max: '$total' },
            lowest: { $min: '$total' },
            total: { $sum: '$total' },
            sample_size: { $sum: 1 }
          }
        }
      ]).toArray();
      
      metricsByType[type] = aggregation.length > 0 ? aggregation[0] : {
        average: 0,
        highest: 0,
        lowest: 0,
        total: 0,
        sample_size: 0
      };
      
      // Remove _id field
      delete metricsByType[type]._id;
    }
    
    // Get top performing content
    const topPerforming = await this.storage.collections.performance_metrics.aggregate([
      {
        $match: {
          content_id: { $in: contentIds },
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }
      },
      {
        $group: {
          _id: '$content_id',
          total: { $sum: `$${metric}` }
        }
      },
      {
        $sort: { total: -1 }
      },
      {
        $limit: limit
      }
    ]).toArray();
    
    // Get content details for top performing content
    const topContentIds = topPerforming.map(item => item._id);
    const topContentDetails = await this.storage.collections.content_items.find({
      _id: { $in: topContentIds }
    }).toArray();
    
    // Combine metrics with content details
    const topContent = topPerforming.map(item => {
      const contentDetails = topContentDetails.find(content => 
        content._id.toString() === item._id.toString()
      );
      
      return {
        content_id: item._id,
        title: contentDetails ? contentDetails.title || contentDetails.headline : 'Unknown',
        type: contentDetails ? contentDetails.type : 'Unknown',
        value: item.total
      };
    });
    
    return {
      metric,
      by_type: metricsByType,
      top_performing: topContent,
      timeframe: {
        start: startDate,
        end: endDate
      }
    };
  }

  /**
   * Validate metrics to ensure they follow expected format
   * @private
   */
  _validateMetrics(metrics) {
    const validatedMetrics = {};
    
    // Loop through provided metrics
    for (const [key, value] of Object.entries(metrics)) {
      // Check if metric is standard or custom
      const isStandard = this.standardMetrics.includes(key);
      
      // For standard metrics, validate type
      if (isStandard) {
        if (typeof value === 'number') {
          validatedMetrics[key] = value;
        } else if (typeof value === 'string' && !isNaN(parseFloat(value))) {
          // Convert numeric strings to numbers
          validatedMetrics[key] = parseFloat(value);
        } else {
          this.logger.warn(`Invalid metric value for ${key}, expected number`);
        }
      } else {
        // Allow custom metrics with prefix
        if (key.startsWith('custom_')) {
          validatedMetrics[key] = value;
        } else {
          this.logger.warn(`Non-standard metric ${key} should use 'custom_' prefix`);
          validatedMetrics[`custom_${key}`] = value;
        }
      }
    }
    
    return validatedMetrics;
  }

  /**
   * Update derived metrics based on tracked metrics
   * @private
   */
  async _updateDerivedMetrics(contentId) {
    try {
      // Get latest metrics
      const latestMetrics = await this.storage.collections.performance_metrics
        .find({ content_id: this.storage.ObjectId(contentId) })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();
        
      if (latestMetrics.length === 0) {
        return;
      }
      
      const metrics = latestMetrics[0];
      const derivedUpdates = {};
      
      // Calculate engagement rate if not provided
      if (!metrics.engagement_rate && metrics.views && 
          (metrics.avg_time_on_page || metrics.scroll_depth || metrics.comments || metrics.likes)) {
        // Simple engagement formula based on available metrics
        let engagementFactors = 0;
        let engagementSum = 0;
        
        if (metrics.avg_time_on_page) {
          engagementSum += Math.min(metrics.avg_time_on_page / 120, 1); // Normalize to max of 2 minutes
          engagementFactors++;
        }
        
        if (metrics.scroll_depth) {
          engagementSum += metrics.scroll_depth; // Assuming 0-1 range
          engagementFactors++;
        }
        
        if (metrics.comments) {
          engagementSum += Math.min(metrics.comments / metrics.views, 0.2); // Cap at 20%
          engagementFactors++;
        }
        
        if (metrics.likes) {
          engagementSum += Math.min(metrics.likes / metrics.views, 0.3); // Cap at 30%
          engagementFactors++;
        }
        
        if (engagementFactors > 0) {
          derivedUpdates.engagement_rate = engagementSum / engagementFactors;
        }
      }
      
      // Calculate conversion rate if not provided
      if (!metrics.conversion_rate && metrics.conversions && metrics.views) {
        derivedUpdates.conversion_rate = metrics.conversions / metrics.views;
      }
      
      // Apply updates if any
      if (Object.keys(derivedUpdates).length > 0) {
        await this.storage.collections.performance_metrics.updateOne(
          { _id: metrics._id },
          { $set: derivedUpdates }
        );
        
        this.logger.info('Updated derived metrics', {
          contentId,
          metrics: Object.keys(derivedUpdates)
        });
      }
    } catch (error) {
      this.logger.error('Error updating derived metrics:', error);
    }
  }
}

module.exports = MetricsTracker;