/**
 * Blog Generator Module
 * Generates blog posts based on content briefs and brand guidelines
 */

const BaseModule = require('../../../common/models/base-module');

class BlogGenerator extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'blog_generator';
  }
  
  async initialize() {
    this.logger.info('Initializing blog generator module');
    
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
    
    // Load AI website builder features
    try {
      const features = await this.storage.collections.product_features.find(
        { category: 'ai_website_builder' }
      ).toArray();
      
      if (features && features.length > 0) {
        this.productFeatures = features.map(f => ({
          name: f.name,
          description: f.description
        }));
        this.logger.info('Loaded product features', { count: features.length });
      } else {
        this.productFeatures = [
          { name: 'AI Content Generation', description: 'Automatically generate website content based on your business information' },
          { name: 'Smart Layout Recommendations', description: 'Get AI-powered layout recommendations optimized for your industry' },
          { name: 'Conversion Optimization', description: 'AI helps optimize your site for better conversion rates' }
        ];
        this.logger.warn('Product features not found, using defaults');
      }
    } catch (error) {
      this.logger.error('Error loading product features:', error);
      this.productFeatures = [
        { name: 'AI Content Generation', description: 'Automatically generate website content based on your business information' },
        { name: 'Smart Layout Recommendations', description: 'Get AI-powered layout recommendations optimized for your industry' },
        { name: 'Conversion Optimization', description: 'AI helps optimize your site for better conversion rates' }
      ];
    }
  }
  
  /**
   * Generate a blog post based on a content brief
   * @param {Object} brief - Content brief with topic, keywords, and other metadata
   * @returns {Object} Generated blog post content
   */
  async generate(brief) {
    this.logger.info('Generating blog post', { topic: brief.topic });
    
    // Extract necessary information from brief
    const { topic, keywords = [], target_audience, tone = 'informative' } = brief;
    const audienceInfo = typeof target_audience === 'string' ? target_audience : JSON.stringify(target_audience);
    
    // Construct the prompt for the AI
    const systemPrompt = `
You are a professional content writer for Landing Pad Digital, a company that offers an AI-powered website builder platform. 
Write in the following brand voice: ${this.brandVoice}.

The blog post should educate users about website creation and highlight Landing Pad Digital's AI website builder capabilities.

Key product features to mention:
${this.productFeatures.map(f => `- ${f.name}: ${f.description}`).join('\n')}

Format the blog post with proper headings (H2, H3), paragraphs, bullet points, and include a call-to-action at the end encouraging readers to try Landing Pad Digital's AI website builder.
    `;
    
    const userPrompt = `
Write a comprehensive blog post about "${topic}".

Target audience: ${audienceInfo}
Tone: ${tone}
Keywords to include: ${keywords.join(', ')}

Structure the blog post with:
1. An engaging introduction
2. 3-5 main sections with proper headings
3. Practical tips and actionable advice
4. A conclusion summarizing key points
5. A clear call-to-action encouraging readers to try Landing Pad Digital's AI website builder

Include a suggested meta description for SEO purposes.
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
        max_tokens: 3000
      });
      
      // Parse response to extract meta description and content
      const metaDescriptionMatch = response.match(/Meta Description:?\s*([^\n]+)/i);
      const metaDescription = metaDescriptionMatch ? metaDescriptionMatch[1].trim() : '';
      
      // Remove meta description from content if present
      let content = response;
      if (metaDescriptionMatch) {
        content = response.replace(metaDescriptionMatch[0], '').trim();
      }
      
      return {
        title: `${topic} - A Guide by Landing Pad Digital`,
        content,
        meta_description: metaDescription,
        author: 'Landing Pad Digital Team',
        estimated_reading_time: Math.ceil(content.split(' ').length / 200), // Approx. words per minute
        keywords
      };
    } catch (error) {
      this.logger.error('Error generating blog post:', error);
      throw new Error(`Failed to generate blog post: ${error.message}`);
    }
  }
  
  /**
   * Generate blog post outline
   * @param {Object} brief - Content brief
   * @returns {Object} Blog post outline
   */
  async generateOutline(brief) {
    this.logger.info('Generating blog post outline', { topic: brief.topic });
    
    const { topic, keywords = [], target_audience } = brief;
    const audienceInfo = typeof target_audience === 'string' ? target_audience : JSON.stringify(target_audience);
    
    const prompt = `
Create a detailed outline for a blog post about "${topic}".

Target audience: ${audienceInfo}
Keywords to include: ${keywords.join(', ')}

The outline should include:
1. Suggested title
2. Introduction (brief description)
3. 3-5 main sections with subpoints
4. Conclusion points
5. Call-to-action ideas

The blog should educate readers about website creation and subtly highlight Landing Pad Digital's AI website builder capabilities.
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });
      
      return {
        topic,
        outline: response,
        keywords
      };
    } catch (error) {
      this.logger.error('Error generating blog post outline:', error);
      throw new Error(`Failed to generate blog post outline: ${error.message}`);
    }
  }
  
  /**
   * Generate multiple blog post ideas for a topic area
   * @param {string} topicArea - General topic area
   * @param {number} count - Number of ideas to generate
   * @returns {Array} List of blog post ideas
   */
  async generateIdeas(topicArea, count = 5) {
    this.logger.info('Generating blog post ideas', { topicArea, count });
    
    const prompt = `
Generate ${count} unique and compelling blog post ideas related to "${topicArea}" for a company that offers an AI-powered website builder.

Each idea should:
1. Be relevant to website building, design, or online business
2. Appeal to people looking to create or improve their websites
3. Have educational value
4. Indirectly highlight the benefits of using AI for website creation

For each idea, provide:
- A catchy title
- A brief description (1-2 sentences)
- 3-5 relevant keywords
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1500
      });
      
      // Parse the response into structured format
      // This is a simplified parsing approach
      const ideas = [];
      const ideaBlocks = response.split(/\d+\.\s+/).filter(block => block.trim().length > 0);
      
      for (const block of ideaBlocks) {
        const titleMatch = block.match(/Title:?\s*([^\n]+)/i) || block.match(/^([^\n]+)/);
        const descriptionMatch = block.match(/Description:?\s*([^\n]+(?:\n[^\n]+)*)/i);
        const keywordsMatch = block.match(/Keywords:?\s*([^\n]+)/i);
        
        if (titleMatch) {
          ideas.push({
            title: titleMatch[1].trim(),
            description: descriptionMatch ? descriptionMatch[1].trim() : '',
            keywords: keywordsMatch 
              ? keywordsMatch[1].split(/,\s*/).map(k => k.trim()) 
              : []
          });
        }
      }
      
      return ideas.slice(0, count); // Ensure we return exactly the requested count
    } catch (error) {
      this.logger.error('Error generating blog post ideas:', error);
      throw new Error(`Failed to generate blog post ideas: ${error.message}`);
    }
  }
}

module.exports = BlogGenerator;