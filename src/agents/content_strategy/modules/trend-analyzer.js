/**
 * Trend Analyzer Module for Content Strategy Agent
 * Analyzes current trends and provides insights for content topics
 */

class TrendAnalyzer {
  constructor(config, storage, logger) {
    this.config = config;
    this.storage = storage;
    this.logger = logger;
    this.analyticsService = null;
    this.seoService = null;
    this.socialService = null;
  }

  async initialize() {
    this.logger.info('Initializing trend analyzer module');
    
    // Initialize connections to external services
    // In a real implementation, these would be external service clients
    this.analyticsService = {
      getTrendData: async () => {
        // Mock implementation
        return {
          top_queries: [
            'ai website builder',
            'landing page optimization',
            'website templates for small business',
            'how to build website without coding',
            'responsive design best practices'
          ],
          rising_topics: [
            'voice search optimization',
            'mobile-first indexing',
            'AI content creation',
            'website speed optimization',
            'accessibility compliance'
          ]
        };
      }
    };
    
    this.seoService = {
      getKeywordData: async (keyword) => {
        // Mock implementation
        return {
          search_volume: Math.floor(Math.random() * 10000),
          competition: Math.random().toFixed(2),
          cpc: (Math.random() * 5).toFixed(2),
          seasonal_trends: [
            { month: 'Jan', volume: Math.floor(Math.random() * 100) },
            { month: 'Feb', volume: Math.floor(Math.random() * 100) },
            { month: 'Mar', volume: Math.floor(Math.random() * 100) },
            { month: 'Apr', volume: Math.floor(Math.random() * 100) },
            { month: 'May', volume: Math.floor(Math.random() * 100) },
            { month: 'Jun', volume: Math.floor(Math.random() * 100) },
            { month: 'Jul', volume: Math.floor(Math.random() * 100) },
            { month: 'Aug', volume: Math.floor(Math.random() * 100) },
            { month: 'Sep', volume: Math.floor(Math.random() * 100) },
            { month: 'Oct', volume: Math.floor(Math.random() * 100) },
            { month: 'Nov', volume: Math.floor(Math.random() * 100) },
            { month: 'Dec', volume: Math.floor(Math.random() * 100) }
          ]
        };
      }
    };
    
    this.socialService = {
      getTrendingTopics: async () => {
        // Mock implementation
        return [
          { topic: 'AI website templates', volume: 8500, platform: 'twitter' },
          { topic: 'No-code development', volume: 7200, platform: 'linkedin' },
          { topic: 'Website performance tips', volume: 6300, platform: 'facebook' },
          { topic: 'Mobile-friendly design', volume: 5100, platform: 'instagram' },
          { topic: 'E-commerce optimization', volume: 4700, platform: 'twitter' }
        ];
      }
    };
    
    // Create collection for trend data if it doesn't exist
    if (!this.storage.collections.trend_data) {
      await this.storage.db.createCollection('trend_data');
      this.storage.collections.trend_data = this.storage.db.collection('trend_data');
      
      // Create indexes
      await this.storage.collections.trend_data.createIndex({ topic: 1 });
      await this.storage.collections.trend_data.createIndex({ created_at: 1 });
    }
    
    this.logger.info('Trend analyzer module initialized');
  }

  async start() {
    this.logger.info('Starting trend analyzer module');
    
    // Schedule periodic trend analysis
    this.refreshInterval = setInterval(
      () => this.refreshTrendData(),
      this.config.refresh_interval * 1000
    );
    
    // Run initial refresh
    await this.refreshTrendData();
    
    this.logger.info('Trend analyzer module started');
  }

  async stop() {
    this.logger.info('Stopping trend analyzer module');
    
    // Clear refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    this.logger.info('Trend analyzer module stopped');
  }

  /**
   * Refresh trend data from all sources
   */
  async refreshTrendData() {
    try {
      this.logger.info('Refreshing trend data');
      
      // Get data from multiple sources
      const analyticsData = await this.analyticsService.getTrendData();
      const socialData = await this.socialService.getTrendingTopics();
      
      // Combine data and calculate overall scores
      const trendData = {
        analytics: analyticsData,
        social: socialData,
        timestamp: new Date(),
        combined_topics: this._combineTrendSources(analyticsData, socialData)
      };
      
      // Store the trend data
      await this.storage.collections.trend_data.insertOne({
        ...trendData,
        created_at: new Date()
      });
      
      // Clean up old data based on retention policy
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.data_retention_days);
      
      await this.storage.collections.trend_data.deleteMany({
        created_at: { $lt: retentionDate }
      });
      
      this.logger.info('Trend data refreshed successfully');
    } catch (error) {
      this.logger.error('Error refreshing trend data:', error);
    }
  }

  /**
   * Analyze trends for a specific topic
   * 
   * @param {string} topic - Main topic to analyze
   * @param {Array<string>} keywords - Additional keywords to include
   * @param {string} timeframe - Time period for analysis (e.g., '7d', '30d', '90d')
   * @returns {Object} Trend analysis results
   */
  async analyzeTrend(topic, keywords = [], timeframe = '30d') {
    this.logger.info('Analyzing trend', { topic, keywords, timeframe });
    
    // Convert timeframe to days
    const days = this._timeframeToDays(timeframe);
    
    // Get latest trend data
    const latestTrend = await this.storage.collections.trend_data
      .find()
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    // If no trend data available, refresh and try again
    if (!latestTrend || latestTrend.length === 0) {
      await this.refreshTrendData();
      return this.analyzeTrend(topic, keywords, timeframe);
    }
    
    // Get keyword data for the main topic and additional keywords
    const allKeywords = [topic, ...(keywords || [])];
    const keywordData = {};
    
    for (const keyword of allKeywords) {
      keywordData[keyword] = await this.seoService.getKeywordData(keyword);
    }
    
    // Find related topics from our trend data
    const relatedTopics = this._findRelatedTopics(topic, latestTrend[0].combined_topics);
    
    // Create insights based on the data
    const insights = this._generateInsights(topic, keywordData, relatedTopics, days);
    
    // Return comprehensive analysis
    return {
      topic,
      keywords: keywordData,
      related_topics: relatedTopics,
      timeframe: { days, label: timeframe },
      insights,
      summary: insights.summary,
      updated_at: new Date()
    };
  }

  /**
   * Get trending topics for a date range
   * 
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} List of trending topics
   */
  async getTrendingTopics(startDate, endDate) {
    this.logger.info('Getting trending topics', { startDate, endDate });
    
    // Get latest trend data
    const latestTrend = await this.storage.collections.trend_data
      .find()
      .sort({ created_at: -1 })
      .limit(1)
      .toArray();
    
    // If no trend data available, refresh and try again
    if (!latestTrend || latestTrend.length === 0) {
      await this.refreshTrendData();
      return this.getTrendingTopics(startDate, endDate);
    }
    
    // Return combined topics from latest trend data
    return latestTrend[0].combined_topics;
  }

  /**
   * Combines trend data from different sources into a unified list
   * @private
   */
  _combineTrendSources(analyticsData, socialData) {
    const topicScores = new Map();
    
    // Process analytics data
    if (analyticsData.top_queries) {
      analyticsData.top_queries.forEach((query, index) => {
        const score = 10 - index * 0.5; // Higher score for higher-ranked queries
        topicScores.set(query.toLowerCase(), (topicScores.get(query.toLowerCase()) || 0) + score);
      });
    }
    
    if (analyticsData.rising_topics) {
      analyticsData.rising_topics.forEach((topic, index) => {
        const score = 8 - index * 0.4; // Slightly lower score than top queries
        topicScores.set(topic.toLowerCase(), (topicScores.get(topic.toLowerCase()) || 0) + score);
      });
    }
    
    // Process social data
    if (socialData) {
      socialData.forEach(item => {
        const normalizedVolume = item.volume / 1000; // Normalize volume
        topicScores.set(
          item.topic.toLowerCase(), 
          (topicScores.get(item.topic.toLowerCase()) || 0) + normalizedVolume
        );
      });
    }
    
    // Convert to array and sort by score
    const combinedTopics = Array.from(topicScores.entries())
      .map(([topic, score]) => ({ topic, score }))
      .sort((a, b) => b.score - a.score);
    
    return combinedTopics;
  }

  /**
   * Find topics related to the main topic
   * @private
   */
  _findRelatedTopics(mainTopic, combinedTopics) {
    const words = mainTopic.toLowerCase().split(/\s+/);
    
    // Find topics that contain any of the words in the main topic
    return combinedTopics.filter(item => {
      const topicLower = item.topic.toLowerCase();
      return words.some(word => topicLower.includes(word));
    });
  }

  /**
   * Generate insights based on trend data
   * @private
   */
  _generateInsights(topic, keywordData, relatedTopics, days) {
    // Extract main topic data
    const mainTopicData = keywordData[topic];
    
    // Calculate average search volume
    const avgVolume = Object.values(keywordData)
      .reduce((sum, data) => sum + data.search_volume, 0) / Object.keys(keywordData).length;
    
    // Determine competition level
    const competitionLevel = mainTopicData.competition < 0.3 ? 'Low' :
      mainTopicData.competition < 0.7 ? 'Medium' : 'High';
    
    // Calculate seasonal trend
    const currentMonth = new Date().getMonth();
    const nextThreeMonths = [
      currentMonth,
      (currentMonth + 1) % 12,
      (currentMonth + 2) % 12
    ];
    
    const seasonalTrend = nextThreeMonths.map(month => {
      const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month];
      return mainTopicData.seasonal_trends.find(item => item.month === monthName);
    });
    
    const seasonalDirection = seasonalTrend[2].volume > seasonalTrend[0].volume ? 'upward' : 'downward';
    
    // Generate insight summary
    const summary = `"${topic}" has ${mainTopicData.search_volume.toLocaleString()} monthly searches with ${competitionLevel.toLowerCase()} competition. Found ${relatedTopics.length} related trending topics with an average search volume of ${Math.round(avgVolume).toLocaleString()}. Seasonal trend shows a ${seasonalDirection} trajectory over the next 3 months.`;
    
    return {
      volume_metrics: {
        main_topic_volume: mainTopicData.search_volume,
        average_related_volume: avgVolume,
        volume_comparison: mainTopicData.search_volume / avgVolume
      },
      competition: {
        level: competitionLevel,
        value: mainTopicData.competition,
        cpc: mainTopicData.cpc
      },
      seasonal_trend: {
        current_volume: seasonalTrend[0].volume,
        next_month_volume: seasonalTrend[1].volume,
        in_two_months_volume: seasonalTrend[2].volume,
        direction: seasonalDirection
      },
      timeframe_analyzed: days,
      related_topics_count: relatedTopics.length,
      summary
    };
  }

  /**
   * Convert timeframe string to days
   * @private
   */
  _timeframeToDays(timeframe) {
    const match = timeframe.match(/^(\d+)([dwmy])$/);
    if (!match) {
      return 30; // Default to 30 days
    }
    
    const [, value, unit] = match;
    const numValue = parseInt(value, 10);
    
    switch (unit) {
      case 'd': return numValue;
      case 'w': return numValue * 7;
      case 'm': return numValue * 30;
      case 'y': return numValue * 365;
      default: return 30;
    }
  }
}

module.exports = TrendAnalyzer;