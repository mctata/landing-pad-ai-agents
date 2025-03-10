/**
 * Reporting Module for Optimisation Agent
 * Generates comprehensive performance reports and insights
 */

const BaseModule = require('../../../common/models/base-module');

class Reporting extends BaseModule {
  constructor(config, storage, logger) {
    super(config, storage, logger);
    this.name = 'reporting';
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing reporting module');
    
    // Create collection for reports if it doesn't exist
    if (!this.storage.collections.content_reports) {
      await this.storage.db.createCollection('content_reports');
      this.storage.collections.content_reports = this.storage.db.collection('content_reports');
      
      // Create indexes
      await this.storage.collections.content_reports.createIndex({ report_date: -1 });
      await this.storage.collections.content_reports.createIndex({ timeframe: 1, report_date: -1 });
    }
    
    this.logger.info('Reporting module initialized');
  }

  /**
   * Generate performance report for content
   * 
   * @param {string} timeframe - Timeframe for report (day, week, month, etc.)
   * @param {Array<string>} contentTypes - Content types to include in report
   * @param {number} limit - Maximum number of content items to include
   * @returns {Object} Generated report
   */
  async generateReport(timeframe = 'week', contentTypes = [], limit = 10) {
    this.logger.info('Generating performance report', { 
      timeframe, 
      contentTypes,
      limit 
    });
    
    // Get start date based on timeframe
    const startDate = this._getStartDateForTimeframe(timeframe);
    
    // Get performance data for period
    const performanceData = await this._getPerformanceData(startDate, contentTypes, limit);
    
    // Generate report structure
    const report = {
      report_id: this._generateReportId(),
      report_date: new Date(),
      timeframe,
      content_types: contentTypes.length > 0 ? contentTypes : ['all'],
      start_date: startDate,
      end_date: new Date(),
      summary: await this._generateReportSummary(performanceData, timeframe),
      top_performers: this._identifyTopPerformers(performanceData),
      items: performanceData,
      insights: await this._generateReportInsights(performanceData, timeframe)
    };
    
    // Save report to database
    const result = await this.storage.collections.content_reports.insertOne(report);
    
    this.logger.info('Performance report generated successfully', { 
      reportId: report.report_id,
      itemCount: performanceData.length
    });
    
    return report;
  }

  /**
   * Get the most recent report for a specified timeframe
   * 
   * @param {string} timeframe - Timeframe for report
   * @returns {Object} Most recent report
   */
  async getLatestReport(timeframe = 'week') {
    this.logger.info('Getting latest report', { timeframe });
    
    const report = await this.storage.collections.content_reports
      .find({ timeframe })
      .sort({ report_date: -1 })
      .limit(1)
      .toArray();
    
    if (report.length === 0) {
      return null;
    }
    
    return report[0];
  }

  /**
   * Compare metrics between two timeframes
   * 
   * @param {string} timeframe1 - First timeframe (e.g., 'current_week')
   * @param {string} timeframe2 - Second timeframe (e.g., 'previous_week')
   * @returns {Object} Comparison report
   */
  async compareTimeframes(timeframe1, timeframe2) {
    this.logger.info('Comparing timeframes', { timeframe1, timeframe2 });
    
    // Get reports for both timeframes
    const report1 = await this.getLatestReport(timeframe1);
    const report2 = await this.getLatestReport(timeframe2);
    
    if (!report1 || !report2) {
      throw new Error('Reports not available for comparison');
    }
    
    // Generate comparison data
    const comparison = {
      comparison_id: this._generateReportId('comparison'),
      comparison_date: new Date(),
      timeframe1,
      timeframe2,
      report1_id: report1.report_id,
      report2_id: report2.report_id,
      metrics_comparison: this._compareMetrics(report1, report2),
      insights: this._generateComparisonInsights(report1, report2)
    };
    
    this.logger.info('Timeframe comparison generated successfully');
    
    return comparison;
  }

  /**
   * Generate a report with recommendations for content optimization
   * 
   * @param {string} contentId - Content ID to generate recommendations for
   * @returns {Object} Optimization recommendations
   */
  async generateOptimizationRecommendations(contentId) {
    this.logger.info('Generating optimization recommendations', { contentId });
    
    // Get content item
    const contentItem = await this.storage.collections.content_items.findOne({
      _id: this.storage.ObjectId(contentId)
    });
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get latest performance data
    const metrics = await this._getContentPerformanceMetrics(contentId, 'month');
    
    if (!metrics) {
      throw new Error('No performance data available for content');
    }
    
    // Generate SEO recommendations
    const seoRecommendations = await this._getSeoRecommendations(contentId);
    
    // Generate A/B testing recommendations
    const abRecommendations = await this._getAbTestingRecommendations(contentId);
    
    // Generate content improvement recommendations
    const contentRecommendations = await this._getContentImprovementRecommendations(
      contentItem,
      metrics
    );
    
    // Combine all recommendations
    const recommendations = {
      content_id: contentId,
      generated_at: new Date(),
      performance_metrics: metrics,
      seo_recommendations: seoRecommendations,
      ab_testing_recommendations: abRecommendations,
      content_improvement_recommendations: contentRecommendations
    };
    
    this.logger.info('Optimization recommendations generated successfully', { contentId });
    
    return recommendations;
  }

  /**
   * Get performance data for timeframe
   * @private
   */
  async _getPerformanceData(startDate, contentTypes, limit) {
    // Build query for performance metrics
    const query = {
      timestamp: { $gte: startDate }
    };
    
    // Get content items matching the query
    const contentItems = await this.storage.collections.content_items
      .find(contentTypes.length > 0 ? { type: { $in: contentTypes } } : {})
      .limit(limit * 3) // Get more than needed to filter later
      .toArray();
    
    // Get content IDs
    const contentIds = contentItems.map(item => item._id);
    
    // Get performance metrics for these content items
    const metricsQuery = {
      content_id: { $in: contentIds },
      timestamp: { $gte: startDate }
    };
    
    const metricsRecords = await this.storage.collections.performance_metrics
      .find(metricsQuery)
      .toArray();
    
    // Group metrics by content ID
    const metricsByContent = {};
    
    for (const record of metricsRecords) {
      const contentId = record.content_id.toString();
      
      if (!metricsByContent[contentId]) {
        metricsByContent[contentId] = [];
      }
      
      metricsByContent[contentId].push(record);
    }
    
    // Combine content data with metrics
    const combinedData = [];
    
    for (const contentItem of contentItems) {
      const contentId = contentItem._id.toString();
      const metrics = metricsByContent[contentId] || [];
      
      if (metrics.length > 0) {
        // Aggregate metrics
        const aggregatedMetrics = this._aggregateMetricsRecords(metrics);
        
        combinedData.push({
          content_id: contentId,
          title: contentItem.title,
          type: contentItem.type,
          created_at: contentItem.created_at,
          metrics: aggregatedMetrics
        });
      }
    }
    
    // Sort by views (or other important metric) and limit
    return combinedData
      .sort((a, b) => (b.metrics.views || 0) - (a.metrics.views || 0))
      .slice(0, limit);
  }

  /**
   * Generate summary for report
   * @private
   */
  async _generateReportSummary(performanceData, timeframe) {
    // Calculate total metrics
    const totals = {
      views: 0,
      engagement_rate: 0,
      conversion_rate: 0,
      social_shares: 0
    };
    
    let itemsWithViews = 0;
    let itemsWithEngagement = 0;
    let itemsWithConversion = 0;
    let itemsWithShares = 0;
    
    for (const item of performanceData) {
      const metrics = item.metrics;
      
      if (metrics.views) {
        totals.views += metrics.views;
        itemsWithViews++;
      }
      
      if (metrics.engagement_rate) {
        totals.engagement_rate += metrics.engagement_rate;
        itemsWithEngagement++;
      }
      
      if (metrics.conversion_rate) {
        totals.conversion_rate += metrics.conversion_rate;
        itemsWithConversion++;
      }
      
      if (metrics.social_shares) {
        totals.social_shares += metrics.social_shares;
        itemsWithShares++;
      }
    }
    
    // Calculate averages
    const averages = {
      views: itemsWithViews > 0 ? totals.views / itemsWithViews : 0,
      engagement_rate: itemsWithEngagement > 0 ? totals.engagement_rate / itemsWithEngagement : 0,
      conversion_rate: itemsWithConversion > 0 ? totals.conversion_rate / itemsWithConversion : 0,
      social_shares: itemsWithShares > 0 ? totals.social_shares / itemsWithShares : 0
    };
    
    // Generate summary text
    const timeframeText = this._getTimeframeText(timeframe);
    
    return {
      total_items: performanceData.length,
      total_views: totals.views,
      avg_engagement_rate: averages.engagement_rate,
      avg_conversion_rate: averages.conversion_rate,
      total_social_shares: totals.social_shares,
      text: `This report covers ${performanceData.length} content items from the ${timeframeText}. These items received a total of ${totals.views} views with an average engagement rate of ${(averages.engagement_rate * 100).toFixed(1)}% and conversion rate of ${(averages.conversion_rate * 100).toFixed(1)}%. Content was shared ${totals.social_shares} times across social platforms.`
    };
  }

  /**
   * Get timeframe text for report
   * @private
   */
  _getTimeframeText(timeframe) {
    switch (timeframe.toLowerCase()) {
      case 'day': return 'past day';
      case 'week': return 'past week';
      case 'month': return 'past month';
      case 'quarter': return 'past quarter';
      case 'year': return 'past year';
      default: return timeframe;
    }
  }

  /**
   * Generate report ID with prefix
   * @private
   */
  _generateReportId(prefix = 'report') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get content performance metrics
   * @private
   */
  async _getContentPerformanceMetrics(contentId, timeframe) {
    const startDate = this._getStartDateForTimeframe(timeframe);
    
    const metrics = await this.storage.collections.performance_metrics
      .find({
        content_id: this.storage.ObjectId(contentId),
        timestamp: { $gte: startDate }
      })
      .toArray();
    
    if (metrics.length === 0) {
      return null;
    }
    
    return this._aggregateMetricsRecords(metrics);
  }

  /**
   * Get SEO recommendations for content
   * @private
   */
  async _getSeoRecommendations(contentId) {
    const latestRecommendations = await this.storage.collections.seo_recommendations
      .find({ content_id: this.storage.ObjectId(contentId) })
      .sort({ generated_at: -1 })
      .limit(1)
      .toArray();
    
    if (latestRecommendations.length === 0) {
      return [];
    }
    
    return latestRecommendations[0].recommendations || [];
  }

  /**
   * Get A/B testing recommendations for content
   * @private
   */
  async _getAbTestingRecommendations(contentId) {
    const latestSuggestions = await this.storage.collections.ab_testing_suggestions
      .find({ content_id: this.storage.ObjectId(contentId) })
      .sort({ generated_at: -1 })
      .limit(1)
      .toArray();
    
    if (latestSuggestions.length === 0) {
      return {};
    }
    
    return latestSuggestions[0].suggestions || {};
  }

  /**
   * Generate content improvement recommendations
   * @private
   */
  async _getContentImprovementRecommendations(contentItem, metrics) {
    const recommendations = [];
    
    // Add recommendations based on metrics
    if (metrics.bounce_rate && metrics.bounce_rate > 0.7) {
      recommendations.push({
        type: 'high_bounce_rate',
        recommendation: 'Reduce bounce rate by improving content engagement',
        actions: [
          'Add a compelling introduction that hooks readers',
          'Break content into smaller, more digestible sections',
          'Include visual elements to enhance engagement',
          'Add clear CTAs throughout the content'
        ]
      });
    }
    
    if (metrics.avg_time_on_page && metrics.avg_time_on_page < 60) {
      recommendations.push({
        type: 'low_time_on_page',
        recommendation: 'Increase time on page by enhancing content depth',
        actions: [
          'Add more detailed information or examples',
          'Include relevant case studies or data points',
          'Embed related multimedia content (videos, infographics)',
          'Create interactive elements to increase engagement'
        ]
      });
    }
    
    if (metrics.social_shares && metrics.social_shares < 10) {
      recommendations.push({
        type: 'low_social_shares',
        recommendation: 'Improve content shareability',
        actions: [
          'Add compelling visual elements designed for social sharing',
          'Include share-worthy statistics or quotes',
          'Create content sections that stand alone as valuable snippets',
          'Add clear social sharing buttons or calls-to-action'
        ]
      });
    }
    
    // Add general content improvement recommendations
    recommendations.push({
      type: 'general_improvement',
      recommendation: 'Enhance overall content quality and relevance',
      actions: [
        'Update content with latest information and statistics',
        'Add more specific examples of Landing Pad Digital\'s AI website builder capabilities',
        'Improve formatting for better readability',
        'Include customer testimonials or success stories'
      ]
    });
    
    // Always include an AI website builder focus recommendation
    recommendations.push({
      type: 'ai_feature_focus',
      recommendation: 'Highlight Landing Pad Digital\'s AI website builder features more prominently',
      actions: [
        'Feature at least 3 specific AI capabilities in prominent sections',
        'Add comparison with traditional website builders',
        'Include specific benefits that come from AI-powered features',
        'Add visuals showcasing the AI interface in action'
      ]
    });
    
    return recommendations;
  }

  /**
   * Aggregate metrics from multiple records
   * @private
   */
  _aggregateMetricsRecords(records) {
    if (!records || records.length === 0) return {};
    
    const aggregated = {};
    const counts = {};
    
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
    
    // Average for rate metrics
    const rateMetrics = ['engagement_rate', 'conversion_rate', 'bounce_rate'];
    
    for (const metric of rateMetrics) {
      if (aggregated[metric] !== undefined && counts[metric] > 0) {
        aggregated[metric] = aggregated[metric] / counts[metric];
      }
    }
    
    return aggregated;
  }

  /**
   * Get start date for timeframe
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

module.exports = Reporting;