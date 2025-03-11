/**
 * Instagram Integration Service
 * 
 * Handles integration with Instagram Graph API for posting content,
 * managing posts, and retrieving analytics data.
 * Uses Facebook's Graph API since Instagram is owned by Meta.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../../common/services/logger');

class InstagramIntegration {
  constructor(config) {
    this.config = config || {};
    this.isInitialized = false;
    this.apiClient = null;
    this.accessToken = null;
    this.fbPageId = null;
    this.igBusinessAccountId = null;
    this.apiVersion = 'v18.0'; // Update to latest version as needed
    this.apiUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  /**
   * Initialize the Instagram integration with required credentials
   * @param {Object} config - Configuration object containing credentials
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(config = {}) {
    try {
      this.config = { ...this.config, ...config };
      
      // Validate required configuration
      if (!this.config.accessToken || !this.config.fbPageId || !this.config.igBusinessAccountId) {
        logger.error('Instagram integration initialization failed: Missing accessToken, fbPageId, or igBusinessAccountId');
        return false;
      }

      // Set required properties
      this.accessToken = this.config.accessToken;
      this.fbPageId = this.config.fbPageId;
      this.igBusinessAccountId = this.config.igBusinessAccountId;
      
      // Initialize API client
      this.apiClient = axios.create({
        baseURL: this.apiUrl,
        params: {
          access_token: this.accessToken
        }
      });
      
      // Test the connection by getting account info
      try {
        const response = await this.apiClient.get(`/${this.igBusinessAccountId}`);
        if (!response.data || !response.data.id) {
          logger.error('Instagram integration initialization failed: Invalid account ID or token');
          return false;
        }
        
        logger.info(`Instagram integration initialized successfully for account: ${response.data.username}`);
        this.isInitialized = true;
        return true;
      } catch (apiError) {
        logger.error(`Instagram API check failed: ${apiError.message}`, apiError);
        return false;
      }
    } catch (error) {
      logger.error(`Instagram integration initialization failed: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Shut down the integration safely
   * @returns {Promise<boolean>} - True if shutdown was successful
   */
  async shutdown() {
    try {
      this.isInitialized = false;
      this.apiClient = null;
      logger.info('Instagram integration shutdown successfully');
      return true;
    } catch (error) {
      logger.error(`Instagram integration shutdown failed: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Get the status of the integration
   * @returns {Object} - Status object with connection state and details
   */
  getStatus() {
    return {
      isConnected: this.isInitialized,
      platform: 'Instagram',
      fbPageId: this.fbPageId,
      igBusinessAccountId: this.igBusinessAccountId,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Get the Instagram business account information
   * @returns {Promise<Object|null>} - Account data or null if failed
   */
  async getAccountInfo() {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.get(`/${this.igBusinessAccountId}`, {
        params: {
          fields: 'id,username,name,profile_picture_url,followers_count,follows_count,media_count'
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Instagram account info: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Get media insights for a specific post
   * @param {string} mediaId - Instagram media ID
   * @returns {Promise<Object|null>} - Insights data or null if failed
   */
  async getMediaInsights(mediaId) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.get(`/${mediaId}/insights`, {
        params: {
          metric: 'engagement,impressions,reach,saved'
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Instagram media insights: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Get account insights
   * @param {string} timeRange - Time range for insights (day, week, days_28)
   * @returns {Promise<Object|null>} - Insights data or null if failed
   */
  async getAccountInsights(timeRange = 'day') {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.get(`/${this.igBusinessAccountId}/insights`, {
        params: {
          metric: 'impressions,reach,profile_views',
          period: timeRange
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Instagram account insights: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Get recent media for the account
   * @param {number} limit - Maximum number of items to retrieve
   * @returns {Promise<Array|null>} - Array of media items or null if failed
   */
  async getRecentMedia(limit = 10) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.get(`/${this.igBusinessAccountId}/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
          limit
        }
      });
      
      return response.data.data;
    } catch (error) {
      logger.error(`Failed to get Instagram recent media: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create a container for a feed post
   * @param {Object} postData - Caption and image URL
   * @returns {Promise<string|null>} - Container ID or null if failed
   */
  async createMediaContainer(postData) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    if (!postData.imageUrl) {
      logger.error('Image URL is required for Instagram post');
      return null;
    }

    try {
      // Download image to temp file
      const imageBuffer = await this.fetchImageAsBuffer(postData.imageUrl);
      const tempFilePath = path.join(os.tmpdir(), `instagram-post-${Date.now()}.jpg`);
      fs.writeFileSync(tempFilePath, imageBuffer);
      
      // Upload image to Facebook for Instagram
      const formData = new FormData();
      formData.append('image_url', postData.imageUrl);
      formData.append('caption', postData.caption || '');
      
      const response = await this.apiClient.post(
        `/${this.igBusinessAccountId}/media`,
        formData
      );
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      if (!response.data || !response.data.id) {
        logger.error('Failed to create Instagram media container: No container ID received');
        return null;
      }
      
      return response.data.id;
    } catch (error) {
      logger.error(`Failed to create Instagram media container: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Publish a container to Instagram
   * @param {string} containerId - Container ID from createMediaContainer
   * @returns {Promise<string|null>} - Media ID or null if failed
   */
  async publishMedia(containerId) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.post(
        `/${this.igBusinessAccountId}/media_publish`,
        {
          creation_id: containerId
        }
      );
      
      if (!response.data || !response.data.id) {
        logger.error('Failed to publish Instagram media: No media ID received');
        return null;
      }
      
      return response.data.id;
    } catch (error) {
      logger.error(`Failed to publish Instagram media: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create and publish a post to Instagram
   * @param {Object} postData - Caption and image URL
   * @returns {Promise<string|null>} - Media ID or null if failed
   */
  async createPost(postData) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    try {
      // Step 1: Create a media container
      const containerId = await this.createMediaContainer(postData);
      if (!containerId) {
        return null;
      }
      
      // Media containers can take time to process
      // Let's wait a bit before publishing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Step 2: Publish the media
      const mediaId = await this.publishMedia(containerId);
      if (!mediaId) {
        return null;
      }
      
      logger.info(`Instagram post created successfully with ID: ${mediaId}`);
      return mediaId;
    } catch (error) {
      logger.error(`Failed to create Instagram post: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create a carousel post with multiple images
   * @param {Object} postData - Caption and array of image URLs
   * @returns {Promise<string|null>} - Media ID or null if failed
   */
  async createCarouselPost(postData) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    if (!postData.imageUrls || !postData.imageUrls.length) {
      logger.error('Image URLs array is required for Instagram carousel post');
      return null;
    }

    try {
      // Create child media containers for each image
      const childMediaIds = [];
      
      for (const imageUrl of postData.imageUrls) {
        const formData = new FormData();
        formData.append('image_url', imageUrl);
        formData.append('is_carousel_item', 'true');
        
        const response = await this.apiClient.post(
          `/${this.igBusinessAccountId}/media`,
          formData
        );
        
        if (!response.data || !response.data.id) {
          logger.error('Failed to create Instagram carousel item: No container ID received');
          return null;
        }
        
        childMediaIds.push(response.data.id);
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Create the carousel container
      const carouselResponse = await this.apiClient.post(
        `/${this.igBusinessAccountId}/media`,
        {
          caption: postData.caption || '',
          media_type: 'CAROUSEL',
          children: childMediaIds.join(',')
        }
      );
      
      if (!carouselResponse.data || !carouselResponse.data.id) {
        logger.error('Failed to create Instagram carousel container: No container ID received');
        return null;
      }
      
      const carouselContainerId = carouselResponse.data.id;
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Publish the carousel
      const mediaId = await this.publishMedia(carouselContainerId);
      if (!mediaId) {
        return null;
      }
      
      logger.info(`Instagram carousel post created successfully with ID: ${mediaId}`);
      return mediaId;
    } catch (error) {
      logger.error(`Failed to create Instagram carousel post: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create a story post (temporary 24h content)
   * @param {Object} postData - Caption and image URL
   * @returns {Promise<string|null>} - Media ID or null if failed
   */
  async createStory(postData) {
    if (!this.isInitialized) {
      logger.error('Instagram integration not initialized');
      return null;
    }

    if (!postData.imageUrl) {
      logger.error('Image URL is required for Instagram story');
      return null;
    }

    try {
      // Create story container
      const formData = new FormData();
      formData.append('image_url', postData.imageUrl);
      formData.append('media_type', 'STORIES');
      
      const response = await this.apiClient.post(
        `/${this.igBusinessAccountId}/media`,
        formData
      );
      
      if (!response.data || !response.data.id) {
        logger.error('Failed to create Instagram story container: No container ID received');
        return null;
      }
      
      const containerId = response.data.id;
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Publish the story
      const mediaId = await this.publishMedia(containerId);
      if (!mediaId) {
        return null;
      }
      
      logger.info(`Instagram story created successfully with ID: ${mediaId}`);
      return mediaId;
    } catch (error) {
      logger.error(`Failed to create Instagram story: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Fetch an image as a buffer from a URL
   * @param {string} url - URL of the image
   * @returns {Promise<Buffer>} - Image data as buffer
   */
  async fetchImageAsBuffer(url) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data, 'binary');
    } catch (error) {
      logger.error(`Failed to fetch image from URL: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Map content from internal format to Instagram format
   * @param {Object} content - Internal content object
   * @returns {Object} - Instagram-formatted content object
   */
  mapContentToInstagram(content) {
    // Extract relevant fields from the content object
    const {
      title,
      body,
      summary,
      images
    } = content;
    
    // Format the caption - Instagram recommends captions under 2,200 characters
    // Include relevant hashtags
    let caption = `${title}`;
    
    if (summary) {
      caption += `\n\n${summary}`;
    } else if (body) {
      // Take the first few paragraphs, up to about 300 characters
      const shortBody = body.substring(0, 300);
      caption += `\n\n${shortBody}${body.length > 300 ? '...' : ''}`;
    }
    
    // Add hashtags if available
    if (content.tags && content.tags.length > 0) {
      const hashtags = content.tags.map(tag => `#${tag.replace(/\s+/g, '')}`);
      caption += `\n\n${hashtags.join(' ')}`;
    }
    
    // If we have multiple images, create a carousel post
    if (images && images.length > 1) {
      return {
        type: 'carousel',
        caption,
        imageUrls: images.map(image => image.url)
      };
    }
    
    // If we have one image, create a regular post
    if (images && images.length === 1) {
      return {
        type: 'post',
        caption,
        imageUrl: images[0].url
      };
    }
    
    // If no images, we can't post to Instagram as it requires at least one image
    logger.warn('Cannot map content to Instagram: No images available');
    return null;
  }
}

module.exports = InstagramIntegration;