/**
 * Bluesky Integration Service
 * 
 * Handles integration with Bluesky's AT Protocol for posting content,
 * managing posts, and retrieving analytics data.
 */

const { BskyAgent } = require('@atproto/api');
const logger = require('../../common/services/logger');
const axios = require('axios');

class BlueskyIntegration {
  constructor(config) {
    this.config = config || {};
    this.isInitialized = false;
    this.agent = null;
    this.username = config?.username || null;
    this.appPassword = config?.appPassword || null;
    this.session = null;
  }

  /**
   * Initialize the Bluesky integration with required credentials
   * @param {Object} config - Configuration object containing credentials
   * @returns {Promise<boolean>} - True if initialization was successful
   */
  async initialize(config = {}) {
    try {
      this.config = { ...this.config, ...config };
      
      // Validate required configuration
      if (!this.config.username || !this.config.appPassword) {
        logger.error('Bluesky integration initialization failed: Missing username or appPassword');
        return false;
      }

      // Set required properties
      this.username = this.config.username;
      this.appPassword = this.config.appPassword;
      
      // Initialize Bluesky agent
      this.agent = new BskyAgent({
        service: 'https://bsky.social',
      });
      
      // Attempt to login
      try {
        const response = await this.agent.login({
          identifier: this.username,
          password: this.appPassword,
        });
        
        this.session = response.data;
        this.isInitialized = true;
        logger.info('Bluesky integration initialized successfully');
        return true;
      } catch (loginError) {
        logger.error(`Bluesky login failed: ${loginError.message}`, loginError);
        return false;
      }
    } catch (error) {
      logger.error(`Bluesky integration initialization failed: ${error.message}`, error);
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
      this.agent = null;
      this.session = null;
      logger.info('Bluesky integration shutdown successfully');
      return true;
    } catch (error) {
      logger.error(`Bluesky integration shutdown failed: ${error.message}`, error);
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
      platform: 'Bluesky',
      username: this.username,
      did: this.session?.did || null,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Refresh the session if needed
   * @returns {Promise<boolean>} - True if refresh was successful
   */
  async refreshSession() {
    try {
      // Attempt to login again
      const response = await this.agent.login({
        identifier: this.username,
        password: this.appPassword,
      });
      
      this.session = response.data;
      logger.info('Bluesky session refreshed successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to refresh Bluesky session: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Create a text post on Bluesky
   * @param {Object} postData - Post data with text
   * @returns {Promise<Object|null>} - Post response data or null if failed
   */
  async createPost(postData) {
    if (!this.isInitialized) {
      logger.error('Bluesky integration not initialized');
      return null;
    }

    try {
      const response = await this.agent.post({
        text: postData.text,
        langs: ['en'],
      });
      
      logger.info(`Bluesky post created successfully with URI: ${response.uri}`);
      return {
        uri: response.uri,
        cid: response.cid
      };
    } catch (error) {
      // If unauthorized, try to refresh session
      if (error.status === 401) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          try {
            const retryResponse = await this.agent.post({
              text: postData.text,
              langs: ['en'],
            });
            
            logger.info(`Bluesky post created successfully after session refresh with URI: ${retryResponse.uri}`);
            return {
              uri: retryResponse.uri,
              cid: retryResponse.cid
            };
          } catch (retryError) {
            logger.error(`Failed to create Bluesky post after session refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to create Bluesky post: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Create a post with an image on Bluesky
   * @param {Object} postData - Post data with text, image URL, alt text
   * @returns {Promise<Object|null>} - Post response data or null if failed
   */
  async createImagePost(postData) {
    if (!this.isInitialized) {
      logger.error('Bluesky integration not initialized');
      return null;
    }

    if (!postData.imageUrl) {
      logger.error('Image URL is required for Bluesky image post');
      return null;
    }

    try {
      // Download the image
      const imageBuffer = await this.fetchImageAsBuffer(postData.imageUrl);
      
      // Upload the image to Bluesky
      const uploadResult = await this.agent.uploadBlob(imageBuffer, {
        encoding: 'image/jpeg' // or determine dynamically based on image type
      });
      
      if (!uploadResult?.data?.blob) {
        logger.error('Failed to upload image to Bluesky: No blob data received');
        return null;
      }
      
      // Create post with the uploaded image
      const response = await this.agent.post({
        text: postData.text,
        langs: ['en'],
        embed: {
          $type: 'app.bsky.embed.images',
          images: [
            {
              alt: postData.altText || postData.text.substring(0, 300),
              image: uploadResult.data.blob
            }
          ]
        }
      });
      
      logger.info(`Bluesky image post created successfully with URI: ${response.uri}`);
      return {
        uri: response.uri,
        cid: response.cid
      };
    } catch (error) {
      // If unauthorized, try to refresh session
      if (error.status === 401) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          try {
            // Retry the whole image upload and post process
            const imageBuffer = await this.fetchImageAsBuffer(postData.imageUrl);
            const uploadResult = await this.agent.uploadBlob(imageBuffer, {
              encoding: 'image/jpeg'
            });
            
            if (!uploadResult?.data?.blob) {
              logger.error('Failed to upload image to Bluesky after session refresh: No blob data received');
              return null;
            }
            
            const retryResponse = await this.agent.post({
              text: postData.text,
              langs: ['en'],
              embed: {
                $type: 'app.bsky.embed.images',
                images: [
                  {
                    alt: postData.altText || postData.text.substring(0, 300),
                    image: uploadResult.data.blob
                  }
                ]
              }
            });
            
            logger.info(`Bluesky image post created successfully after session refresh with URI: ${retryResponse.uri}`);
            return {
              uri: retryResponse.uri,
              cid: retryResponse.cid
            };
          } catch (retryError) {
            logger.error(`Failed to create Bluesky image post after session refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to create Bluesky image post: ${error.message}`, error);
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
   * Get the user's profile information
   * @returns {Promise<Object|null>} - Profile data or null if failed
   */
  async getProfile() {
    if (!this.isInitialized) {
      logger.error('Bluesky integration not initialized');
      return null;
    }

    try {
      const response = await this.agent.getProfile({
        actor: this.session.did
      });
      
      return response.data;
    } catch (error) {
      // If unauthorized, try to refresh session
      if (error.status === 401) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          try {
            const retryResponse = await this.agent.getProfile({
              actor: this.session.did
            });
            
            return retryResponse.data;
          } catch (retryError) {
            logger.error(`Failed to get Bluesky profile after session refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to get Bluesky profile: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Get recent posts from the user
   * @param {Object} options - Options for filtering posts
   * @returns {Promise<Array|null>} - Array of posts or null if failed
   */
  async getRecentPosts(options = {}) {
    if (!this.isInitialized) {
      logger.error('Bluesky integration not initialized');
      return null;
    }

    try {
      const response = await this.agent.getAuthorFeed({
        actor: this.session.did,
        limit: options.limit || 10
      });
      
      logger.info(`Retrieved ${response.data.feed.length} recent Bluesky posts`);
      return response.data.feed;
    } catch (error) {
      // If unauthorized, try to refresh session
      if (error.status === 401) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          try {
            const retryResponse = await this.agent.getAuthorFeed({
              actor: this.session.did,
              limit: options.limit || 10
            });
            
            logger.info(`Retrieved ${retryResponse.data.feed.length} recent Bluesky posts after session refresh`);
            return retryResponse.data.feed;
          } catch (retryError) {
            logger.error(`Failed to get Bluesky posts after session refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to get Bluesky posts: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Delete a post on Bluesky
   * @param {string} uri - URI of the post to delete
   * @returns {Promise<boolean>} - True if deletion was successful
   */
  async deletePost(uri) {
    if (!this.isInitialized) {
      logger.error('Bluesky integration not initialized');
      return false;
    }

    try {
      await this.agent.deletePost(uri);
      logger.info(`Bluesky post deleted successfully: ${uri}`);
      return true;
    } catch (error) {
      // If unauthorized, try to refresh session
      if (error.status === 401) {
        const refreshed = await this.refreshSession();
        if (refreshed) {
          try {
            await this.agent.deletePost(uri);
            logger.info(`Bluesky post deleted successfully after session refresh: ${uri}`);
            return true;
          } catch (retryError) {
            logger.error(`Failed to delete Bluesky post after session refresh: ${retryError.message}`, retryError);
          }
        }
      }
      
      logger.error(`Failed to delete Bluesky post: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Create a thread of posts on Bluesky
   * @param {Array<string>} threadPosts - Array of text for each post in the thread
   * @returns {Promise<Array|null>} - Array of post URIs or null if failed
   */
  async createThread(threadPosts) {
    if (!this.isInitialized) {
      logger.error('Bluesky integration not initialized');
      return null;
    }

    if (!threadPosts || !threadPosts.length) {
      logger.error('Thread posts array is required for Bluesky thread');
      return null;
    }

    try {
      const results = [];
      let parentPost = null;
      
      // Create each post in the thread
      for (let i = 0; i < threadPosts.length; i++) {
        const postText = threadPosts[i];
        
        // For the first post, create a regular post
        if (i === 0) {
          const response = await this.agent.post({
            text: postText,
            langs: ['en'],
          });
          
          results.push({
            uri: response.uri,
            cid: response.cid
          });
          
          parentPost = {
            uri: response.uri,
            cid: response.cid
          };
        } 
        // For subsequent posts, create replies
        else {
          const response = await this.agent.post({
            text: postText,
            langs: ['en'],
            reply: {
              root: {
                uri: results[0].uri,
                cid: results[0].cid
              },
              parent: {
                uri: parentPost.uri,
                cid: parentPost.cid
              }
            }
          });
          
          results.push({
            uri: response.uri,
            cid: response.cid
          });
          
          parentPost = {
            uri: response.uri,
            cid: response.cid
          };
        }
      }
      
      logger.info(`Bluesky thread created successfully with ${results.length} posts`);
      return results;
    } catch (error) {
      logger.error(`Failed to create Bluesky thread: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Map content from internal format to Bluesky format
   * @param {Object} content - Internal content object
   * @returns {Object} - Bluesky-formatted content object
   */
  mapContentToBluesky(content) {
    // Extract relevant fields from the content object
    const {
      title,
      body,
      summary,
      images
    } = content;
    
    // Format the text - Bluesky has a 300 character limit per post
    const fullText = `${title}\n\n${body}`;
    
    // If the content is short enough for a single post
    if (fullText.length <= 300) {
      // If there's an image, create an image post
      if (images && images.length > 0) {
        return {
          type: 'image',
          text: fullText,
          imageUrl: images[0].url,
          altText: images[0].alt || summary || title
        };
      }
      
      // Text post
      return {
        type: 'text',
        text: fullText
      };
    }
    
    // For longer content, create a thread
    // Split into chunks of 300 characters, trying to break at sentence boundaries
    const chunks = this.splitTextIntoChunks(fullText, 300);
    
    // If there's an image, add it to the first post
    if (images && images.length > 0) {
      return {
        type: 'thread',
        firstPost: {
          type: 'image',
          text: chunks[0],
          imageUrl: images[0].url,
          altText: images[0].alt || summary || title
        },
        remainingPosts: chunks.slice(1)
      };
    }
    
    return {
      type: 'thread',
      posts: chunks
    };
  }

  /**
   * Split text into chunks of maximum length, trying to break at sentence boundaries
   * @param {string} text - Text to split
   * @param {number} maxLength - Maximum length of each chunk
   * @returns {Array<string>} - Array of text chunks
   */
  splitTextIntoChunks(text, maxLength = 300) {
    const chunks = [];
    let remainingText = text;
    
    while (remainingText.length > 0) {
      if (remainingText.length <= maxLength) {
        chunks.push(remainingText);
        break;
      }
      
      // Try to find a sentence boundary within the last 40 characters of the maxLength
      let endPos = maxLength;
      const lastSentenceBreak = remainingText.substring(maxLength - 40, maxLength).lastIndexOf('. ');
      
      if (lastSentenceBreak !== -1) {
        endPos = maxLength - 40 + lastSentenceBreak + 1; // Include the period
      } else {
        // If no sentence break, try to find a paragraph break
        const lastParagraphBreak = remainingText.substring(0, maxLength).lastIndexOf('\n\n');
        if (lastParagraphBreak !== -1) {
          endPos = lastParagraphBreak + 2; // Include the newlines
        } else {
          // If no paragraph break, try to find a line break
          const lastLineBreak = remainingText.substring(0, maxLength).lastIndexOf('\n');
          if (lastLineBreak !== -1) {
            endPos = lastLineBreak + 1; // Include the newline
          } else {
            // If no line break, try to find a space
            const lastSpace = remainingText.substring(0, maxLength).lastIndexOf(' ');
            if (lastSpace !== -1) {
              endPos = lastSpace + 1; // Include the space
            }
          }
        }
      }
      
      chunks.push(remainingText.substring(0, endPos).trim());
      remainingText = remainingText.substring(endPos).trim();
    }
    
    return chunks;
  }
}

module.exports = BlueskyIntegration;