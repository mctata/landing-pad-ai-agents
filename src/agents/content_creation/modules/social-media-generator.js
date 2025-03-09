/**
 * Social Media Generator Module
 * Generates social media posts for various platforms
 */

const BaseModule = require('../../../common/models/base-module');

class SocialMediaGenerator extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'social_media_generator';
    this.platforms = [
      'twitter', 'linkedin', 'facebook', 'instagram'
    ];
  }
  
  async initialize() {
    this.logger.info('Initializing social media generator module');
    
    // Load brand voice guidelines
    try {
      const brandGuidelines = await this.storage.collections.brand_guidelines.findOne(
        { type: 'voice' }
      );
      
      if (brandGuidelines) {
        this.brandVoice = brandGuidelines.content;
        this.logger.info('Loaded brand voice guidelines');
      } else {
        this.brandVoice = 'Professional, informative, and helpful voice that positions Landing Pad Digital as an authority in website building.';
        this.logger.warn('Brand voice guidelines not found, using default');
      }
    } catch (error) {
      this.logger.error('Error loading brand voice guidelines:', error);
      this.brandVoice = 'Professional, informative, and helpful voice that positions Landing Pad Digital as an authority in website building.';
    }
    
    // Load platform-specific guidelines
    this.platformGuidelines = {
      twitter: {
        maxLength: 280,
        hashtags: true,
        tone: 'concise and engaging'
      },
      linkedin: {
        maxLength: 3000,
        hashtags: true,
        tone: 'professional and informative'
      },
      facebook: {
        maxLength: 5000,
        hashtags: false,
        tone: 'friendly and conversational'
      },
      instagram: {
        maxLength: 2200,
        hashtags: true,
        tone: 'visual and inspirational'
      }
    };
    
    // Load custom hashtags
    try {
      const hashtagData = await this.storage.collections.hashtags.find().toArray();
      
      if (hashtagData && hashtagData.length > 0) {
        this.hashtags = hashtagData.reduce((acc, item) => {
          acc[item.category] = item.tags;
          return acc;
        }, {});
        this.logger.info('Loaded custom hashtags', { 
          categories: Object.keys(this.hashtags).length 
        });
      } else {
        this.hashtags = {
          website_building: ['WebsiteBuilder', 'WebDesign', 'DigitalPresence'],
          ai_technology: ['AIWebsite', 'AIBuilder', 'FutureOfWeb'],
          business: ['SmallBusiness', 'Entrepreneurs', 'GrowYourBusiness']
        };
        this.logger.warn('Custom hashtags not found, using defaults');
      }
    } catch (error) {
      this.logger.error('Error loading custom hashtags:', error);
      this.hashtags = {
        website_building: ['WebsiteBuilder', 'WebDesign', 'DigitalPresence'],
        ai_technology: ['AIWebsite', 'AIBuilder', 'FutureOfWeb'],
        business: ['SmallBusiness', 'Entrepreneurs', 'GrowYourBusiness']
      };
    }
  }
  
  /**
   * Generate social media content based on a content brief
   * @param {Object} brief - Content brief with topic, platforms, and other metadata
   * @returns {Object} Generated social media content for specified platforms
   */
  async generate(brief) {
    const { topic, platforms = ['linkedin', 'twitter'], keywords = [], url = null } = brief;
    
    this.logger.info('Generating social media content', { topic, platforms });
    
    // Select relevant platforms
    const targetPlatforms = platforms.filter(p => 
      this.platforms.includes(p.toLowerCase())
    );
    
    if (targetPlatforms.length === 0) {
      // Default to LinkedIn and Twitter if no valid platforms specified
      targetPlatforms.push('linkedin', 'twitter');
    }
    
    // Generate content for each platform
    const socialPosts = {};
    
    for (const platform of targetPlatforms) {
      socialPosts[platform] = await this._generateForPlatform(
        platform.toLowerCase(),
        topic,
        keywords,
        url
      );
    }
    
    return {
      topic,
      posts: socialPosts,
      generated_at: new Date()
    };
  }
  
  /**
   * Generate a batch of social media posts for a campaign
   * @param {Object} campaign - Campaign details
   * @param {number} count - Number of posts to generate per platform
   * @returns {Object} Batch of social media posts
   */
  async generateBatch(campaign, count = 5) {
    const { topic, platforms = ['linkedin', 'twitter'], keywords = [] } = campaign;
    
    this.logger.info('Generating batch of social media posts', { 
      topic, 
      platforms, 
      count 
    });
    
    // Select relevant platforms
    const targetPlatforms = platforms.filter(p => 
      this.platforms.includes(p.toLowerCase())
    );
    
    if (targetPlatforms.length === 0) {
      targetPlatforms.push('linkedin', 'twitter');
    }
    
    // Generate batches for each platform
    const batches = {};
    
    for (const platform of targetPlatforms) {
      batches[platform] = await this._generateBatchForPlatform(
        platform.toLowerCase(),
        topic,
        keywords,
        count
      );
    }
    
    return {
      topic,
      batches,
      count_per_platform: count,
      generated_at: new Date()
    };
  }
  
  /**
   * Generate social media content for a specific platform
   * @private
   */
  async _generateForPlatform(platform, topic, keywords, url) {
    const guidelines = this.platformGuidelines[platform] || {
      maxLength: 1000,
      hashtags: true,
      tone: 'professional'
    };
    
    // Select relevant hashtags
    let relevantHashtags = this._selectRelevantHashtags(keywords, 3);
    
    // Create prompt for the AI
    const systemPrompt = `
You are a social media specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Write in a ${guidelines.tone} tone, aligned with the brand voice: ${this.brandVoice}.

Your content should educate users about website creation and highlight Landing Pad Digital's AI website builder capabilities.
    `;
    
    const userPrompt = `
Create a compelling ${platform} post about "${topic}".

${url ? `The post should include this URL: ${url}` : ''}
${guidelines.hashtags ? `Include these hashtags: ${relevantHashtags.map(tag => '#' + tag).join(' ')}` : ''}

The post should:
1. Be engaging and shareable
2. Provide value to readers
3. Highlight how AI website builders make creating websites easier
4. Include a clear call-to-action
5. Stay within ${guidelines.maxLength} characters

Keywords to include: ${keywords.join(', ')}
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });
      
      // Clean up the response
      let content = response.trim();
      
      // Ensure we don't exceed platform character limits
      if (content.length > guidelines.maxLength) {
        content = content.substring(0, guidelines.maxLength);
      }
      
      return {
        content,
        platform,
        hashtags: guidelines.hashtags ? relevantHashtags : [],
        char_count: content.length,
        url
      };
    } catch (error) {
      this.logger.error(`Error generating ${platform} post:`, error);
      throw new Error(`Failed to generate ${platform} post: ${error.message}`);
    }
  }
  
  /**
   * Generate a batch of posts for a specific platform
   * @private
   */
  async _generateBatchForPlatform(platform, topic, keywords, count) {
    const guidelines = this.platformGuidelines[platform] || {
      maxLength: 1000,
      hashtags: true,
      tone: 'professional'
    };
    
    // Select relevant hashtags
    let relevantHashtags = this._selectRelevantHashtags(keywords, 5);
    
    // Create prompt for the AI
    const systemPrompt = `
You are a social media specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Write in a ${guidelines.tone} tone, aligned with the brand voice: ${this.brandVoice}.

Your content should educate users about website creation and highlight Landing Pad Digital's AI website builder capabilities.
    `;
    
    const userPrompt = `
Create ${count} unique and engaging ${platform} posts about "${topic}".

${guidelines.hashtags ? 'Include 2-3 relevant hashtags in each post.' : ''}

Each post should:
1. Be distinct from the others
2. Be engaging and shareable
3. Provide value to readers
4. Highlight how AI website builders make creating websites easier
5. Include a clear call-to-action
6. Stay within ${guidelines.maxLength} characters

Format your response as:
Post 1:
[Post content]

Post 2:
[Post content]

And so on...

Keywords to include across the posts: ${keywords.join(', ')}
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 2500
      });
      
      // Parse response into individual posts
      const posts = [];
      const postBlocks = response.split(/Post \d+:\s*/i).filter(block => block.trim().length > 0);
      
      for (let i = 0; i < Math.min(postBlocks.length, count); i++) {
        const content = postBlocks[i].trim();
        
        // Use a subset of hashtags for each post
        const postHashtags = guidelines.hashtags 
          ? this._selectRandomSubset(relevantHashtags, 3)
          : [];
        
        posts.push({
          content: content.length > guidelines.maxLength 
            ? content.substring(0, guidelines.maxLength)
            : content,
          platform,
          hashtags: postHashtags,
          char_count: content.length,
          post_number: i + 1
        });
      }
      
      return posts;
    } catch (error) {
      this.logger.error(`Error generating ${platform} post batch:`, error);
      throw new Error(`Failed to generate ${platform} post batch: ${error.message}`);
    }
  }
  
  /**
   * Select relevant hashtags based on keywords
   * @private
   */
  _selectRelevantHashtags(keywords, count) {
    const allRelevantTags = [];
    
    // Find relevant hashtags from our categories
    for (const [category, tags] of Object.entries(this.hashtags)) {
      // Check if any keyword matches this category
      const categoryWords = category.split('_');
      const isRelevant = keywords.some(keyword => 
        categoryWords.some(word => 
          keyword.toLowerCase().includes(word.toLowerCase())
        )
      );
      
      if (isRelevant) {
        allRelevantTags.push(...tags);
      }
    }
    
    // Add some general website builder hashtags
    allRelevantTags.push(...(this.hashtags.website_building || []));
    
    // Add some AI technology hashtags
    allRelevantTags.push(...(this.hashtags.ai_technology || []));
    
    // Select random subset
    return this._selectRandomSubset(
      [...new Set(allRelevantTags)], // Remove duplicates
      count
    );
  }
  
  /**
   * Select a random subset of items from an array
   * @private
   */
  _selectRandomSubset(array, count) {
    if (array.length <= count) {
      return array;
    }
    
    const result = [];
    const copyArray = [...array];
    
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * copyArray.length);
      result.push(copyArray[randomIndex]);
      copyArray.splice(randomIndex, 1);
    }
    
    return result;
  }
}

module.exports = SocialMediaGenerator;