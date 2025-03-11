/**
 * WordPress Integration
 * Handles content publishing and retrieval from WordPress sites
 */

const apiFetch = require('@wordpress/api-fetch');
const fetch = require('node-fetch');

class WordPressIntegration {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.endpoint = config.endpoint;
    this.username = config.username;
    this.applicationPassword = config.applicationPassword;
  }

  /**
   * Initialize the WordPress integration
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        this.logger.info('WordPress integration is disabled');
        return false;
      }

      this.logger.info('Initializing WordPress integration');
      
      // Set up basic auth
      const authString = Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64');
      
      // Configure API fetch
      apiFetch.use(apiFetch.createRootURLMiddleware(this.endpoint));
      apiFetch.use(apiFetch.createNonceMiddleware(authString));
      
      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.logger.info('WordPress integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize WordPress integration:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test the WordPress connection
   */
  async testConnection() {
    try {
      // Make a simple request to verify credentials and connection
      const response = await fetch(`${this.endpoint}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`WordPress connection test failed: ${errorData.message || response.statusText}`);
      }
      
      const userData = await response.json();
      this.logger.info(`WordPress connection successful. Connected as: ${userData.name}`);
      return true;
    } catch (error) {
      this.logger.error('WordPress connection test failed:', error);
      throw error;
    }
  }

  /**
   * Publish content to WordPress
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published post data
   */
  async publishContent(contentData) {
    try {
      if (!this.isConnected) {
        throw new Error('WordPress integration is not connected');
      }
      
      this.logger.info(`Publishing content to WordPress: ${contentData.title}`);
      
      // Transform content data to WordPress format
      const postData = this.transformToWordPressFormat(contentData);
      
      // Send to WordPress
      const response = await fetch(`${this.endpoint}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`
        },
        body: JSON.stringify(postData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to publish to WordPress: ${errorData.message || response.statusText}`);
      }
      
      const publishedPost = await response.json();
      
      this.logger.info(`Content published to WordPress. Post ID: ${publishedPost.id}`);
      
      return {
        id: publishedPost.id,
        url: publishedPost.link,
        status: publishedPost.status
      };
    } catch (error) {
      this.logger.error('Error publishing content to WordPress:', error);
      throw error;
    }
  }

  /**
   * Transform content data to WordPress format
   * @param {Object} contentData - Original content data
   * @returns {Object} - WordPress formatted content
   */
  transformToWordPressFormat(contentData) {
    // Map our content schema to WordPress expected fields
    return {
      title: contentData.title,
      content: contentData.content.body,
      excerpt: contentData.meta_description,
      status: this.mapStatusToWordPress(contentData.status),
      categories: this.mapCategories(contentData.categories),
      tags: contentData.keywords,
      meta: {
        _yoast_wpseo_metadesc: contentData.meta_description
      }
    };
  }

  /**
   * Map content status to WordPress status
   * @param {string} status - Original status
   * @returns {string} - WordPress status
   */
  mapStatusToWordPress(status) {
    const statusMap = {
      'draft': 'draft',
      'pending_review': 'pending',
      'published': 'publish',
      'archived': 'private'
    };
    
    return statusMap[status] || 'draft';
  }

  /**
   * Map categories to WordPress category IDs
   * @param {Array} categories - Original categories
   * @returns {Array} - WordPress category IDs
   */
  async mapCategories(categories) {
    // In a real implementation, this would query WordPress for category IDs
    // For now, we'll just pass them through
    return categories;
  }

  /**
   * Update existing WordPress content
   * @param {string} externalId - WordPress post ID
   * @param {Object} contentData - Updated content data
   * @returns {Object} - Updated post data
   */
  async updateContent(externalId, contentData) {
    try {
      if (!this.isConnected) {
        throw new Error('WordPress integration is not connected');
      }
      
      this.logger.info(`Updating WordPress content ID: ${externalId}`);
      
      // Transform content data to WordPress format
      const postData = this.transformToWordPressFormat(contentData);
      
      // Send to WordPress
      const response = await fetch(`${this.endpoint}/wp-json/wp/v2/posts/${externalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`
        },
        body: JSON.stringify(postData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update WordPress content: ${errorData.message || response.statusText}`);
      }
      
      const updatedPost = await response.json();
      
      this.logger.info(`Content updated in WordPress. Post ID: ${updatedPost.id}`);
      
      return {
        id: updatedPost.id,
        url: updatedPost.link,
        status: updatedPost.status
      };
    } catch (error) {
      this.logger.error(`Error updating WordPress content ID ${externalId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve content from WordPress
   * @param {string} externalId - WordPress post ID
   * @returns {Object} - Content data
   */
  async retrieveContent(externalId) {
    try {
      if (!this.isConnected) {
        throw new Error('WordPress integration is not connected');
      }
      
      this.logger.info(`Retrieving WordPress content ID: ${externalId}`);
      
      // Fetch from WordPress
      const response = await fetch(`${this.endpoint}/wp-json/wp/v2/posts/${externalId}?_embed=true`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          this.logger.warn(`WordPress content ID ${externalId} not found`);
          return null;
        }
        
        const errorData = await response.json();
        throw new Error(`Failed to retrieve WordPress content: ${errorData.message || response.statusText}`);
      }
      
      const post = await response.json();
      
      // Transform WordPress data to our format
      const contentData = this.transformFromWordPressFormat(post);
      
      this.logger.info(`Content retrieved from WordPress: ${contentData.title}`);
      
      return contentData;
    } catch (error) {
      this.logger.error(`Error retrieving WordPress content ID ${externalId}:`, error);
      throw error;
    }
  }

  /**
   * Transform WordPress data to our content format
   * @param {Object} post - WordPress post data
   * @returns {Object} - Content data in our format
   */
  transformFromWordPressFormat(post) {
    // Extract and transform categories
    const categories = post._embedded && post._embedded['wp:term'] ? 
      post._embedded['wp:term'][0].map(cat => cat.name) : [];
    
    // Extract and transform tags
    const keywords = post._embedded && post._embedded['wp:term'] ? 
      post._embedded['wp:term'][1].map(tag => tag.name) : [];
    
    return {
      title: post.title.rendered,
      content: {
        body: post.content.rendered,
        format: 'html'
      },
      meta_description: post.excerpt.rendered,
      status: this.mapStatusFromWordPress(post.status),
      categories,
      keywords,
      externalData: {
        id: post.id,
        url: post.link,
        provider: 'wordpress',
        lastSynced: new Date()
      }
    };
  }

  /**
   * Map WordPress status to our content status
   * @param {string} wpStatus - WordPress status
   * @returns {string} - Content status in our format
   */
  mapStatusFromWordPress(wpStatus) {
    const statusMap = {
      'draft': 'draft',
      'pending': 'pending_review',
      'publish': 'published',
      'private': 'archived',
      'trash': 'deleted'
    };
    
    return statusMap[wpStatus] || 'draft';
  }

  /**
   * Delete content from WordPress
   * @param {string} externalId - WordPress post ID
   * @returns {boolean} - Success status
   */
  async deleteContent(externalId) {
    try {
      if (!this.isConnected) {
        throw new Error('WordPress integration is not connected');
      }
      
      this.logger.info(`Deleting WordPress content ID: ${externalId}`);
      
      // Send to WordPress
      const response = await fetch(`${this.endpoint}/wp-json/wp/v2/posts/${externalId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to delete WordPress content: ${errorData.message || response.statusText}`);
      }
      
      this.logger.info(`Content deleted from WordPress. Post ID: ${externalId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error deleting WordPress content ID ${externalId}:`, error);
      throw error;
    }
  }

  /**
   * Import all content from WordPress
   * @param {Object} options - Import options
   * @returns {Array} - Imported content
   */
  async importAllContent(options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('WordPress integration is not connected');
      }
      
      const { limit = 100, status = 'publish' } = options;
      
      this.logger.info(`Importing WordPress content. Limit: ${limit}, Status: ${status}`);
      
      // Fetch from WordPress
      const response = await fetch(
        `${this.endpoint}/wp-json/wp/v2/posts?per_page=${limit}&status=${status}&_embed=true`, 
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64')}`
          }
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to import WordPress content: ${errorData.message || response.statusText}`);
      }
      
      const posts = await response.json();
      
      // Transform WordPress data to our format
      const importedContent = posts.map(post => this.transformFromWordPressFormat(post));
      
      this.logger.info(`Imported ${importedContent.length} posts from WordPress`);
      
      return importedContent;
    } catch (error) {
      this.logger.error('Error importing WordPress content:', error);
      throw error;
    }
  }

  /**
   * Shutdown the WordPress integration
   */
  async shutdown() {
    this.logger.info('Shutting down WordPress integration');
    this.isConnected = false;
    return true;
  }
}

module.exports = WordPressIntegration;