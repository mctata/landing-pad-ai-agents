/**
 * Integration Service
 * Manages and coordinates all external integrations
 */

// CMS Integrations
const WordPressIntegration = require('../src/integrations/cms/wordpressIntegration');
const ShopifyIntegration = require('../src/integrations/cms/shopifyIntegration');

// Social Media Integrations
const TwitterIntegration = require('../src/integrations/social/twitterIntegration');
const FacebookIntegration = require('../src/integrations/social/facebookIntegration');

// Analytics Integrations
const GoogleAnalyticsConnector = require('../src/integrations/analytics/googleAnalyticsConnector');

class IntegrationService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isInitialized = false;
    this.integrations = {
      cms: {},
      social: {},
      analytics: {}
    };
  }

  /**
   * Initialize all integrations
   */
  async initialize() {
    try {
      this.logger.info('Initializing Integration Service');
      
      // Initialize CMS integrations
      await this.initializeCmsIntegrations();
      
      // Initialize social media integrations
      await this.initializeSocialIntegrations();
      
      // Initialize analytics integrations
      await this.initializeAnalyticsIntegrations();
      
      this.isInitialized = true;
      this.logger.info('Integration Service initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Integration Service:', error);
      return false;
    }
  }

  /**
   * Initialize CMS integrations
   */
  async initializeCmsIntegrations() {
    try {
      this.logger.info('Initializing CMS integrations');
      
      // WordPress
      if (this.config.publishing && this.config.publishing.wordpress) {
        const wordpressConfig = this.config.publishing.wordpress;
        this.integrations.cms.wordpress = new WordPressIntegration(wordpressConfig, this.logger);
        await this.integrations.cms.wordpress.initialize();
      }
      
      // Shopify
      if (this.config.publishing && this.config.publishing.shopify) {
        const shopifyConfig = this.config.publishing.shopify;
        this.integrations.cms.shopify = new ShopifyIntegration(shopifyConfig, this.logger);
        await this.integrations.cms.shopify.initialize();
      }
      
      this.logger.info('CMS integrations initialized');
    } catch (error) {
      this.logger.error('Error initializing CMS integrations:', error);
      throw error;
    }
  }

  /**
   * Initialize social media integrations
   */
  async initializeSocialIntegrations() {
    try {
      this.logger.info('Initializing social media integrations');
      
      // Twitter
      if (this.config.social && this.config.social.twitter) {
        const twitterConfig = this.config.social.twitter;
        this.integrations.social.twitter = new TwitterIntegration(twitterConfig, this.logger);
        await this.integrations.social.twitter.initialize();
      }
      
      // Facebook
      if (this.config.social && this.config.social.facebook) {
        const facebookConfig = this.config.social.facebook;
        this.integrations.social.facebook = new FacebookIntegration(facebookConfig, this.logger);
        await this.integrations.social.facebook.initialize();
      }
      
      this.logger.info('Social media integrations initialized');
    } catch (error) {
      this.logger.error('Error initializing social media integrations:', error);
      throw error;
    }
  }

  /**
   * Initialize analytics integrations
   */
  async initializeAnalyticsIntegrations() {
    try {
      this.logger.info('Initializing analytics integrations');
      
      // Google Analytics
      if (this.config.analytics && this.config.analytics.providers.googleAnalytics) {
        const gaConfig = this.config.analytics.providers.googleAnalytics;
        this.integrations.analytics.googleAnalytics = new GoogleAnalyticsConnector(gaConfig, this.logger);
        await this.integrations.analytics.googleAnalytics.initialize();
      }
      
      this.logger.info('Analytics integrations initialized');
    } catch (error) {
      this.logger.error('Error initializing analytics integrations:', error);
      throw error;
    }
  }

  /**
   * Get status of all integrations
   */
  getStatus() {
    const status = {
      isInitialized: this.isInitialized,
      cms: {},
      social: {},
      analytics: {}
    };
    
    // CMS status
    Object.keys(this.integrations.cms).forEach(name => {
      status.cms[name] = {
        connected: this.integrations.cms[name].isConnected,
        enabled: this.integrations.cms[name].config.enabled
      };
    });
    
    // Social status
    Object.keys(this.integrations.social).forEach(name => {
      status.social[name] = {
        connected: this.integrations.social[name].isConnected,
        enabled: this.integrations.social[name].config.enabled
      };
    });
    
    // Analytics status
    Object.keys(this.integrations.analytics).forEach(name => {
      status.analytics[name] = {
        connected: this.integrations.analytics[name].isConnected,
        enabled: this.integrations.analytics[name].config.enabled
      };
    });
    
    return status;
  }

  /**
   * Publish content to a CMS platform
   * @param {string} platform - CMS platform ('wordpress', 'shopify')
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published content data
   */
  async publishToCms(platform, contentData) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const integration = this.integrations.cms[platform.toLowerCase()];
      
      if (\!integration) {
        throw new Error(`CMS integration ${platform} not found`);
      }
      
      if (\!integration.isConnected) {
        throw new Error(`CMS integration ${platform} not connected`);
      }
      
      this.logger.info(`Publishing content to ${platform}: ${contentData.title}`);
      
      const result = await integration.publishContent(contentData);
      
      this.logger.info(`Content published to ${platform} successfully`);
      
      return {
        success: true,
        platform,
        externalId: result.id,
        url: result.url,
        status: result.status
      };
    } catch (error) {
      this.logger.error(`Error publishing to ${platform}:`, error);
      
      return {
        success: false,
        platform,
        error: error.message
      };
    }
  }

  /**
   * Update content on a CMS platform
   * @param {string} platform - CMS platform ('wordpress', 'shopify')
   * @param {string} externalId - External content ID
   * @param {Object} contentData - Updated content data
   * @returns {Object} - Updated content data
   */
  async updateOnCms(platform, externalId, contentData) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const integration = this.integrations.cms[platform.toLowerCase()];
      
      if (\!integration) {
        throw new Error(`CMS integration ${platform} not found`);
      }
      
      if (\!integration.isConnected) {
        throw new Error(`CMS integration ${platform} not connected`);
      }
      
      this.logger.info(`Updating content on ${platform} with ID: ${externalId}`);
      
      const result = await integration.updateContent(externalId, contentData);
      
      this.logger.info(`Content updated on ${platform} successfully`);
      
      return {
        success: true,
        platform,
        externalId: result.id,
        url: result.url,
        status: result.status
      };
    } catch (error) {
      this.logger.error(`Error updating on ${platform}:`, error);
      
      return {
        success: false,
        platform,
        error: error.message
      };
    }
  }

  /**
   * Import content from a CMS platform
   * @param {string} platform - CMS platform ('wordpress', 'shopify')
   * @param {Object} options - Import options
   * @returns {Array} - Imported content
   */
  async importFromCms(platform, options = {}) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const integration = this.integrations.cms[platform.toLowerCase()];
      
      if (\!integration) {
        throw new Error(`CMS integration ${platform} not found`);
      }
      
      if (\!integration.isConnected) {
        throw new Error(`CMS integration ${platform} not connected`);
      }
      
      this.logger.info(`Importing content from ${platform}`);
      
      const contents = await integration.importAllContent(options);
      
      this.logger.info(`Imported ${contents.length} items from ${platform}`);
      
      return {
        success: true,
        platform,
        count: contents.length,
        contents
      };
    } catch (error) {
      this.logger.error(`Error importing from ${platform}:`, error);
      
      return {
        success: false,
        platform,
        error: error.message
      };
    }
  }

  /**
   * Post content to social media
   * @param {string} platform - Social platform ('twitter', 'facebook')
   * @param {Object} contentData - Content data to post
   * @returns {Object} - Posted content data
   */
  async postToSocial(platform, contentData) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const integration = this.integrations.social[platform.toLowerCase()];
      
      if (\!integration) {
        throw new Error(`Social integration ${platform} not found`);
      }
      
      if (\!integration.isConnected) {
        throw new Error(`Social integration ${platform} not connected`);
      }
      
      this.logger.info(`Posting content to ${platform}`);
      
      const result = await integration.publishContent(contentData);
      
      this.logger.info(`Content posted to ${platform} successfully`);
      
      return {
        success: true,
        platform,
        externalId: result.id,
        url: result.url
      };
    } catch (error) {
      this.logger.error(`Error posting to ${platform}:`, error);
      
      return {
        success: false,
        platform,
        error: error.message
      };
    }
  }

  /**
   * Post a thread or multi-part content to Twitter
   * @param {Object} contentData - Content data to post
   * @returns {Object} - Posted thread data
   */
  async postTwitterThread(contentData) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const twitter = this.integrations.social.twitter;
      
      if (\!twitter) {
        throw new Error('Twitter integration not found');
      }
      
      if (\!twitter.isConnected) {
        throw new Error('Twitter integration not connected');
      }
      
      this.logger.info('Posting thread to Twitter');
      
      const result = await twitter.publishThread(contentData);
      
      this.logger.info(`Thread posted to Twitter successfully with ${result.threadIds.length} tweets`);
      
      return {
        success: true,
        platform: 'twitter',
        threadIds: result.threadIds,
        url: result.url
      };
    } catch (error) {
      this.logger.error('Error posting thread to Twitter:', error);
      
      return {
        success: false,
        platform: 'twitter',
        error: error.message
      };
    }
  }

  /**
   * Get social media metrics
   * @param {string} platform - Social platform ('twitter', 'facebook')
   * @param {string} externalId - External post ID
   * @returns {Object} - Social media metrics
   */
  async getSocialMetrics(platform, externalId) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const integration = this.integrations.social[platform.toLowerCase()];
      
      if (\!integration) {
        throw new Error(`Social integration ${platform} not found`);
      }
      
      if (\!integration.isConnected) {
        throw new Error(`Social integration ${platform} not connected`);
      }
      
      this.logger.info(`Getting metrics from ${platform} for ID: ${externalId}`);
      
      let metrics;
      
      if (platform.toLowerCase() === 'twitter') {
        metrics = await integration.getTweetMetrics(externalId);
      } else if (platform.toLowerCase() === 'facebook') {
        metrics = await integration.getPostMetrics(externalId);
      } else {
        throw new Error(`Unsupported social platform: ${platform}`);
      }
      
      if (\!metrics) {
        throw new Error(`No metrics found for ${platform} ID: ${externalId}`);
      }
      
      return {
        success: true,
        platform,
        metrics
      };
    } catch (error) {
      this.logger.error(`Error getting metrics from ${platform}:`, error);
      
      return {
        success: false,
        platform,
        error: error.message
      };
    }
  }

  /**
   * Get analytics for a page
   * @param {string} pageUrl - URL of the page
   * @param {Object} options - Analytics options
   * @returns {Object} - Page analytics
   */
  async getPageAnalytics(pageUrl, options = {}) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const ga = this.integrations.analytics.googleAnalytics;
      
      if (\!ga || \!ga.isConnected) {
        throw new Error('Google Analytics integration not available');
      }
      
      this.logger.info(`Getting analytics for page: ${pageUrl}`);
      
      const metrics = await ga.getPageMetrics(pageUrl, options);
      
      return {
        success: true,
        source: 'googleAnalytics',
        url: pageUrl,
        metrics
      };
    } catch (error) {
      this.logger.error(`Error getting analytics for page ${pageUrl}:`, error);
      
      return {
        success: false,
        source: 'googleAnalytics',
        url: pageUrl,
        error: error.message
      };
    }
  }

  /**
   * Get top performing content from analytics
   * @param {Object} options - Options for the query
   * @returns {Object} - Top content data
   */
  async getTopPerformingContent(options = {}) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const ga = this.integrations.analytics.googleAnalytics;
      
      if (\!ga || \!ga.isConnected) {
        throw new Error('Google Analytics integration not available');
      }
      
      this.logger.info('Getting top performing content from analytics');
      
      const topContent = await ga.getTopContent(options);
      
      return {
        success: true,
        source: 'googleAnalytics',
        contents: topContent
      };
    } catch (error) {
      this.logger.error('Error getting top performing content:', error);
      
      return {
        success: false,
        source: 'googleAnalytics',
        error: error.message
      };
    }
  }

  /**
   * Get overall site metrics from analytics
   * @param {Object} options - Options for the query
   * @returns {Object} - Site metrics
   */
  async getSiteMetrics(options = {}) {
    try {
      if (\!this.isInitialized) {
        throw new Error('Integration Service not initialized');
      }
      
      const ga = this.integrations.analytics.googleAnalytics;
      
      if (\!ga || \!ga.isConnected) {
        throw new Error('Google Analytics integration not available');
      }
      
      this.logger.info('Getting overall site metrics from analytics');
      
      const metrics = await ga.getSiteMetrics(options);
      
      return {
        success: true,
        source: 'googleAnalytics',
        metrics
      };
    } catch (error) {
      this.logger.error('Error getting site metrics:', error);
      
      return {
        success: false,
        source: 'googleAnalytics',
        error: error.message
      };
    }
  }

  /**
   * Shutdown all integrations
   */
  async shutdown() {
    this.logger.info('Shutting down Integration Service');
    
    // Shutdown CMS integrations
    for (const name in this.integrations.cms) {
      if (this.integrations.cms[name].isConnected) {
        await this.integrations.cms[name].shutdown();
      }
    }
    
    // Shutdown social integrations
    for (const name in this.integrations.social) {
      if (this.integrations.social[name].isConnected) {
        await this.integrations.social[name].shutdown();
      }
    }
    
    // Shutdown analytics integrations
    for (const name in this.integrations.analytics) {
      if (this.integrations.analytics[name].isConnected) {
        await this.integrations.analytics[name].shutdown();
      }
    }
    
    this.isInitialized = false;
    this.logger.info('Integration Service shutdown complete');
    
    return true;
  }
}

module.exports = IntegrationService;
