/**
 * Optimisation Agent
 * Analyses content performance and provides SEO recommendations
 */

const BaseAgent = require('../../common/models/base-agent');

class OptimisationAgent extends BaseAgent {
  constructor(config) {
    // Pass name along with config to super
    super({...config, name: 'optimisation'});
  }
  
  async initialize() {
    await super.initialize();
    
    // Subscribe to relevant events from other agents
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_creation.content_created',
      this.handleContentCreatedEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_management.content_scheduled',
      this.handleContentScheduledEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_management.content_categorised',
      this.handleContentCategorisedEvent.bind(this)
    );
  }
  
  /**
   * Analyse content performance
   */
  async handleAnalysePerformanceCommand(command) {
    const { contentId, metrics, timeframe } = command.payload;
    
    this.logger.info('Analysing content performance', { contentId, timeframe });
    
    // Get performance analyzer module
    const performanceAnalyzer = this.modules.get('performance_analyzer');
    if (!performanceAnalyzer) {
      throw new Error('Performance analyzer module not available');
    }
    
    // Get content item if ID is provided
    let contentItem = null;
    if (contentId) {
      contentItem = await this.storage.collections.content_items.findOne(
        { _id: this.storage.ObjectId(contentId) }
      );
      
      if (!contentItem) {
        throw new Error(`Content not found: ${contentId}`);
      }
    }
    
    // Analyse performance
    const analysis = await performanceAnalyzer.analysePerformance(
      contentItem,
      metrics,
      timeframe
    );
    
    // Save analysis results
    const analysisRecord = {
      content_id: contentId ? this.storage.ObjectId(contentId) : null,
      analysis_date: new Date(),
      timeframe,
      metrics: analysis.metrics,
      insights: analysis.insights,
      recommendations: analysis.recommendations
    };
    
    const result = await this.storage.collections.performance_analyses.insertOne(analysisRecord);
    
    this.logger.info('Performance analysis completed', { 
      analysisId: result.insertedId,
      contentId
    });
    
    // Publish event with analysis results
    await this.publishEvent('analysis_completed', {
      content_id: contentId,
      analysis_id: result.insertedId,
      performance_metrics: analysis.metrics,
      insights: analysis.insights,
      recommendations: analysis.recommendations
    });
    
    return {
      analysis_id: result.insertedId,
      analysis
    };
  }
  
  /**
   * Generate SEO recommendations
   */
  async handleGenerateSeoRecommendationsCommand(command) {
    const { contentId, keywords = [] } = command.payload;
    
    this.logger.info('Generating SEO recommendations', { contentId });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get SEO optimizer module
    const seoOptimizer = this.modules.get('seo_optimizer');
    if (!seoOptimizer) {
      throw new Error('SEO optimizer module not available');
    }
    
    // Generate SEO recommendations
    const recommendations = await seoOptimizer.generateRecommendations(
      contentItem,
      keywords
    );
    
    // Save recommendations
    const recommendationsRecord = {
      content_id: this.storage.ObjectId(contentId),
      generated_at: new Date(),
      keywords,
      recommendations,
      applied: false
    };
    
    const result = await this.storage.collections.seo_recommendations.insertOne(recommendationsRecord);
    
    this.logger.info('SEO recommendations generated', { 
      recommendationsId: result.insertedId,
      contentId,
      recommendationCount: recommendations.length
    });
    
    // Publish event with recommendations
    await this.publishEvent('seo_recommendations', {
      content_id: contentId,
      recommendations_id: result.insertedId,
      recommendations
    });
    
    return {
      recommendations_id: result.insertedId,
      recommendations
    };
  }
  
  /**
   * Generate A/B testing suggestions
   */
  async handleGenerateAbTestingSuggestionsCommand(command) {
    const { contentId, elements = ['headline', 'cta', 'hero_image'] } = command.payload;
    
    this.logger.info('Generating A/B testing suggestions', { 
      contentId, 
      elements 
    });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get A/B testing generator module
    const abTestingGenerator = this.modules.get('ab_testing_generator');
    if (!abTestingGenerator) {
      throw new Error('A/B testing generator module not available');
    }
    
    // Generate A/B testing suggestions
    const suggestions = await abTestingGenerator.generateSuggestions(
      contentItem,
      elements
    );
    
    // Save suggestions
    const suggestionsRecord = {
      content_id: this.storage.ObjectId(contentId),
      generated_at: new Date(),
      elements,
      suggestions,
      implemented: false
    };
    
    const result = await this.storage.collections.ab_testing_suggestions.insertOne(suggestionsRecord);
    
    this.logger.info('A/B testing suggestions generated', { 
      suggestionsId: result.insertedId,
      contentId,
      elementCount: Object.keys(suggestions).length
    });
    
    return {
      suggestions_id: result.insertedId,
      suggestions
    };
  }
  
  /**
   * Track content metrics
   */
  async handleTrackMetricsCommand(command) {
    const { contentId, metrics } = command.payload;
    
    this.logger.info('Tracking content metrics', { contentId });
    
    // Get metrics tracker module
    const metricsTracker = this.modules.get('metrics_tracker');
    if (!metricsTracker) {
      throw new Error('Metrics tracker module not available');
    }
    
    // Track metrics
    const trackingResult = await metricsTracker.trackMetrics(
      contentId,
      metrics
    );
    
    this.logger.info('Metrics tracked successfully', { 
      contentId,
      metricCount: Object.keys(metrics).length
    });
    
    return trackingResult;
  }
  
  /**
   * Generate content performance report
   */
  async handleGenerateReportCommand(command) {
    const { timeframe, contentTypes = [], limit = 10 } = command.payload;
    
    this.logger.info('Generating content performance report', { 
      timeframe, 
      contentTypes 
    });
    
    // Get reporting module
    const reportingModule = this.modules.get('reporting');
    if (!reportingModule) {
      throw new Error('Reporting module not available');
    }
    
    // Generate report
    const report = await reportingModule.generateReport(
      timeframe,
      contentTypes,
      limit
    );
    
    this.logger.info('Performance report generated', { 
      reportId: report.report_id,
      itemCount: report.items.length
    });
    
    return report;
  }
  
  /**
   * Handle content created event from Content Creation Agent
   */
  async handleContentCreatedEvent(event) {
    const { content_id, type } = event.payload;
    
    this.logger.info('Received content created event', { 
      contentId: content_id, 
      type 
    });
    
    // Check if auto-SEO is enabled for this content type
    const autoSeoTypes = this.config.auto_seo_types || ['blog', 'website', 'landing_page'];
    
    if (autoSeoTypes.includes(type.toLowerCase())) {
      this.logger.info('Auto-generating SEO recommendations', { 
        contentId: content_id, 
        type 
      });
      
      try {
        // Generate SEO recommendations asynchronously
        setTimeout(async () => {
          try {
            await this.handleGenerateSeoRecommendationsCommand({
              id: this._generateId(),
              type: 'generate_seo_recommendations',
              payload: {
                contentId: content_id
              }
            });
          } catch (error) {
            this.logger.error('Error auto-generating SEO recommendations:', error);
          }
        }, 2000); // Small delay to ensure content is fully processed
      } catch (error) {
        this.logger.error('Error setting up auto-SEO task:', error);
      }
    }
  }
  
  /**
   * Handle content scheduled event from Content Management Agent
   */
  async handleContentScheduledEvent(event) {
    const { content_id, platform } = event.payload;
    
    this.logger.info('Received content scheduled event', { 
      contentId: content_id, 
      platform 
    });
    
    // Check if auto-A/B testing is enabled for this platform
    const autoAbPlatforms = this.config.auto_ab_platforms || ['website', 'landing_page'];
    
    if (autoAbPlatforms.includes(platform.toLowerCase())) {
      this.logger.info('Auto-generating A/B testing suggestions', { 
        contentId: content_id, 
        platform 
      });
      
      try {
        // Generate A/B testing suggestions asynchronously
        setTimeout(async () => {
          try {
            await this.handleGenerateAbTestingSuggestionsCommand({
              id: this._generateId(),
              type: 'generate_ab_testing_suggestions',
              payload: {
                contentId: content_id,
                elements: ['headline', 'cta'] // Default elements to test
              }
            });
          } catch (error) {
            this.logger.error('Error auto-generating A/B testing suggestions:', error);
          }
        }, 2000); // Small delay to ensure content is fully processed
      } catch (error) {
        this.logger.error('Error setting up auto-A/B testing task:', error);
      }
    }
  }
  
  /**
   * Handle content categorised event from Content Management Agent
   */
  async handleContentCategorisedEvent(event) {
    const { content_id, categories } = event.payload;
    
    this.logger.info('Received content categorised event', { 
      contentId: content_id, 
      categories 
    });
    
    // Use categories to enhance SEO recommendations
    // Here we just store the categories for future use in SEO optimization
    try {
      await this.storage.collections.content_metadata.updateOne(
        { content_id: this.storage.ObjectId(content_id) },
        { 
          $set: { 
            categories,
            updated_at: new Date()
          }
        },
        { upsert: true }
      );
      
      this.logger.info('Updated content metadata with categories', { 
        contentId: content_id,
        categoryCount: categories.length
      });
    } catch (error) {
      this.logger.error('Error updating content metadata with categories:', error);
    }
  }
}

module.exports = OptimisationAgent;