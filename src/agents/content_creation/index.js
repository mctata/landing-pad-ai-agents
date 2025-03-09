/**
 * Content Creation Agent
 * Generates high-quality blog posts, website copy, and social media content
 */

const BaseAgent = require('../../common/models/base-agent');

class ContentCreationAgent extends BaseAgent {
  constructor(config, messaging, storage, logger, aiProvider) {
    super(config, messaging, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'content_creation';
  }
  
  async initialize() {
    await super.initialize();
    
    // Subscribe to relevant events from other agents
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_strategy.brief_created',
      this.handleBriefCreatedEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'brand_consistency.content_evaluation_completed',
      this.handleContentEvaluationEvent.bind(this)
    );
  }
  
  /**
   * Handle brief created event from Content Strategy Agent
   */
  async handleBriefCreatedEvent(event) {
    this.logger.info('Received brief created event', { briefId: event.payload.brief_id });
    
    // Auto-generation can be toggled in configuration
    if (this.config.auto_generate_from_briefs) {
      await this.handleGenerateContentCommand({
        type: 'generate_content',
        id: this._generateId(),
        agent: this.name,
        payload: {
          briefId: event.payload.brief_id
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle content evaluation event from Brand Consistency Agent
   */
  async handleContentEvaluationEvent(event) {
    this.logger.info('Received content evaluation event', { 
      contentId: event.payload.content_id,
      score: event.payload.score
    });
    
    // If the content needs revision based on brand guidelines
    if (event.payload.score < event.payload.threshold && event.payload.suggestions) {
      await this.handleReviseContentCommand({
        type: 'revise_content',
        id: this._generateId(),
        agent: this.name,
        payload: {
          contentId: event.payload.content_id,
          revisionType: 'brand_consistency',
          suggestions: event.payload.suggestions
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Generate content based on a brief
   */
  async handleGenerateContentCommand(command) {
    const { briefId } = command.payload;
    
    this.logger.info('Generating content', { briefId });
    
    // Retrieve brief
    const brief = await this.storage.collections.content_briefs.findOne(
      { _id: this.storage.ObjectId(briefId) }
    );
    
    if (!brief) {
      throw new Error(`Brief not found: ${briefId}`);
    }
    
    // Select appropriate generator module based on content type
    let generatorModule;
    
    switch (brief.type) {
      case 'blog_post':
        generatorModule = this.modules.get('blog_generator');
        break;
      case 'social_campaign':
        generatorModule = this.modules.get('social_media_generator');
        break;
      case 'landing_page':
        generatorModule = this.modules.get('landing_page_generator');
        break;
      default:
        throw new Error(`Unsupported content type: ${brief.type}`);
    }
    
    if (!generatorModule) {
      throw new Error(`Generator module not available for type: ${brief.type}`);
    }
    
    // Generate content
    const generatedContent = await generatorModule.generate(brief);
    
    // Create and save content
    const content = {
      brief_id: briefId,
      type: brief.type,
      title: generatedContent.title,
      body: generatedContent.body,
      metadata: generatedContent.metadata,
      status: 'draft',
      created_at: new Date(),
      created_by: command.payload.userId || 'system'
    };
    
    const result = await this.storage.collections.content.insertOne(content);
    
    this.logger.info('Content generated', { 
      contentId: result.insertedId,
      briefId
    });
    
    // Notify other agents about new content
    await this.publishEvent('content_created', {
      content_id: result.insertedId,
      brief_id: briefId,
      type: brief.type
    });
    
    return {
      content_id: result.insertedId,
      title: generatedContent.title,
      type: brief.type
    };
  }
  
  /**
   * Edit existing content
   */
  async handleEditContentCommand(command) {
    const { contentId, updates } = command.payload;
    
    this.logger.info('Editing content', { contentId });
    
    const updateResult = await this.storage.collections.content.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          ...updates,
          status: 'edited',
          updated_at: new Date(),
          updated_by: command.payload.userId || 'system'
        } 
      }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    this.logger.info('Content edited', { contentId });
    
    await this.publishEvent('content_edited', {
      content_id: contentId,
      updates: Object.keys(updates)
    });
    
    const updatedContent = await this.storage.collections.content.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    return { content: updatedContent };
  }
  
  /**
   * Revise content based on feedback (e.g., brand consistency, SEO)
   */
  async handleReviseContentCommand(command) {
    const { contentId, revisionType, suggestions } = command.payload;
    
    this.logger.info('Revising content', { contentId, revisionType });
    
    // Get the content
    const content = await this.storage.collections.content.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get brief if needed
    const brief = await this.storage.collections.content_briefs.findOne(
      { _id: this.storage.ObjectId(content.brief_id) }
    );
    
    // Select appropriate module based on content type
    let generatorModule;
    
    switch (content.type) {
      case 'blog_post':
        generatorModule = this.modules.get('blog_generator');
        break;
      case 'social_campaign':
        generatorModule = this.modules.get('social_media_generator');
        break;
      case 'landing_page':
        generatorModule = this.modules.get('landing_page_generator');
        break;
      default:
        throw new Error(`Unsupported content type: ${content.type}`);
    }
    
    if (!generatorModule) {
      throw new Error(`Generator module not available for type: ${content.type}`);
    }
    
    // Revise content
    const revisedContent = await generatorModule.revise(content, revisionType, suggestions, brief);
    
    // Update content
    const updateResult = await this.storage.collections.content.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          title: revisedContent.title || content.title,
          body: revisedContent.body,
          metadata: { ...content.metadata, ...revisedContent.metadata },
          status: 'revised',
          revision_history: [
            ...(content.revision_history || []),
            {
              type: revisionType,
              suggestions,
              timestamp: new Date()
            }
          ],
          updated_at: new Date(),
          updated_by: command.payload.userId || 'system'
        } 
      }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error(`Failed to update content: ${contentId}`);
    }
    
    this.logger.info('Content revised', { contentId, revisionType });
    
    await this.publishEvent('content_revised', {
      content_id: contentId,
      revision_type: revisionType
    });
    
    const updatedContent = await this.storage.collections.content.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    return { content: updatedContent };
  }
  
  /**
   * Generate multiple social media posts for a piece of content
   */
  async handleGenerateSocialPostsCommand(command) {
    const { contentId, platforms, count } = command.payload;
    
    this.logger.info('Generating social media posts', { 
      contentId, 
      platforms: platforms || 'all',
      count: count || 3
    });
    
    // Get the content
    const content = await this.storage.collections.content.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get social media generator
    const socialGenerator = this.modules.get('social_media_generator');
    if (!socialGenerator) {
      throw new Error('Social media generator module not available');
    }
    
    // Generate social posts
    const socialPosts = await socialGenerator.generatePostsFromContent(
      content,
      platforms || ['twitter', 'linkedin', 'facebook'],
      count || 3
    );
    
    // Save social posts
    const socialContent = {
      source_content_id: contentId,
      type: 'social_posts',
      platforms: platforms || ['twitter', 'linkedin', 'facebook'],
      posts: socialPosts,
      status: 'draft',
      created_at: new Date(),
      created_by: command.payload.userId || 'system'
    };
    
    const result = await this.storage.collections.content.insertOne(socialContent);
    
    this.logger.info('Social media posts generated', { 
      socialContentId: result.insertedId,
      sourceContentId: contentId,
      count: socialPosts.length
    });
    
    // Notify other agents
    await this.publishEvent('social_posts_created', {
      content_id: result.insertedId,
      source_content_id: contentId,
      count: socialPosts.length
    });
    
    return {
      content_id: result.insertedId,
      posts: socialPosts
    };
  }
  
  /**
   * Generate headlines/titles for content
   */
  async handleGenerateHeadlinesCommand(command) {
    const { topic, keywords, count, type } = command.payload;
    
    this.logger.info('Generating headlines', { 
      topic, 
      type: type || 'blog_post',
      count: count || 5
    });
    
    // Get appropriate generator
    let generatorModule;
    
    switch (type || 'blog_post') {
      case 'blog_post':
        generatorModule = this.modules.get('blog_generator');
        break;
      case 'social_campaign':
        generatorModule = this.modules.get('social_media_generator');
        break;
      case 'landing_page':
        generatorModule = this.modules.get('landing_page_generator');
        break;
      default:
        generatorModule = this.modules.get('blog_generator');
    }
    
    if (!generatorModule) {
      throw new Error('No generator module available for headlines');
    }
    
    // Generate headlines
    const headlines = await generatorModule.generateHeadlines(
      topic,
      keywords || [],
      count || 5
    );
    
    return { headlines };
  }
  
  /**
   * Generate calls-to-action for content
   */
  async handleGenerateCtasCommand(command) {
    const { contentType, targetAudience, goal, count } = command.payload;
    
    this.logger.info('Generating CTAs', { 
      contentType, 
      targetAudience,
      goal: goal || 'conversion',
      count: count || 3
    });
    
    // Get appropriate generator based on content type
    let generatorModule;
    
    switch (contentType) {
      case 'blog_post':
        generatorModule = this.modules.get('blog_generator');
        break;
      case 'social_campaign':
        generatorModule = this.modules.get('social_media_generator');
        break;
      case 'landing_page':
        generatorModule = this.modules.get('landing_page_generator');
        break;
      default:
        generatorModule = this.modules.get('landing_page_generator');
    }
    
    if (!generatorModule) {
      throw new Error(`Generator module not available for type: ${contentType}`);
    }
    
    // Generate CTAs
    const ctas = await generatorModule.generateCTAs(
      targetAudience,
      goal || 'conversion',
      count || 3
    );
    
    return { ctas };
  }
  
  /**
   * Enhance content with additional sections or elements
   */
  async handleEnhanceContentCommand(command) {
    const { contentId, enhancements } = command.payload;
    
    this.logger.info('Enhancing content', { 
      contentId, 
      enhancements: Object.keys(enhancements)
    });
    
    // Get the content
    const content = await this.storage.collections.content.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!content) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Select appropriate module
    let generatorModule;
    
    switch (content.type) {
      case 'blog_post':
        generatorModule = this.modules.get('blog_generator');
        break;
      case 'social_campaign':
        generatorModule = this.modules.get('social_media_generator');
        break;
      case 'landing_page':
        generatorModule = this.modules.get('landing_page_generator');
        break;
      default:
        throw new Error(`Unsupported content type: ${content.type}`);
    }
    
    if (!generatorModule) {
      throw new Error(`Generator module not available for type: ${content.type}`);
    }
    
    // Enhance content
    const enhancedContent = await generatorModule.enhance(content, enhancements);
    
    // Update the content
    const updateResult = await this.storage.collections.content.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          body: enhancedContent.body,
          metadata: { ...content.metadata, ...enhancedContent.metadata },
          status: 'enhanced',
          updated_at: new Date(),
          updated_by: command.payload.userId || 'system',
          enhancements: [...(content.enhancements || []), ...Object.keys(enhancements)]
        } 
      }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error(`Failed to update content: ${contentId}`);
    }
    
    this.logger.info('Content enhanced', { 
      contentId, 
      enhancements: Object.keys(enhancements)
    });
    
    // Notify other agents
    await this.publishEvent('content_enhanced', {
      content_id: contentId,
      enhancements: Object.keys(enhancements)
    });
    
    const updatedContent = await this.storage.collections.content.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    return { content: updatedContent };
  }
}

module.exports = ContentCreationAgent;