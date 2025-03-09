/**
 * Content Creation Agent
 * Generates website copy, blog posts, and social media content
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
      'content_strategy.brief_updated',
      this.handleBriefUpdatedEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'optimisation.seo_recommendations',
      this.handleSeoRecommendationsEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'brand_consistency.review_completed',
      this.handleBrandReviewCompletedEvent.bind(this)
    );
  }
  
  /**
   * Generate content based on a content brief
   */
  async handleGenerateContentCommand(command) {
    const { briefId, type, overrides } = command.payload;
    
    this.logger.info('Generating content', { briefId, type });
    
    // Get content brief
    let brief;
    if (briefId) {
      brief = await this.storage.collections.content_briefs.findOne(
        { _id: this.storage.ObjectId(briefId) }
      );
      
      if (!brief) {
        throw new Error(`Brief not found: ${briefId}`);
      }
    } else if (overrides) {
      brief = overrides;
    } else {
      throw new Error('Either briefId or overrides must be provided');
    }
    
    // Determine which generator to use based on content type
    const contentType = type || brief.type;
    let generator;
    
    switch (contentType.toLowerCase()) {
      case 'blog':
        generator = this.modules.get('blog_generator');
        break;
      case 'social':
      case 'social_media':
        generator = this.modules.get('social_media_generator');
        break;
      case 'website':
      case 'landing_page':
        generator = this.modules.get('website_copy_generator');
        break;
      case 'email':
        generator = this.modules.get('email_generator');
        break;
      default:
        generator = this.modules.get('general_content_generator');
    }
    
    if (!generator) {
      throw new Error(`No generator available for content type: ${contentType}`);
    }
    
    // Generate content
    const content = await generator.generate(brief);
    
    // Store the generated content
    const contentItem = {
      brief_id: briefId ? this.storage.ObjectId(briefId) : null,
      type: contentType,
      content,
      status: 'draft',
      review_status: 'pending',
      created_at: new Date(),
      created_by: command.payload.userId || 'system'
    };
    
    const result = await this.storage.collections.content_items.insertOne(contentItem);
    
    this.logger.info('Content generated', { contentId: result.insertedId, type: contentType });
    
    // Request brand review
    await this.publishEvent('content_created', {
      content_id: result.insertedId,
      type: contentType,
      requires_review: true
    });
    
    return {
      content_id: result.insertedId,
      content
    };
  }
  
  /**
   * Edit existing content based on feedback
   */
  async handleEditContentCommand(command) {
    const { contentId, changes, feedback } = command.payload;
    
    this.logger.info('Editing content', { contentId });
    
    // Get existing content
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get the appropriate editor module
    const contentEditor = this.modules.get('content_editor');
    if (!contentEditor) {
      throw new Error('Content editor module not available');
    }
    
    // Apply edits
    let updatedContent;
    if (changes) {
      // Apply direct changes
      updatedContent = changes;
    } else if (feedback) {
      // Generate edits based on feedback
      updatedContent = await contentEditor.edit(contentItem.content, feedback);
    } else {
      throw new Error('Either changes or feedback must be provided');
    }
    
    // Update content in database
    const updateResult = await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          content: updatedContent,
          status: 'edited',
          review_status: 'pending',
          updated_at: new Date(),
          updated_by: command.payload.userId || 'system'
        },
        $push: {
          revision_history: {
            previous_content: contentItem.content,
            changed_at: new Date(),
            changed_by: command.payload.userId || 'system',
            feedback: feedback || 'Direct edit'
          }
        }
      }
    );
    
    if (updateResult.matchedCount === 0) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    this.logger.info('Content edited', { contentId });
    
    // Request brand review for the edited content
    await this.publishEvent('content_edited', {
      content_id: contentId,
      requires_review: true
    });
    
    return { 
      content_id: contentId,
      content: updatedContent
    };
  }
  
  /**
   * Generate multiple pieces of content for a campaign
   */
  async handleGenerateCampaignCommand(command) {
    const { campaignId, contentTypes } = command.payload;
    
    this.logger.info('Generating campaign content', { campaignId, contentTypes });
    
    // Get campaign data
    const campaign = await this.storage.collections.campaigns.findOne(
      { _id: this.storage.ObjectId(campaignId) }
    );
    
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    
    // Generate content for each required type
    const generatedContent = {};
    const contentIds = {};
    
    for (const type of contentTypes) {
      // Find appropriate generator
      let generator;
      switch (type.toLowerCase()) {
        case 'blog':
          generator = this.modules.get('blog_generator');
          break;
        case 'social':
        case 'social_media':
          generator = this.modules.get('social_media_generator');
          break;
        case 'website':
        case 'landing_page':
          generator = this.modules.get('website_copy_generator');
          break;
        case 'email':
          generator = this.modules.get('email_generator');
          break;
        default:
          generator = this.modules.get('general_content_generator');
      }
      
      if (!generator) {
        this.logger.warn(`No generator available for content type: ${type}`, { campaignId });
        continue;
      }
      
      // Generate content for this type
      const content = await generator.generate({
        ...campaign,
        type
      });
      
      // Store the generated content
      const contentItem = {
        campaign_id: this.storage.ObjectId(campaignId),
        type,
        content,
        status: 'draft',
        review_status: 'pending',
        created_at: new Date(),
        created_by: command.payload.userId || 'system'
      };
      
      const result = await this.storage.collections.content_items.insertOne(contentItem);
      
      generatedContent[type] = content;
      contentIds[type] = result.insertedId;
      
      // Request brand review for each piece
      await this.publishEvent('content_created', {
        content_id: result.insertedId,
        type,
        campaign_id: campaignId,
        requires_review: true
      });
    }
    
    this.logger.info('Campaign content generated', { 
      campaignId, 
      contentCount: Object.keys(contentIds).length 
    });
    
    return {
      campaign_id: campaignId,
      content_ids: contentIds,
      content: generatedContent
    };
  }
  
  /**
   * Generate headlines and calls-to-action
   */
  async handleGenerateHeadlinesCommand(command) {
    const { topic, count, type, targetAudience } = command.payload;
    
    this.logger.info('Generating headlines', { topic, count, type });
    
    // Get headline generator module
    const headlineGenerator = this.modules.get('headline_generator');
    if (!headlineGenerator) {
      throw new Error('Headline generator module not available');
    }
    
    // Generate headlines
    const headlines = await headlineGenerator.generate(topic, count, type, targetAudience);
    
    // Store the generated headlines
    const headlinesItem = {
      topic,
      type,
      target_audience: targetAudience,
      headlines,
      created_at: new Date(),
      created_by: command.payload.userId || 'system'
    };
    
    const result = await this.storage.collections.headlines.insertOne(headlinesItem);
    
    this.logger.info('Headlines generated', { 
      headlinesId: result.insertedId,
      count: headlines.length
    });
    
    return {
      headlines_id: result.insertedId,
      headlines
    };
  }
  
  /**
   * Handle brief created event from Content Strategy Agent
   */
  async handleBriefCreatedEvent(event) {
    const { brief_id, type } = event.payload;
    
    this.logger.info('Received brief created event', { briefId: brief_id, type });
    
    // Check if auto-generation is enabled for this type
    const autoGenerateTypes = this.config.auto_generate_types || [];
    
    if (autoGenerateTypes.includes(type.toLowerCase())) {
      this.logger.info('Auto-generating content for brief', { briefId: brief_id, type });
      
      // Send command to generate content
      await this.handleGenerateContentCommand({
        id: this._generateId(),
        type: 'generate_content',
        payload: {
          briefId: brief_id,
          type
        }
      });
    }
  }
  
  /**
   * Handle brief updated event from Content Strategy Agent
   */
  async handleBriefUpdatedEvent(event) {
    const { brief_id, updates } = event.payload;
    
    this.logger.info('Received brief updated event', { briefId: brief_id });
    
    // Check if there are any content items associated with this brief
    const contentItems = await this.storage.collections.content_items.find({
      brief_id: this.storage.ObjectId(brief_id)
    }).toArray();
    
    if (contentItems.length > 0) {
      // Get the content editor module
      const contentEditor = this.modules.get('content_editor');
      if (!contentEditor) {
        this.logger.error('Content editor module not available');
        return;
      }
      
      // Get the brief
      const brief = await this.storage.collections.content_briefs.findOne({
        _id: this.storage.ObjectId(brief_id)
      });
      
      if (!brief) {
        this.logger.error('Brief not found', { briefId: brief_id });
        return;
      }
      
      // Update each content item if needed
      for (const item of contentItems) {
        if (item.status === 'draft' || item.status === 'edited') {
          // Generate update suggestions
          const suggestions = await contentEditor.generateUpdateSuggestions(
            item.content,
            brief
          );
          
          await this.storage.collections.content_suggestions.insertOne({
            content_id: item._id,
            brief_id: this.storage.ObjectId(brief_id),
            suggestions,
            applied: false,
            created_at: new Date()
          });
          
          this.logger.info('Generated content update suggestions', { 
            contentId: item._id,
            briefId: brief_id
          });
        }
      }
    }
  }
  
  /**
   * Handle SEO recommendations event from Optimisation Agent
   */
  async handleSeoRecommendationsEvent(event) {
    const { content_id, recommendations } = event.payload;
    
    this.logger.info('Received SEO recommendations event', { 
      contentId: content_id,
      recommendationCount: recommendations.length 
    });
    
    // Get content item
    const contentItem = await this.storage.collections.content_items.findOne({
      _id: this.storage.ObjectId(content_id)
    });
    
    if (!contentItem) {
      this.logger.error('Content not found', { contentId: content_id });
      return;
    }
    
    // Get content editor module
    const contentEditor = this.modules.get('content_editor');
    if (!contentEditor) {
      this.logger.error('Content editor module not available');
      return;
    }
    
    // Apply SEO recommendations
    const updatedContent = await contentEditor.applySeoRecommendations(
      contentItem.content,
      recommendations
    );
    
    // Update content in database
    await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(content_id) },
      { 
        $set: { 
          content: updatedContent,
          status: 'optimised',
          updated_at: new Date(),
          updated_by: 'system'
        },
        $push: {
          revision_history: {
            previous_content: contentItem.content,
            changed_at: new Date(),
            changed_by: 'system',
            feedback: 'Applied SEO recommendations'
          }
        }
      }
    );
    
    this.logger.info('Applied SEO recommendations to content', { contentId: content_id });
    
    // Notify about optimisation
    await this.publishEvent('seo_recommendations_applied', {
      content_id,
      changes_applied: recommendations.length
    });
  }
  
  /**
   * Handle brand review completed event from Brand Consistency Agent
   */
  async handleBrandReviewCompletedEvent(event) {
    const { content_id, status, feedback } = event.payload;
    
    this.logger.info('Received brand review completed event', { 
      contentId: content_id,
      status 
    });
    
    // Get content item
    const contentItem = await this.storage.collections.content_items.findOne({
      _id: this.storage.ObjectId(content_id)
    });
    
    if (!contentItem) {
      this.logger.error('Content not found', { contentId: content_id });
      return;
    }
    
    if (status === 'approved') {
      // Update status
      await this.storage.collections.content_items.updateOne(
        { _id: this.storage.ObjectId(content_id) },
        { 
          $set: { 
            review_status: 'approved',
            updated_at: new Date()
          }
        }
      );
      
      this.logger.info('Content approved by brand review', { contentId: content_id });
      
      // Notify about approval
      await this.publishEvent('content_approved', {
        content_id,
        ready_for_publishing: true
      });
    } else if (status === 'needs_revision') {
      // Check if we should auto-revise
      if (this.config.auto_revise_content) {
        // Get content editor module
        const contentEditor = this.modules.get('content_editor');
        if (!contentEditor) {
          this.logger.error('Content editor module not available');
          return;
        }
        
        // Edit content based on feedback
        const updatedContent = await contentEditor.edit(contentItem.content, feedback);
        
        // Update content in database
        await this.storage.collections.content_items.updateOne(
          { _id: this.storage.ObjectId(content_id) },
          { 
            $set: { 
              content: updatedContent,
              status: 'edited',
              review_status: 'pending',
              updated_at: new Date(),
              updated_by: 'system'
            },
            $push: {
              revision_history: {
                previous_content: contentItem.content,
                changed_at: new Date(),
                changed_by: 'system',
                feedback
              }
            }
          }
        );
        
        this.logger.info('Auto-revised content based on brand feedback', { 
          contentId: content_id 
        });
        
        // Request another brand review
        await this.publishEvent('content_edited', {
          content_id,
          requires_review: true,
          auto_revised: true
        });
      } else {
        // Just update status
        await this.storage.collections.content_items.updateOne(
          { _id: this.storage.ObjectId(content_id) },
          { 
            $set: { 
              review_status: 'needs_revision',
              review_feedback: feedback,
              updated_at: new Date()
            }
          }
        );
        
        this.logger.info('Content marked as needing revision', { contentId: content_id });
      }
    }
  }
}

module.exports = ContentCreationAgent;