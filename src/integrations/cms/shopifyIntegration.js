/**
 * Shopify Integration
 * Handles content publishing and retrieval from Shopify stores
 */

const Shopify = require('shopify-api-node');

class ShopifyIntegration {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.shopName = config.shopName;
    this.apiKey = config.apiKey;
    this.password = config.password;
    this.client = null;
  }

  /**
   * Initialize the Shopify integration
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        this.logger.info('Shopify integration is disabled');
        return false;
      }

      this.logger.info('Initializing Shopify integration');
      
      // Create Shopify client
      this.client = new Shopify({
        shopName: this.shopName,
        apiKey: this.apiKey,
        password: this.password
      });
      
      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.logger.info('Shopify integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Shopify integration:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test the Shopify connection
   */
  async testConnection() {
    try {
      // Make a simple request to verify credentials and connection
      const shop = await this.client.shop.get();
      
      this.logger.info(`Shopify connection successful. Connected to: ${shop.name}`);
      return true;
    } catch (error) {
      this.logger.error('Shopify connection test failed:', error);
      throw error;
    }
  }

  /**
   * Publish content to Shopify as a blog article
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published article data
   */
  async publishContent(contentData) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Shopify integration is not connected');
      }
      
      this.logger.info(`Publishing content to Shopify: ${contentData.title}`);
      
      // Get the first blog
      const blogs = await this.client.blog.list();
      if (!blogs || blogs.length === 0) {
        throw new Error('No blogs found in Shopify store');
      }
      
      const blogId = blogs[0].id;
      
      // Transform content data to Shopify format
      const articleData = this.transformToShopifyFormat(contentData, blogId);
      
      // Send to Shopify
      const article = await this.client.article.create(articleData);
      
      this.logger.info(`Content published to Shopify. Article ID: ${article.id}`);
      
      return {
        id: article.id,
        url: article.url,
        status: article.published ? 'published' : 'draft'
      };
    } catch (error) {
      this.logger.error('Error publishing content to Shopify:', error);
      throw error;
    }
  }

  /**
   * Transform content data to Shopify format
   * @param {Object} contentData - Original content data
   * @param {number} blogId - Shopify blog ID
   * @returns {Object} - Shopify formatted content
   */
  transformToShopifyFormat(contentData, blogId) {
    // Map our content schema to Shopify expected fields
    return {
      blog_id: blogId,
      title: contentData.title,
      body_html: contentData.content.body,
      summary_html: contentData.meta_description,
      published: this.mapStatusToShopify(contentData.status),
      tags: contentData.keywords ? contentData.keywords.join(', ') : '',
      metafields: [
        {
          key: 'categories',
          value: JSON.stringify(contentData.categories),
          namespace: 'landing_pad',
          value_type: 'json_string'
        }
      ]
    };
  }

  /**
   * Map content status to Shopify published status
   * @param {string} status - Original status
   * @returns {boolean} - Shopify published status
   */
  mapStatusToShopify(status) {
    return status === 'published';
  }

  /**
   * Update existing Shopify content
   * @param {string} externalId - Shopify article ID
   * @param {Object} contentData - Updated content data
   * @returns {Object} - Updated article data
   */
  async updateContent(externalId, contentData) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Shopify integration is not connected');
      }
      
      this.logger.info(`Updating Shopify content ID: ${externalId}`);
      
      // Get the article to find blog_id
      const article = await this.client.article.get(externalId);
      
      // Transform content data to Shopify format
      const articleData = this.transformToShopifyFormat(contentData, article.blog_id);
      
      // Send to Shopify
      const updatedArticle = await this.client.article.update(externalId, articleData);
      
      this.logger.info(`Content updated in Shopify. Article ID: ${updatedArticle.id}`);
      
      return {
        id: updatedArticle.id,
        url: updatedArticle.url,
        status: updatedArticle.published ? 'published' : 'draft'
      };
    } catch (error) {
      this.logger.error(`Error updating Shopify content ID ${externalId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve content from Shopify
   * @param {string} externalId - Shopify article ID
   * @returns {Object} - Content data
   */
  async retrieveContent(externalId) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Shopify integration is not connected');
      }
      
      this.logger.info(`Retrieving Shopify content ID: ${externalId}`);
      
      // Fetch from Shopify
      const article = await this.client.article.get(externalId);
      
      if (!article) {
        this.logger.warn(`Shopify article ID ${externalId} not found`);
        return null;
      }
      
      // Get metafields
      const metafields = await this.client.article.metafields(externalId);
      
      // Transform Shopify data to our format
      const contentData = this.transformFromShopifyFormat(article, metafields);
      
      this.logger.info(`Content retrieved from Shopify: ${contentData.title}`);
      
      return contentData;
    } catch (error) {
      this.logger.error(`Error retrieving Shopify content ID ${externalId}:`, error);
      throw error;
    }
  }

  /**
   * Transform Shopify data to our content format
   * @param {Object} article - Shopify article data
   * @param {Array} metafields - Shopify metafields
   * @returns {Object} - Content data in our format
   */
  transformFromShopifyFormat(article, metafields) {
    // Extract categories from metafields
    let categories = [];
    const categoriesMetafield = metafields.find(
      meta => meta.namespace === 'landing_pad' && meta.key === 'categories'
    );
    
    if (categoriesMetafield) {
      try {
        categories = JSON.parse(categoriesMetafield.value);
      } catch (e) {
        this.logger.warn('Failed to parse categories from metafield:', e);
      }
    }
    
    // Extract tags
    const keywords = article.tags ? article.tags.split(', ') : [];
    
    return {
      title: article.title,
      content: {
        body: article.body_html,
        format: 'html'
      },
      meta_description: article.summary_html,
      status: article.published ? 'published' : 'draft',
      categories,
      keywords,
      externalData: {
        id: article.id,
        url: article.url,
        provider: 'shopify',
        lastSynced: new Date()
      }
    };
  }

  /**
   * Delete content from Shopify
   * @param {string} externalId - Shopify article ID
   * @returns {boolean} - Success status
   */
  async deleteContent(externalId) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Shopify integration is not connected');
      }
      
      this.logger.info(`Deleting Shopify content ID: ${externalId}`);
      
      // Delete from Shopify
      await this.client.article.delete(externalId);
      
      this.logger.info(`Content deleted from Shopify. Article ID: ${externalId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error deleting Shopify content ID ${externalId}:`, error);
      throw error;
    }
  }

  /**
   * Import all content from Shopify
   * @param {Object} options - Import options
   * @returns {Array} - Imported content
   */
  async importAllContent(options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Shopify integration is not connected');
      }
      
      const { limit = 50 } = options;
      
      this.logger.info(`Importing Shopify content. Limit: ${limit}`);
      
      // Get all blogs
      const blogs = await this.client.blog.list();
      
      // Collect all articles from all blogs
      let allArticles = [];
      
      for (const blog of blogs) {
        const articles = await this.client.article.list(blog.id, { limit });
        allArticles = allArticles.concat(articles);
      }
      
      // Transform Shopify data to our format
      const importPromises = allArticles.map(async article => {
        // Get metafields for each article
        const metafields = await this.client.article.metafields(article.id);
        return this.transformFromShopifyFormat(article, metafields);
      });
      
      const importedContent = await Promise.all(importPromises);
      
      this.logger.info(`Imported ${importedContent.length} articles from Shopify`);
      
      return importedContent;
    } catch (error) {
      this.logger.error('Error importing Shopify content:', error);
      throw error;
    }
  }

  /**
   * Shutdown the Shopify integration
   */
  async shutdown() {
    this.logger.info('Shutting down Shopify integration');
    this.isConnected = false;
    this.client = null;
    return true;
  }
}

module.exports = ShopifyIntegration;