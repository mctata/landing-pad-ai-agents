/**
 * Twitter/X Integration
 * Handles content publishing and analytics retrieval from Twitter/X
 */

const { TwitterApi } = require('twitter-api-v2');

class TwitterIntegration {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.isConnected = false;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.accessToken = config.accessToken;
    this.accessTokenSecret = config.accessTokenSecret;
    this.client = null;
  }

  /**
   * Initialize the Twitter integration
   */
  async initialize() {
    try {
      if (!this.config.enabled) {
        this.logger.info('Twitter integration is disabled');
        return false;
      }

      this.logger.info('Initializing Twitter integration');
      
      // Create Twitter client
      this.client = new TwitterApi({
        appKey: this.apiKey,
        appSecret: this.apiSecret,
        accessToken: this.accessToken,
        accessSecret: this.accessTokenSecret
      });
      
      // Test connection
      await this.testConnection();
      this.isConnected = true;
      
      this.logger.info('Twitter integration initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Twitter integration:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Test the Twitter connection
   */
  async testConnection() {
    try {
      // Get current user to verify credentials
      const currentUser = await this.client.v2.me();
      
      this.logger.info(`Twitter connection successful. Connected as: @${currentUser.data.username}`);
      return true;
    } catch (error) {
      this.logger.error('Twitter connection test failed:', error);
      throw error;
    }
  }

  /**
   * Publish content to Twitter
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published tweet data
   */
  async publishContent(contentData) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Twitter integration is not connected');
      }
      
      this.logger.info('Publishing content to Twitter');
      
      // Create tweet text from content
      const tweetText = this.createTweetText(contentData);
      
      // Send tweet
      const tweet = await this.client.v2.tweet(tweetText);
      
      this.logger.info(`Content published to Twitter. Tweet ID: ${tweet.data.id}`);
      
      return {
        id: tweet.data.id,
        url: `https://twitter.com/user/status/${tweet.data.id}`,
        platform: 'twitter'
      };
    } catch (error) {
      this.logger.error('Error publishing content to Twitter:', error);
      throw error;
    }
  }

  /**
   * Create tweet text from content data
   * @param {Object} contentData - Content data
   * @returns {string} - Tweet text
   */
  createTweetText(contentData) {
    // Create tweet text with title and URL (if available)
    let tweetText = contentData.title;
    
    // Add URL if available
    if (contentData.url) {
      tweetText += ` ${contentData.url}`;
    }
    
    // Add hashtags from keywords
    if (contentData.keywords && contentData.keywords.length > 0) {
      // Take up to 3 keywords and convert to hashtags
      const hashtags = contentData.keywords
        .slice(0, 3)
        .map(keyword => `#${keyword.replace(/\s+/g, '')}`)
        .join(' ');
      
      // Add hashtags if there's room
      if (tweetText.length + hashtags.length + 1 <= 280) {
        tweetText += ` ${hashtags}`;
      }
    }
    
    // Ensure tweet is within character limit
    if (tweetText.length > 280) {
      tweetText = tweetText.substring(0, 277) + '...';
    }
    
    return tweetText;
  }

  /**
   * Publish a thread of tweets
   * @param {Object} contentData - Content data to publish
   * @returns {Object} - Published thread data
   */
  async publishThread(contentData) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Twitter integration is not connected');
      }
      
      this.logger.info('Publishing thread to Twitter');
      
      // Create an array of tweets from content
      const tweetTexts = this.createThreadFromContent(contentData);
      
      let previousTweetId = null;
      const tweetIds = [];
      
      // Post each tweet in the thread
      for (const tweetText of tweetTexts) {
        // If it's the first tweet, post normally
        if (!previousTweetId) {
          const tweet = await this.client.v2.tweet(tweetText);
          previousTweetId = tweet.data.id;
          tweetIds.push(tweet.data.id);
        } else {
          // Otherwise, reply to the previous tweet
          const tweet = await this.client.v2.reply(tweetText, previousTweetId);
          previousTweetId = tweet.data.id;
          tweetIds.push(tweet.data.id);
        }
      }
      
      this.logger.info(`Thread published to Twitter. First tweet ID: ${tweetIds[0]}`);
      
      return {
        id: tweetIds[0],
        url: `https://twitter.com/user/status/${tweetIds[0]}`,
        threadIds: tweetIds,
        platform: 'twitter'
      };
    } catch (error) {
      this.logger.error('Error publishing thread to Twitter:', error);
      throw error;
    }
  }

  /**
   * Create a thread of tweets from content
   * @param {Object} contentData - Content data
   * @returns {Array} - Array of tweet texts
   */
  createThreadFromContent(contentData) {
    const tweets = [];
    
    // Add title as first tweet
    let firstTweet = contentData.title;
    
    // Add URL if available
    if (contentData.url) {
      firstTweet += ` ${contentData.url}`;
    }
    
    // Add hashtags from keywords to first tweet
    if (contentData.keywords && contentData.keywords.length > 0) {
      const hashtags = contentData.keywords
        .slice(0, 3)
        .map(keyword => `#${keyword.replace(/\s+/g, '')}`)
        .join(' ');
      
      // Add hashtags if there's room
      if (firstTweet.length + hashtags.length + 1 <= 280) {
        firstTweet += ` ${hashtags}`;
      }
    }
    
    tweets.push(firstTweet);
    
    // Split content into tweets
    if (contentData.content && contentData.content.body) {
      // Simple split by paragraphs then by character limit
      const paragraphs = contentData.content.body
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .split(/\n\n+/);
      
      let currentTweet = '';
      
      for (const paragraph of paragraphs) {
        // If paragraph fits into current tweet, add it
        if (currentTweet.length + paragraph.length + 1 <= 280) {
          currentTweet += (currentTweet ? '\n\n' : '') + paragraph;
        } else {
          // If currentTweet is not empty, add it to tweets array
          if (currentTweet) {
            tweets.push(currentTweet);
            currentTweet = '';
          }
          
          // If paragraph is longer than 280 chars, split it
          if (paragraph.length > 280) {
            const words = paragraph.split(' ');
            currentTweet = words[0];
            
            for (let i = 1; i < words.length; i++) {
              if (currentTweet.length + words[i].length + 1 <= 280) {
                currentTweet += ' ' + words[i];
              } else {
                tweets.push(currentTweet);
                currentTweet = words[i];
              }
            }
          } else {
            currentTweet = paragraph;
          }
        }
      }
      
      // Add the last tweet if not empty
      if (currentTweet) {
        tweets.push(currentTweet);
      }
    }
    
    return tweets;
  }

  /**
   * Get metrics for a tweet
   * @param {string} tweetId - Tweet ID
   * @returns {Object} - Tweet metrics
   */
  async getTweetMetrics(tweetId) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Twitter integration is not connected');
      }
      
      this.logger.info(`Getting metrics for tweet ID: ${tweetId}`);
      
      // Get tweet with public metrics
      const tweet = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': 'public_metrics,created_at'
      });
      
      if (!tweet || !tweet.data) {
        this.logger.warn(`Tweet ID ${tweetId} not found`);
        return null;
      }
      
      // Transform to our metrics format
      const metrics = {
        id: tweetId,
        platform: 'twitter',
        impressions: tweet.data.public_metrics.impression_count || 0,
        engagements: {
          likes: tweet.data.public_metrics.like_count || 0,
          retweets: tweet.data.public_metrics.retweet_count || 0,
          replies: tweet.data.public_metrics.reply_count || 0,
          quotes: tweet.data.public_metrics.quote_count || 0
        },
        totalEngagements: (
          (tweet.data.public_metrics.like_count || 0) +
          (tweet.data.public_metrics.retweet_count || 0) +
          (tweet.data.public_metrics.reply_count || 0) +
          (tweet.data.public_metrics.quote_count || 0)
        ),
        timestamp: new Date(tweet.data.created_at),
        retrievedAt: new Date()
      };
      
      return metrics;
    } catch (error) {
      this.logger.error(`Error getting metrics for tweet ID ${tweetId}:`, error);
      throw error;
    }
  }

  /**
   * Shutdown the Twitter integration
   */
  async shutdown() {
    this.logger.info('Shutting down Twitter integration');
    this.isConnected = false;
    this.client = null;
    return true;
  }
}

module.exports = TwitterIntegration;