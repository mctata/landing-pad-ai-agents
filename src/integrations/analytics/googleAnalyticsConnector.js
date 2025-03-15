/**
 * Google Analytics Connector
 * Handles data retrieval from Google Analytics 4 (GA4)
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

class GoogleAnalyticsConnector {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.propertyId = config.propertyId;
    this.client = null;
    this.credentials = null;
  }

  /**
   * Initialize the Google Analytics connection
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        this.logger.info('Google Analytics integration is disabled');
        return false;
      }

      this.logger.info('Initializing Google Analytics integration');
      
      if (!this.propertyId) {
        throw new Error('Google Analytics property ID is required');
      }
      
      this.credentials = JSON.parse(Buffer.from(this.config.credentials, 'base64').toString());
      
      // Create the analytics client
      this.client = new BetaAnalyticsDataClient({
        credentials: this.credentials
      });
      
      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.logger.info('Google Analytics integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Google Analytics integration:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test the Google Analytics connection
   */
  async testConnection() {
    try {
      // Make a simple request to verify credentials and connection
      const [response] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: '7daysAgo',
            endDate: 'today',
          },
        ],
        dimensions: [
          {
            name: 'date',
          },
        ],
        metrics: [
          {
            name: 'sessions',
          },
        ],
        limit: 1
      });
      
      if (!response || !response.rows || response.rows.length === 0) {
        throw new Error('No data returned from Google Analytics');
      }
      
      this.logger.info('Google Analytics connection successful');
      return true;
    } catch (error) {
      this.logger.error('Google Analytics connection test failed:', error);
      throw error;
    }
  }

  /**
   * Get page metrics from Google Analytics
   * @param {string} pageUrl - URL of the page to get metrics for
   * @param {Object} options - Options for the query
   * @returns {Object} - Metrics data
   */
  async getPageMetrics(pageUrl, options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Google Analytics integration is not connected');
      }
      
      this.logger.info(`Getting metrics for page: ${pageUrl}`);
      
      const {
        startDate = '30daysAgo',
        endDate = 'today',
        dimensions = ['deviceCategory', 'sessionSource']
      } = options;
      
      // Format dimension objects
      const dimensionObjects = dimensions.map(dim => ({ name: dim }));
      
      // Run the report
      const [response] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          ...dimensionObjects
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'engagementRate' },
          { name: 'conversions' },
          { name: 'averageSessionDuration' }
        ],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: {
              matchType: 'EXACT',
              value: pageUrl,
            },
          },
        },
      });
      
      // Process the response into a usable format
      const metrics = this.processAnalyticsResponse(response, pageUrl);
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error getting metrics for page ${pageUrl}:`, error);
      throw error;
    }
  }

  /**
   * Process analytics response into a standardized format
   * @param {Object} response - Google Analytics API response
   * @param {string} pageUrl - The URL of the page
   * @returns {Object} - Standardized metrics object
   */
  processAnalyticsResponse(response, pageUrl) {
    if (!response || !response.rows || response.rows.length === 0) {
      return {
        url: pageUrl,
        pageViews: 0,
        uniqueUsers: 0,
        engagementRate: 0,
        conversions: 0,
        avgSessionDuration: 0,
        byDevice: {},
        bySource: {},
        retrievedAt: new Date()
      };
    }
    
    // Extract dimension and metric headers
    const dimensionHeaders = response.dimensionHeaders.map(h => h.name);
    const metricHeaders = response.metricHeaders.map(h => h.name);
    
    // Initialize aggregates
    let totalPageViews = 0;
    let totalUsers = 0;
    let totalEngagementRate = 0;
    let totalConversions = 0;
    let totalAvgSessionDuration = 0;
    let rowCount = 0;
    
    // Device and source breakdowns
    const byDevice = {};
    const bySource = {};
    
    // Process each row
    response.rows.forEach(row => {
      rowCount++;
      
      // Extract dimension values
      const dimensionValues = {};
      row.dimensionValues.forEach((value, index) => {
        dimensionValues[dimensionHeaders[index]] = value.value;
      });
      
      // Extract and aggregate metric values
      const metricValues = {};
      row.metricValues.forEach((value, index) => {
        const metricName = metricHeaders[index];
        const numericValue = Number(value.value);
        metricValues[metricName] = numericValue;
        
        // Aggregate totals
        if (metricName === 'screenPageViews') totalPageViews += numericValue;
        if (metricName === 'activeUsers') totalUsers += numericValue;
        if (metricName === 'engagementRate') totalEngagementRate += numericValue;
        if (metricName === 'conversions') totalConversions += numericValue;
        if (metricName === 'averageSessionDuration') totalAvgSessionDuration += numericValue;
      });
      
      // Aggregate by device
      if (dimensionValues.deviceCategory) {
        if (!byDevice[dimensionValues.deviceCategory]) {
          byDevice[dimensionValues.deviceCategory] = {
            pageViews: 0,
            users: 0
          };
        }
        byDevice[dimensionValues.deviceCategory].pageViews += metricValues.screenPageViews || 0;
        byDevice[dimensionValues.deviceCategory].users += metricValues.activeUsers || 0;
      }
      
      // Aggregate by source
      if (dimensionValues.sessionSource) {
        if (!bySource[dimensionValues.sessionSource]) {
          bySource[dimensionValues.sessionSource] = {
            pageViews: 0,
            users: 0
          };
        }
        bySource[dimensionValues.sessionSource].pageViews += metricValues.screenPageViews || 0;
        bySource[dimensionValues.sessionSource].users += metricValues.activeUsers || 0;
      }
    });
    
    // Calculate averages
    const avgEngagementRate = rowCount > 0 ? totalEngagementRate / rowCount : 0;
    const avgSessionDuration = rowCount > 0 ? totalAvgSessionDuration / rowCount : 0;
    
    // Return standardized metrics object
    return {
      url: pageUrl,
      pageViews: totalPageViews,
      uniqueUsers: totalUsers,
      engagementRate: avgEngagementRate,
      conversions: totalConversions,
      avgSessionDuration: avgSessionDuration,
      byDevice,
      bySource,
      retrievedAt: new Date()
    };
  }

  /**
   * Get top content from Google Analytics
   * @param {Object} options - Options for the query
   * @returns {Array} - Array of top content items
   */
  async getTopContent(options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Google Analytics integration is not connected');
      }
      
      const {
        startDate = '30daysAgo',
        endDate = 'today',
        limit = 10
      } = options;
      
      this.logger.info('Getting top content from Google Analytics');
      
      // Run the report
      const [response] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [
          { name: 'pagePath' },
          { name: 'pageTitle' }
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'engagementRate' },
          { name: 'conversions' }
        ],
        orderBys: [
          {
            metric: { metricName: 'screenPageViews' },
            desc: true
          }
        ],
        limit
      });
      
      // Process the response into a usable format
      if (!response || !response.rows || response.rows.length === 0) {
        return [];
      }
      
      const results = [];
      
      response.rows.forEach(row => {
        const path = row.dimensionValues[0].value;
        const title = row.dimensionValues[1].value;
        const pageViews = Number(row.metricValues[0].value);
        const users = Number(row.metricValues[1].value);
        const engagementRate = Number(row.metricValues[2].value);
        const conversions = Number(row.metricValues[3].value);
        
        results.push({
          url: path,
          title: title,
          metrics: {
            pageViews,
            users,
            engagementRate,
            conversions
          }
        });
      });
      
      return results;
    } catch (error) {
      this.logger.error('Error getting top content from Google Analytics:', error);
      throw error;
    }
  }

  /**
   * Get overall site metrics from Google Analytics
   * @param {Object} options - Options for the query
   * @returns {Object} - Overall site metrics
   */
  async getSiteMetrics(options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Google Analytics integration is not connected');
      }
      
      const {
        startDate = '30daysAgo',
        endDate = 'today',
        compareWithPrevious = true
      } = options;
      
      this.logger.info('Getting overall site metrics from Google Analytics');
      
      // Calculate previous period for comparison
      let previousStartDate, previousEndDate;
      
      if (compareWithPrevious) {
        const currentPeriod = this.calculateDateDifference(startDate, endDate);
        const periodDays = currentPeriod.days;
        
        previousEndDate = this.formatDate(
          this.subtractDays(this.parseDate(endDate), periodDays + 1)
        );
        
        previousStartDate = this.formatDate(
          this.subtractDays(this.parseDate(previousEndDate), periodDays - 1)
        );
      }
      
      // Run the report
      const [response] = await this.client.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
          ...(compareWithPrevious ? [{
            startDate: previousStartDate,
            endDate: previousEndDate,
          }] : [])
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'conversions' }
        ]
      });
      
      // Process the response into a usable format
      if (!response || !response.rows || response.rows.length === 0) {
        return {
          period: {
            startDate,
            endDate
          },
          metrics: {
            sessions: 0,
            users: 0,
            newUsers: 0,
            pageViews: 0,
            engagementRate: 0,
            avgSessionDuration: 0,
            bounceRate: 0,
            conversions: 0
          },
          comparison: null,
          retrievedAt: new Date()
        };
      }
      
      // Current period metrics
      const currentMetrics = {
        sessions: Number(response.rows[0].metricValues[0].value),
        users: Number(response.rows[0].metricValues[1].value),
        newUsers: Number(response.rows[0].metricValues[2].value),
        pageViews: Number(response.rows[0].metricValues[3].value),
        engagementRate: Number(response.rows[0].metricValues[4].value),
        avgSessionDuration: Number(response.rows[0].metricValues[5].value),
        bounceRate: Number(response.rows[0].metricValues[6].value),
        conversions: Number(response.rows[0].metricValues[7].value)
      };
      
      // Previous period metrics and comparison if requested
      let previousMetrics = null;
      let comparison = null;
      
      if (compareWithPrevious && response.rows.length > 1) {
        previousMetrics = {
          sessions: Number(response.rows[1].metricValues[0].value),
          users: Number(response.rows[1].metricValues[1].value),
          newUsers: Number(response.rows[1].metricValues[2].value),
          pageViews: Number(response.rows[1].metricValues[3].value),
          engagementRate: Number(response.rows[1].metricValues[4].value),
          avgSessionDuration: Number(response.rows[1].metricValues[5].value),
          bounceRate: Number(response.rows[1].metricValues[6].value),
          conversions: Number(response.rows[1].metricValues[7].value)
        };
        
        // Calculate percentage changes
        comparison = {
          sessions: this.calculatePercentChange(previousMetrics.sessions, currentMetrics.sessions),
          users: this.calculatePercentChange(previousMetrics.users, currentMetrics.users),
          newUsers: this.calculatePercentChange(previousMetrics.newUsers, currentMetrics.newUsers),
          pageViews: this.calculatePercentChange(previousMetrics.pageViews, currentMetrics.pageViews),
          engagementRate: this.calculatePercentChange(previousMetrics.engagementRate, currentMetrics.engagementRate),
          avgSessionDuration: this.calculatePercentChange(previousMetrics.avgSessionDuration, currentMetrics.avgSessionDuration),
          bounceRate: this.calculatePercentChange(previousMetrics.bounceRate, currentMetrics.bounceRate),
          conversions: this.calculatePercentChange(previousMetrics.conversions, currentMetrics.conversions)
        };
      }
      
      return {
        period: {
          startDate,
          endDate
        },
        metrics: currentMetrics,
        comparison,
        retrievedAt: new Date()
      };
    } catch (error) {
      this.logger.error('Error getting site metrics from Google Analytics:', error);
      throw error;
    }
  }

  /**
   * Calculate percentage change between two values
   * @param {number} previous - Previous value
   * @param {number} current - Current value
   * @returns {number} - Percentage change
   */
  calculatePercentChange(previous, current) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Calculate the difference between two dates
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @returns {Object} - Difference in days
   */
  calculateDateDifference(startDate, endDate) {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return { days: diffDays };
  }

  /**
   * Parse a date string into a Date object
   * @param {string} dateStr - Date string (e.g., '7daysAgo', 'today', '2023-01-01')
   * @returns {Date} - Date object
   */
  parseDate(dateStr) {
    if (dateStr === 'today') {
      return new Date();
    }
    
    if (dateStr.endsWith('daysAgo')) {
      const days = parseInt(dateStr);
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    }
    
    return new Date(dateStr);
  }

  /**
   * Subtract days from a date
   * @param {Date} date - Date object
   * @param {number} days - Number of days to subtract
   * @returns {Date} - New date
   */
  subtractDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  /**
   * Format a Date object as YYYY-MM-DD
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Shutdown the Google Analytics integration
   */
  async shutdown() {
    this.logger.info('Shutting down Google Analytics integration');
    this.isConnected = false;
    this.client = null;
    return true;
  }
}

module.exports = GoogleAnalyticsConnector;