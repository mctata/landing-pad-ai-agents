/**
 * Contentful Integration
 * Handles content publishing and retrieval from Contentful CMS
 */

const contentful = require('contentful');
const contentfulManagement = require('contentful-management');

class ContentfulIntegration {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.deliveryClient = null;
    this.managementClient = null;
    this.space = null;
    this.environment = null;
  }

  /**
   * Initialize the Contentful integration
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        this.logger.info('Contentful integration is disabled');
        return false;
      }

      this.logger.info('Initializing Contentful integration');
      
      // Create Contentful delivery client for reading content
      this.deliveryClient = contentful.createClient({
        space: this.config.spaceId,
        accessToken: this.config.deliveryApiKey,
        environment: this.config.environment || 'master'
      });
      
      // Create Contentful management client for creating/updating content
      this.managementClient = contentfulManagement.createClient({
        accessToken: this.config.managementApiKey
      });
      
      // Get space and environment
      this.space = await this.managementClient.getSpace(this.config.spaceId);
      this.environment = await this.space.getEnvironment(this.config.environment || 'master');
      
      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.logger.info('Contentful integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Contentful integration:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test the Contentful connection
   */
  async testConnection() {
    try {
      // Test delivery API connection
      const space = await this.deliveryClient.getSpace();
      
      // Test management API connection
      const contentTypes = await this.environment.getContentTypes();
      
      this.logger.info(`Contentful connection successful. Connected to space: ${space.name}`);
      this.logger.info(`Available content types: ${contentTypes.items.map(ct => ct.name).join(', ')}`);
      
      return true;
    } catch (error) {
      this.logger.error('Contentful connection test failed:', error);
      throw error;
    }
  }

  /**
   * Publish content to Contentful
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published entry data
   */
  async publishContent(contentData) {
    try {
      if (!this.isConnected) {
        throw new Error('Contentful integration is not connected');
      }
      
      this.logger.info(`Publishing content to Contentful: ${contentData.title}`);
      
      // Determine content type
      const contentType = this.determineContentType(contentData);
      
      // Transform content data to Contentful format
      const fields = this.transformToContentfulFormat(contentData, contentType);
      
      // Create entry
      const entry = await this.environment.createEntry(contentType, {
        fields
      });
      
      // Publish entry
      const publishedEntry = await entry.publish();
      
      this.logger.info(`Content published to Contentful. Entry ID: ${publishedEntry.sys.id}`);
      
      return {
        id: publishedEntry.sys.id,
        contentType: publishedEntry.sys.contentType.sys.id,
        url: `https://app.contentful.com/spaces/${this.config.spaceId}/entries/${publishedEntry.sys.id}`,
        status: 'published'
      };
    } catch (error) {
      this.logger.error('Error publishing content to Contentful:', error);
      throw error;
    }
  }

  /**
   * Determine the appropriate Contentful content type based on our content
   * @param {Object} contentData - Content data
   * @returns {string} - Contentful content type ID
   */
  determineContentType(contentData) {
    // Map our content types to Contentful content types
    const typeMap = {
      'blog': this.config.contentTypeMap?.blog || 'blogPost',
      'landing_page': this.config.contentTypeMap?.landing_page || 'landingPage',
      'social': this.config.contentTypeMap?.social || 'socialPost',
      'email': this.config.contentTypeMap?.email || 'emailContent'
    };
    
    // Use provided content type or fallback to article
    return typeMap[contentData.type] || 'article';
  }

  /**
   * Transform content data to Contentful format
   * @param {Object} contentData - Original content data
   * @param {string} contentType - Contentful content type ID
   * @returns {Object} - Contentful formatted fields
   */
  transformToContentfulFormat(contentData, contentType) {
    // Basic fields that most content types would have
    const fields = {
      title: {
        'en-US': contentData.title
      },
      slug: {
        'en-US': this.createSlug(contentData.title)
      }
    };
    
    // Add body content
    if (contentData.content && contentData.content.body) {
      fields.body = {
        'en-US': contentData.content.body
      };
    }
    
    // Add excerpt/description if available
    if (contentData.meta_description) {
      fields.excerpt = {
        'en-US': contentData.meta_description
      };
    }
    
    // Add keywords/tags if available
    if (contentData.keywords && contentData.keywords.length > 0) {
      fields.tags = {
        'en-US': contentData.keywords
      };
    }
    
    // Add categories if available
    if (contentData.categories && contentData.categories.length > 0) {
      fields.categories = {
        'en-US': contentData.categories
      };
    }
    
    // Add featured image if available
    if (contentData.featured_image) {
      // Note: In a real implementation, you would need to upload the image to Contentful
      // and link to the asset. This is a simplified version.
      fields.featuredImage = {
        'en-US': {
          sys: {
            type: 'Link',
            linkType: 'Asset',
            id: contentData.featured_image.id // This assumes the image is already in Contentful
          }
        }
      };
    }
    
    // Add SEO metadata if available
    if (contentData.seo) {
      fields.seoTitle = {
        'en-US': contentData.seo.title || contentData.title
      };
      
      fields.seoDescription = {
        'en-US': contentData.seo.description || contentData.meta_description
      };
      
      if (contentData.seo.keywords) {
        fields.seoKeywords = {
          'en-US': contentData.seo.keywords
        };
      }
    }
    
    return fields;
  }

  /**
   * Create a URL slug from a title
   * @param {string} title - Content title
   * @returns {string} - URL slug
   */
  createSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
  }

  /**
   * Update existing Contentful content
   * @param {string} entryId - Contentful entry ID
   * @param {Object} contentData - Updated content data
   * @returns {Object} - Updated entry data
   */
  async updateContent(entryId, contentData) {
    try {
      if (!this.isConnected) {
        throw new Error('Contentful integration is not connected');
      }
      
      this.logger.info(`Updating Contentful content ID: ${entryId}`);
      
      // Get existing entry
      const entry = await this.environment.getEntry(entryId);
      
      // Determine content type
      const contentType = entry.sys.contentType.sys.id;
      
      // Transform content data to Contentful format
      const fields = this.transformToContentfulFormat(contentData, contentType);
      
      // Update fields
      entry.fields = fields;
      
      // Save and publish changes
      const updatedEntry = await entry.update();
      const publishedEntry = await updatedEntry.publish();
      
      this.logger.info(`Content updated in Contentful. Entry ID: ${publishedEntry.sys.id}`);
      
      return {
        id: publishedEntry.sys.id,
        contentType: publishedEntry.sys.contentType.sys.id,
        url: `https://app.contentful.com/spaces/${this.config.spaceId}/entries/${publishedEntry.sys.id}`,
        status: 'published'
      };
    } catch (error) {
      this.logger.error(`Error updating Contentful content ID ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve content from Contentful
   * @param {string} entryId - Contentful entry ID
   * @returns {Object} - Content data
   */
  async retrieveContent(entryId) {
    try {
      if (!this.isConnected) {
        throw new Error('Contentful integration is not connected');
      }
      
      this.logger.info(`Retrieving Contentful content ID: ${entryId}`);
      
      // Fetch from Contentful with linked entries
      const entry = await this.deliveryClient.getEntry(entryId, {
        include: 2 // Include linked entries up to 2 levels deep
      });
      
      // Transform Contentful data to our format
      const contentData = this.transformFromContentfulFormat(entry);
      
      this.logger.info(`Content retrieved from Contentful: ${contentData.title}`);
      
      return contentData;
    } catch (error) {
      if (error.name === 'NotFound') {
        this.logger.warn(`Contentful content ID ${entryId} not found`);
        return null;
      }
      
      this.logger.error(`Error retrieving Contentful content ID ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * Transform Contentful data to our content format
   * @param {Object} entry - Contentful entry
   * @returns {Object} - Content data in our format
   */
  transformFromContentfulFormat(entry) {
    // Map Contentful content type to our content type
    const contentTypeMap = {
      'blogPost': 'blog',
      'landingPage': 'landing_page',
      'socialPost': 'social',
      'emailContent': 'email',
      'article': 'blog'
    };
    
    // Extract the content type
    const contentfulType = entry.sys.contentType.sys.id;
    const type = contentTypeMap[contentfulType] || 'blog';
    
    // Build the base content object
    const content = {
      title: entry.fields.title,
      content: {
        body: entry.fields.body,
        format: 'html'
      },
      meta_description: entry.fields.excerpt,
      type,
      status: entry.sys.publishedAt ? 'published' : 'draft',
      externalData: {
        id: entry.sys.id,
        url: `https://app.contentful.com/spaces/${this.config.spaceId}/entries/${entry.sys.id}`,
        provider: 'contentful',
        contentType: contentfulType,
        lastSynced: new Date()
      }
    };
    
    // Add keywords/tags if available
    if (entry.fields.tags) {
      content.keywords = entry.fields.tags;
    }
    
    // Add categories if available
    if (entry.fields.categories) {
      content.categories = entry.fields.categories;
    }
    
    // Add SEO data if available
    if (entry.fields.seoTitle || entry.fields.seoDescription) {
      content.seo = {
        title: entry.fields.seoTitle || entry.fields.title,
        description: entry.fields.seoDescription || entry.fields.excerpt,
        keywords: entry.fields.seoKeywords
      };
    }
    
    // Add featured image if available
    if (entry.fields.featuredImage) {
      const asset = entry.fields.featuredImage;
      
      if (asset.fields) {
        content.featured_image = {
          id: asset.sys.id,
          url: asset.fields.file.url,
          alt: asset.fields.description,
          title: asset.fields.title
        };
      }
    }
    
    return content;
  }

  /**
   * Import all content from Contentful
   * @param {Object} options - Import options
   * @returns {Array} - Imported content
   */
  async importAllContent(options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Contentful integration is not connected');
      }
      
      const { limit = 100, contentType } = options;
      
      this.logger.info(`Importing Contentful content. Limit: ${limit}, Content Type: ${contentType || 'all'}`);
      
      // Prepare query parameters
      const queryParams = {
        limit,
        include: 2, // Include linked entries up to 2 levels deep
        order: '-sys.updatedAt' // Most recently updated first
      };
      
      // Add content type filter if specified
      if (contentType) {
        queryParams['content_type'] = contentType;
      }
      
      // Fetch from Contentful
      const response = await this.deliveryClient.getEntries(queryParams);
      
      // Transform Contentful data to our format
      const importedContent = response.items.map(entry => this.transformFromContentfulFormat(entry));
      
      this.logger.info(`Imported ${importedContent.length} entries from Contentful`);
      
      return importedContent;
    } catch (error) {
      this.logger.error('Error importing Contentful content:', error);
      throw error;
    }
  }

  /**
   * Delete content from Contentful
   * @param {string} entryId - Contentful entry ID
   * @returns {boolean} - Success status
   */
  async deleteContent(entryId) {
    try {
      if (!this.isConnected) {
        throw new Error('Contentful integration is not connected');
      }
      
      this.logger.info(`Deleting Contentful content ID: ${entryId}`);
      
      // Get the entry
      const entry = await this.environment.getEntry(entryId);
      
      // Unpublish the entry first if it's published
      if (entry.isPublished()) {
        await entry.unpublish();
      }
      
      // Delete the entry
      await entry.delete();
      
      this.logger.info(`Content deleted from Contentful. Entry ID: ${entryId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error deleting Contentful content ID ${entryId}:`, error);
      throw error;
    }
  }

  /**
   * Shutdown the Contentful integration
   */
  async shutdown() {
    this.logger.info('Shutting down Contentful integration');
    this.isConnected = false;
    this.deliveryClient = null;
    this.managementClient = null;
    this.space = null;
    this.environment = null;
    return true;
  }
}

module.exports = ContentfulIntegration;