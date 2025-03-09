/**
 * Content Creation Agent
 * Generates high-quality, engaging content that highlights Landing Pad Digital's AI website builder capabilities
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
      this.handleStrategyBriefCreatedEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'optimisation.seo_recommendations',
      this.handleSeoRecommendationsEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'brand_consistency.brand_guidelines_updated',
      this.handleBrandGuidelinesUpdatedEvent.bind(this)
    );
  }
  
  /**
   * Generate a blog post based on a content brief and topic
   */
  async handleCreateBlogPostCommand(command) {
    this.logger.info('Creating blog post', { topic: command.payload.topic });
    
    const { topic, briefId, keywords, targetAudience } = command.payload;
    
    // Get blog writer module
    const blogWriter = this.modules.get('blog_writer');
    if (!blogWriter) {
      throw new Error('Blog writer module not available');
    }
    
    // Get value proposition module
    const valueProposition = this.modules.get('value_proposition');
    if (!valueProposition) {
      throw new Error('Value proposition module not available');
    }