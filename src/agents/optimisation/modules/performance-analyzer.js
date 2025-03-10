/**
 * Performance Analyzer Module for Optimisation Agent
 * Analyzes content performance metrics to provide insights and recommendations
 */

const BaseModule = require('../../../common/models/base-module');

class PerformanceAnalyzer extends BaseModule {
  constructor(config, storage, logger) {
    super(config, storage, logger);
    this.name = 'performance_analyzer';
    this.metricThresholds = {
      views: { low: 100, medium: 500, high: 1000 },
      engagement_rate: { low: 0.01, medium: 0.03, high: 0.05 },
      conversion_rate: { low: 0.01, medium: 0.02, high: 0.03 },
      bounce_rate: { high: 0.8, medium: 0.6, low: 0.4 }, // Note: for bounce rate, lower is better
      avg_time_on_page: { low: 30, medium: 60, high: 120 },
      social_shares: { low: 5, medium: 20, high: 50 }
    };
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing performance analyzer module');
    
    // Create collections if they don't exist
    const collectionNames = [
      'performance_metrics',
      'performance_analyses'
    ];
    
    for (const name of collectionNames) {
      if (!this.storage.collections[name]) {
        await this.storage.db.createCollection(name);
        this.storage.collections[name] = this.storage.db.collection(name);
        
        // Create indexes
        if (name === 'performance_metrics') {
          await this.storage.collections[name].createIndex({ content_id: 1, timestamp: -1 });
        } else if (name === 'performance_analyses') {
          await this.storage.collections[name].createIndex({ content_id: 1, analysis_date: -1 });
        }
      }
    }
    
    this.logger.info('Performance analyzer module initialized');
  }

  /**
   * Analyze performance of content based on metrics
   * 
   * @param {Object} contentItem - Content item to analyze
   * @param {Object} metrics - Performance metrics
   * @param {string} timeframe - Timeframe for analysis (e.g., 'day', 'week', 'month')
   * @returns {Object} Analysis results
   */
  async analysePerformance(contentItem, metrics, timeframe = 'week') {
    this.logger.info('Analyzing content performance', { 
      contentId: contentItem ? contentItem._id : 'all',
      timeframe 
    });
    
    // If metrics provided, use them directly
    if (metrics) {
      return this._generateAnalysis(contentItem, metrics, timeframe);
    }
    
    // Otherwise, fetch metrics from database
    const startDate = this._getStartDateForTimeframe(timeframe);
    let query = { timestamp: { $gte: startDate } };
    
    // If content item provided, filter by content ID
    if (contentItem) {
      query.content_id = contentItem._id;
    }
    
    // Fetch metrics from database
    const metricsData = await this.storage.collections.performance_metrics
      .find(query)
      .toArray();
    
    // Aggregate metrics if multiple entries found
    const aggregatedMetrics = this._aggregateMetrics(metricsData);
    
    return this._generateAnalysis(contentItem, aggregatedMetrics, timeframe);
  }

  /**
   * Generate analysis based on metrics
   * @private
   */
  async _generateAnalysis(contentItem, metrics, timeframe) {
    // Evaluate metrics against thresholds
    const evaluations = this._evaluateMetrics(metrics);
    
    // Generate insights based on evaluations
    const insights = this._generateInsights(contentItem, evaluations, metrics);
    
    // Generate recommendations
    const recommendations = await this._generateRecommendations(
      contentItem,
      evaluations,
      metrics,
      insights
    );
    
    return {
      content_id: contentItem ? contentItem._id : null,
      timeframe,
      metrics,
      evaluations,
      insights,
      recommendations
    };
  }

  /**
   * Evaluate metrics against thresholds
   * @private
   */
  _evaluateMetrics(metrics) {
    const evaluations = {};
    
    for (const [metric, value] of Object.entries(metrics)) {
      if (metric in this.metricThresholds) {
        const thresholds = this.metricThresholds[metric];
        
        let evaluation;
        // Special case for bounce rate (lower is better)
        if (metric === 'bounce_rate') {
          if (value <= thresholds.low) evaluation = 'high';
          else if (value <= thresholds.medium) evaluation = 'medium';
          else evaluation = 'low';
        } else {
          if (value >= thresholds.high) evaluation = 'high';
          else if (value >= thresholds.medium) evaluation = 'medium';
          else evaluation = 'low';
        }
        
        evaluations[metric] = evaluation;
      }
    }
    
    return evaluations;
  }

  /**
   * Generate insights based on evaluations
   * @private
   */
  _generateInsights(contentItem, evaluations, metrics) {
    const insights = [];
    
    // Overall performance score (0-100)
    const scoreMap = { high: 3, medium: 2, low: 1 };
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    for (const evaluation of Object.values(evaluations)) {
      totalScore += scoreMap[evaluation] || 0;
      maxPossibleScore += 3; // Maximum score per metric
    }
    
    const overallScore = Math.round((totalScore / maxPossibleScore) * 100);
    
    insights.push({
      type: 'overall_score',
      insight: `Overall performance score: ${overallScore}/100`,
      score: overallScore
    });
    
    // Generate specific insights based on metrics
    if (metrics.views !== undefined) {
      insights.push({
        type: 'views',
        insight: `Content has received ${metrics.views} views, which is ${evaluations.views || 'moderate'}.`,
        data: { views: metrics.views, evaluation: evaluations.views }
      });
    }
    
    if (metrics.engagement_rate !== undefined) {
      insights.push({
        type: 'engagement',
        insight: `Engagement rate is ${(metrics.engagement_rate * 100).toFixed(1)}%, which is ${evaluations.engagement_rate || 'moderate'}.`,
        data: { rate: metrics.engagement_rate, evaluation: evaluations.engagement_rate }
      });
    }
    
    if (metrics.conversion_rate !== undefined) {
      insights.push({
        type: 'conversion',
        insight: `Conversion rate is ${(metrics.conversion_rate * 100).toFixed(1)}%, which is ${evaluations.conversion_rate || 'moderate'}.`,
        data: { rate: metrics.conversion_rate, evaluation: evaluations.conversion_rate }
      });
    }
    
    if (metrics.bounce_rate !== undefined) {
      insights.push({
        type: 'bounce',
        insight: `Bounce rate is ${(metrics.bounce_rate * 100).toFixed(1)}%, which is ${evaluations.bounce_rate === 'high' ? 'good' : (evaluations.bounce_rate === 'medium' ? 'acceptable' : 'concerning')}.`,
        data: { rate: metrics.bounce_rate, evaluation: evaluations.bounce_rate }
      });
    }
    
    if (metrics.avg_time_on_page !== undefined) {
      insights.push({
        type: 'time_on_page',
        insight: `Average time on page is ${metrics.avg_time_on_page} seconds, which is ${evaluations.avg_time_on_page || 'moderate'}.`,
        data: { seconds: metrics.avg_time_on_page, evaluation: evaluations.avg_time_on_page }
      });
    }
    
    // Add comparative insights if content item is provided
    if (contentItem) {
      insights.push({
        type: 'content_type',
        insight: `This ${contentItem.type || 'content'} is performing ${this._getComparativePerformance(overallScore)} compared to other content of the same type.`
      });
    }
    
    return insights;
  }

  /**
   * Generate actionable recommendations based on performance
   * @private
   */
  async _generateRecommendations(contentItem, evaluations, metrics, insights) {
    const recommendations = [];
    
    // Low views recommendations
    if (evaluations.views === 'low') {
      recommendations.push({
        type: 'improve_visibility',
        recommendation: 'Improve content visibility by sharing on more channels and optimizing for SEO.',
        priority: 'high',
        action_items: [
          'Share content on additional social media platforms',
          'Include in email newsletters',
          'Optimize meta title and description',
          'Add internal links from high-traffic pages'
        ]
      });
    }
    
    // Low engagement recommendations
    if (evaluations.engagement_rate === 'low') {
      recommendations.push({
        type: 'enhance_engagement',
        recommendation: 'Enhance content engagement by improving readability and adding interactive elements.',
        priority: 'medium',
        action_items: [
          'Break content into smaller paragraphs',
          'Add subheadings and bullet points',
          'Include relevant images or infographics',
          'Add calls-to-action throughout the content',
          'Include interactive elements like polls or quizzes'
        ]
      });
    }
    
    // High bounce rate recommendations
    if (evaluations.bounce_rate === 'low') {
      recommendations.push({
        type: 'reduce_bounce_rate',
        recommendation: 'Reduce bounce rate by improving initial engagement and page load speed.',
        priority: 'high',
        action_items: [
          'Improve page load time',
          'Ensure mobile responsiveness',
          'Make the introduction more compelling',
          'Add clear navigation options',
          'Include related content recommendations'
        ]
      });
    }
    
    // Low conversion rate recommendations
    if (evaluations.conversion_rate === 'low') {
      recommendations.push({
        type: 'improve_conversions',
        recommendation: 'Improve conversion rate by optimizing calls-to-action and value proposition.',
        priority: 'high',
        action_items: [
          'Test different call-to-action wording',
          'Make CTAs more prominent',
          'Clarify the value proposition',
          'Reduce friction in the conversion process',
          'Add testimonials or social proof'
        ]
      });
    }
    
    // Low time on page recommendations
    if (evaluations.avg_time_on_page === 'low') {
      recommendations.push({
        type: 'increase_time_on_page',
        recommendation: 'Increase time on page by enhancing content depth and readability.',
        priority: 'medium',
        action_items: [
          'Add more comprehensive information',
          'Include relevant examples and case studies',
          'Embed videos or other media',
          'Improve content formatting and readability',
          'Add internal links to related content'
        ]
      });
    }
    
    // If content is performing well overall but could be improved
    const overallScore = insights.find(i => i.type === 'overall_score')?.score || 0;
    if (overallScore >= 70 && overallScore < 90) {
      recommendations.push({
        type: 'optimize_well_performing',
        recommendation: 'Further optimize this well-performing content to maximize its impact.',
        priority: 'low',
        action_items: [
          'Update with fresh information',
          'Expand on popular sections',
          'Create spin-off content on related topics',
          'Feature it more prominently'
        ]
      });
    }
    
    // If we have very few recommendations, add a generic one
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'general_optimization',
        recommendation: 'Maintain current performance and look for opportunities to expand reach.',
        priority: 'low',
        action_items: [
          'Continue monitoring performance metrics',
          'Test small variations to improve engagement',
          'Consider creating follow-up content on the same topic',
          'Promote to additional audience segments'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Get comparative performance description
   * @private
   */
  _getComparativePerformance(score) {
    if (score >= 90) return 'exceptionally well';
    if (score >= 75) return 'very well';
    if (score >= 60) return 'well';
    if (score >= 40) return 'average';
    if (score >= 25) return 'below average';
    return 'poorly';
  }

  /**
   * Aggregate metrics from multiple entries
   * @private
   */
  _aggregateMetrics(metricsData) {
    if (!metricsData || metricsData.length === 0) {
      return {};
    }
    
    // If only one entry, return its metrics
    if (metricsData.length === 1) {
      const { content_id, timestamp, ...metrics } = metricsData[0];
      return metrics;
    }
    
    // Aggregate metrics across entries
    const aggregated = {};
    const countMap = {};
    
    for (const entry of metricsData) {
      for (const [key, value] of Object.entries(entry)) {
        // Skip non-metric fields
        if (key === 'content_id' || key === 'timestamp' || key === '_id') {
          continue;
        }
        
        if (typeof value === 'number') {
          aggregated[key] = (aggregated[key] || 0) + value;
          countMap[key] = (countMap[key] || 0) + 1;
        }
      }
    }
    
    // Calculate averages for rate metrics
    const rateMetrics = ['engagement_rate', 'conversion_rate', 'bounce_rate'];
    
    for (const metric of rateMetrics) {
      if (metric in aggregated) {
        aggregated[metric] = aggregated[metric] / countMap[metric];
      }
    }
    
    // Sum up cumulative metrics
    const sumMetrics = ['views', 'clicks', 'social_shares'];
    
    for (const metric of sumMetrics) {
      // Already summed, no need to average
      continue;
    }
    
    // Average time-based metrics
    const timeMetrics = ['avg_time_on_page'];
    
    for (const metric of timeMetrics) {
      if (metric in aggregated) {
        aggregated[metric] = aggregated[metric] / countMap[metric];
      }
    }
    
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

module.exports = PerformanceAnalyzer;