/**
 * Facebook Integration
 * Handles content publishing and analytics retrieval from Facebook
 */

const FB = require('fb');

class FacebookIntegration {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.accessToken = config.accessToken;
    this.pageId = config.pageId;
  }

  /**
   * Initialize the Facebook integration
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        this.logger.info('Facebook integration is disabled');
        return false;
      }

      this.logger.info('Initializing Facebook integration');
      
      // Configure Facebook SDK
      FB.options({
        appId: this.appId,
        appSecret: this.appSecret,
        version: 'v18.0' // Use appropriate API version
      });
      
      FB.setAccessToken(this.accessToken);
      
      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.logger.info('Facebook integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Facebook integration:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test the Facebook connection
   */
  async testConnection() {
    try {
      // Make a simple request to verify credentials and connection
      const response = await this.fbApiPromise('me', { fields: 'name' });
      
      this.logger.info(`Facebook connection successful. Connected as: ${response.name}`);
      return true;
    } catch (error) {
      this.logger.error('Facebook connection test failed:', error);
      throw error;
    }
  }

  /**
   * Wrap FB.api in a Promise
   */
  fbApiPromise(path, params = {}, method = 'get') {
    return new Promise((resolve, reject) => {
      FB.api(path, method, params, (response) => {
        if (!response) {
          reject(new Error('No response from Facebook API'));
        } else if (response.error) {
          reject(new Error(`Facebook API error: ${response.error.message}`));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Publish content to Facebook page
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published post data
   */
  async publishContent(contentData) {
    try {
      if (!this.isConnected) {
        throw new Error('Facebook integration is not connected');
      }
      
      this.logger.info(`Publishing content to Facebook: ${contentData.title}`);
      
      // Prepare post data
      const postData = this.transformToFacebookPost(contentData);
      
      // Post to the Facebook page
      const response = await this.fbApiPromise(`${this.pageId}/feed`, postData, 'post');
      
      this.logger.info(`Content published to Facebook. Post ID: ${response.id}`);
      
      return {
        id: response.id,
        url: `https://facebook.com/${response.id}`,
        platform: 'facebook'
      };
    } catch (error) {
      this.logger.error('Error publishing content to Facebook:', error);
      throw error;
    }
  }

  /**
   * Transform content data to Facebook post format
   * @param {Object} contentData - Original content data
   * @returns {Object} - Facebook post data
   */
  transformToFacebookPost(contentData) {
    // Create post message
    let message = contentData.title;
    
    // Add meta description or summary if available
    if (contentData.meta_description) {
      message += `\n\n${contentData.meta_description}`;
    }
    
    // Add hashtags from keywords
    if (contentData.keywords && contentData.keywords.length > 0) {
      const hashtags = contentData.keywords
        .slice(0, 5) // Take up to 5 keywords
        .map(keyword => `#${keyword.replace(/\s+/g, '')}`)
        .join(' ');
      
      message += `\n\n${hashtags}`;
    }
    
    // Prepare the post data
    const postData = {
      message
    };
    
    // If we have a URL, add it as a link
    if (contentData.url) {
      postData.link = contentData.url;
    }
    
    return postData;
  }

  /**
   * Publish content with an image to Facebook
   * @param {Object} contentData - Content data to publish
   * @param {string} imageUrl - URL of the image to include
   * @returns {Object} - Published post data
   */
  async publishContentWithImage(contentData, imageUrl) {
    try {
      if (!this.isConnected) {
        throw new Error('Facebook integration is not connected');
      }
      
      this.logger.info(`Publishing content with image to Facebook: ${contentData.title}`);
      
      // Prepare post data
      const postData = this.transformToFacebookPost(contentData);
      
      // Add image URL
      postData.picture = imageUrl;
      
      // Post to the Facebook page
      const response = await this.fbApiPromise(`${this.pageId}/photos`, {
        ...postData,
        url: imageUrl
      }, 'post');
      
      this.logger.info(`Content with image published to Facebook. Post ID: ${response.id}`);
      
      return {
        id: response.id,
        url: `https://facebook.com/${response.id}`,
        platform: 'facebook'
      };
    } catch (error) {
      this.logger.error('Error publishing content with image to Facebook:', error);
      throw error;
    }
  }

  /**
   * Get metrics for a Facebook post
   * @param {string} postId - Facebook post ID
   * @returns {Object} - Post metrics
   */
  async getPostMetrics(postId) {
    try {
      if (!this.isConnected) {
        throw new Error('Facebook integration is not connected');
      }
      
      this.logger.info(`Getting metrics for Facebook post ID: ${postId}`);
      
      // Get post insights
      const insights = await this.fbApiPromise(`${postId}/insights`, {
        metric: 'post_impressions,post_engagements,post_reactions_by_type_total'
      });
      
      if (!insights || !insights.data) {
        this.logger.warn(`No insights available for Facebook post ID ${postId}`);
        return null;
      }
      
      // Extract metrics
      const impressionsData = insights.data.find(d => d.name === 'post_impressions');
      const engagementsData = insights.data.find(d => d.name === 'post_engagements');
      const reactionsData = insights.data.find(d => d.name === 'post_reactions_by_type_total');
      
      // Get post details for created time
      const post = await this.fbApiPromise(postId, { fields: 'created_time' });
      
      // Transform to our metrics format
      const metrics = {
        id: postId,
        platform: 'facebook',
        impressions: impressionsData ? impressionsData.values[0].value : 0,
        engagements: {
          total: engagementsData ? engagementsData.values[0].value : 0,
          reactions: reactionsData ? this.sumReactions(reactionsData.values[0].value) : 0
        },
        totalEngagements: engagementsData ? engagementsData.values[0].value : 0,
        timestamp: post ? new Date(post.created_time) : new Date(),
        retrievedAt: new Date()
      };
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error getting metrics for Facebook post ID ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Sum all reactions from Facebook's reaction object
   * @param {Object} reactions - Facebook reactions object
   * @returns {number} - Total reactions count
   */
  sumReactions(reactions) {
    if (!reactions) return 0;
    
    return Object.values(reactions).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Shutdown the Facebook integration
   */
  async shutdown() {
    this.logger.info('Shutting down Facebook integration');
    this.isConnected = false;
    return true;
  }
}

module.exports = FacebookIntegration;