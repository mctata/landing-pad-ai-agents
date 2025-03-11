/**
 * LinkedIn Integration Service
 * 
 * Handles integration with LinkedIn's Marketing API for posting content,
 * managing company pages, and retrieving analytics data.
 */

const axios = require('axios');
const logger = require('../../common/services/logger');

class LinkedInIntegration {
  constructor(config) {
    this.config = config || {};
    this.isInitialized = false;
    this.apiClient = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.companyId = config?.companyId || null;
    this.apiUrl = 'https://api.linkedin.com/v2';
  }

  /**
   * Initialize the LinkedIn integration with required credentials
   * @param {Object} config - Configuration object containing credentials
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(config = {}) {
    try {
      this.config = { ...this.config, ...config };
      
      // Validate required configuration
      if (!this.config.clientId || !this.config.clientSecret) {
        logger.error('LinkedIn integration initialization failed: Missing clientId or clientSecret');
        return false;
      }

      // Set required properties
      this.accessToken = this.config.accessToken;
      this.refreshToken = this.config.refreshToken;
      this.companyId = this.config.companyId;
      
      if (!this.accessToken) {
        logger.error('LinkedIn integration initialization failed: Missing access token');
        return false;
      }

      // Initialize API client
      this.apiClient = axios.create({
        baseURL: this.apiUrl,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      
      // Test the connection
      const profile = await this.getCompanyProfile();
      if (!profile) {
        logger.error('LinkedIn integration initialization failed: Invalid credentials or company ID');
        return false;
      }
      
      this.isInitialized = true;
      logger.info('LinkedIn integration initialized successfully');
      return true;
    } catch (error) {
      logger.error(`LinkedIn integration initialization failed: ${error.message}`, error);
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
      logger.info('LinkedIn integration shutdown successfully');
      return true;
    } catch (error) {
      logger.error(`LinkedIn integration shutdown failed: ${error.message}`, error);
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
      platform: 'LinkedIn',
      companyId: this.companyId,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Refresh the access token using the refresh token
   * @returns {Promise<boolean>} - True if refresh was successful
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      logger.error('Cannot refresh LinkedIn access token: No refresh token available');
      return false;
    }

    try {
      const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        
        if (response.data.refresh_token) {
          this.refreshToken = response.data.refresh_token;
        }
        
        // Update the API client headers
        if (this.apiClient) {
          this.apiClient.defaults.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        
        logger.info('LinkedIn access token refreshed successfully');
        return true;
      }
      
      logger.error('Failed to refresh LinkedIn access token: Invalid response');
      return false;
    } catch (error) {
      logger.error(`Failed to refresh LinkedIn access token: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Get the company profile information
   * @returns {Promise<Object|null>} - Company profile data or null if failed
   */
  async getCompanyProfile() {
    if (!this.isInitialized) {
      logger.error('LinkedIn integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.get(`/organizations/${this.companyId}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Try to refresh the token and retry
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          try {
            const retryResponse = await this.apiClient.get(`/organizations/${this.companyId}`);
            return retryResponse.data;
          } catch (retryError) {
            logger.error(`Failed to get LinkedIn company profile after token refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to get LinkedIn company profile: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create a text post on the company page
   * @param {Object} postData - Post data with text, visibility, etc.
   * @returns {Promise<Object|null>} - Post response data or null if failed
   */
  async createTextPost(postData) {
    if (!this.isInitialized) {
      logger.error('LinkedIn integration not initialized');
      return null;
    }

    try {
      // Prepare the post data according to LinkedIn's API requirements
      const payload = {
        author: `urn:li:organization:${this.companyId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postData.text
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': postData.visibility || 'PUBLIC'
        }
      };

      const response = await this.apiClient.post('/ugcPosts', payload);
      logger.info(`LinkedIn text post created successfully with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Try to refresh the token and retry
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          try {
            const payload = {
              author: `urn:li:organization:${this.companyId}`,
              lifecycleState: 'PUBLISHED',
              specificContent: {
                'com.linkedin.ugc.ShareContent': {
                  shareCommentary: {
                    text: postData.text
                  },
                  shareMediaCategory: 'NONE'
                }
              },
              visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': postData.visibility || 'PUBLIC'
              }
            };
            
            const retryResponse = await this.apiClient.post('/ugcPosts', payload);
            logger.info(`LinkedIn text post created successfully after token refresh with ID: ${retryResponse.data.id}`);
            return retryResponse.data;
          } catch (retryError) {
            logger.error(`Failed to create LinkedIn post after token refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to create LinkedIn post: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create a post with an image on the company page
   * @param {Object} postData - Post data with text, image URL, visibility, etc.
   * @returns {Promise<Object|null>} - Post response data or null if failed
   */
  async createImagePost(postData) {
    if (!this.isInitialized) {
      logger.error('LinkedIn integration not initialized');
      return null;
    }

    if (!postData.imageUrl) {
      logger.error('Image URL is required for LinkedIn image post');
      return null;
    }

    try {
      // Step 1: Register the image with LinkedIn
      const registerImageResponse = await this.apiClient.post('/assets?action=registerUpload', {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: `urn:li:organization:${this.companyId}`,
          serviceRelationships: [
            {
              relationshipType: 'OWNER',
              identifier: 'urn:li:userGeneratedContent'
            }
          ]
        }
      });
      
      const uploadUrl = registerImageResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const asset = registerImageResponse.data.value.asset;
      
      // Step 2: Upload the image to the provided URL
      // In a real implementation, you would download the image from postData.imageUrl
      // and then upload it to LinkedIn's upload URL
      // For simplicity, we'll simulate this step
      
      // Simulate image upload (in a real implementation, download and upload the actual image)
      const imageBuffer = await this.fetchImageAsBuffer(postData.imageUrl);
      await axios.put(uploadUrl, imageBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      });
      
      // Step 3: Create the post with the uploaded image
      const payload = {
        author: `urn:li:organization:${this.companyId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: postData.text
            },
            shareMediaCategory: 'IMAGE',
            media: [
              {
                status: 'READY',
                description: {
                  text: postData.imageDescription || ''
                },
                media: asset,
                title: {
                  text: postData.imageTitle || ''
                }
              }
            ]
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': postData.visibility || 'PUBLIC'
        }
      };

      const response = await this.apiClient.post('/ugcPosts', payload);
      logger.info(`LinkedIn image post created successfully with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to create LinkedIn image post: ${error.message}`, error);
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
   * Get analytics data for company page
   * @param {Object} options - Options for filtering analytics data
   * @returns {Promise<Object|null>} - Analytics data or null if failed
   */
  async getAnalytics(options = {}) {
    if (!this.isInitialized) {
      logger.error('LinkedIn integration not initialized');
      return null;
    }

    try {
      const timeRange = options.timeRange || 'PAST_30_DAYS';
      
      const response = await this.apiClient.get(`/organizationalEntityShareStatistics`, {
        params: {
          q: 'organizationalEntity',
          organizationalEntity: `urn:li:organization:${this.companyId}`,
          timeIntervals: `(timeRange:${timeRange})`,
          count: options.count || 100
        }
      });
      
      logger.info('LinkedIn analytics data retrieved successfully');
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Try to refresh the token and retry
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          try {
            const timeRange = options.timeRange || 'PAST_30_DAYS';
            
            const retryResponse = await this.apiClient.get(`/organizationalEntityShareStatistics`, {
              params: {
                q: 'organizationalEntity',
                organizationalEntity: `urn:li:organization:${this.companyId}`,
                timeIntervals: `(timeRange:${timeRange})`,
                count: options.count || 100
              }
            });
            
            logger.info('LinkedIn analytics data retrieved successfully after token refresh');
            return retryResponse.data;
          } catch (retryError) {
            logger.error(`Failed to get LinkedIn analytics after token refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to get LinkedIn analytics: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Get recent posts for the company page
   * @param {Object} options - Options for filtering posts
   * @returns {Promise<Array|null>} - Array of posts or null if failed
   */
  async getRecentPosts(options = {}) {
    if (!this.isInitialized) {
      logger.error('LinkedIn integration not initialized');
      return null;
    }

    try {
      const response = await this.apiClient.get(`/ugcPosts`, {
        params: {
          q: 'authors',
          authors: `List(urn:li:organization:${this.companyId})`,
          count: options.count || 10
        }
      });
      
      logger.info(`Retrieved ${response.data.elements.length} recent LinkedIn posts`);
      return response.data.elements;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Try to refresh the token and retry
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          try {
            const retryResponse = await this.apiClient.get(`/ugcPosts`, {
              params: {
                q: 'authors',
                authors: `List(urn:li:organization:${this.companyId})`,
                count: options.count || 10
              }
            });
            
            logger.info(`Retrieved ${retryResponse.data.elements.length} recent LinkedIn posts after token refresh`);
            return retryResponse.data.elements;
          } catch (retryError) {
            logger.error(`Failed to get LinkedIn posts after token refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to get LinkedIn posts: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Map content from internal format to LinkedIn format
   * @param {Object} content - Internal content object
   * @returns {Object} - LinkedIn-formatted content object
   */
  mapContentToLinkedIn(content) {
    // Extract relevant fields from the content object
    const {
      title,
      body,
      summary,
      images,
      tags,
      visibility = 'PUBLIC'
    } = content;

    // If there's an image, create an image post, otherwise create a text post
    if (images && images.length > 0) {
      return {
        text: summary || body.substring(0, 1200),
        imageUrl: images[0].url,
        imageTitle: title,
        imageDescription: summary || title,
        visibility,
        tags: tags ? tags.join(',') : ''
      };
    }

    // Text post - LinkedIn has a limit of ~3000 characters
    return {
      text: body.length > 3000 ? 
        `${title}\n\n${body.substring(0, 2970)}...` : 
        `${title}\n\n${body}`,
      visibility,
      tags: tags ? tags.join(',') : ''
    };
  }
}

module.exports = LinkedInIntegration;