/**
 * Freshness Checker Module
 * Checks content for freshness and identifies stale content
 */

const BaseModule = require('../../../common/models/base-module');

class FreshnessChecker extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'freshness_checker';
    
    // Default freshness thresholds by content type (in days)
    this.freshnessThresholds = {
      blog: 90,      // Blog posts older than 90 days might need updates
      social: 365,   // Social posts generally don't need updating
      website: 180,  // Website copy should be reviewed every 6 months
      email: 180,    // Email templates should be reviewed every 6 months
      default: 120   // Default threshold for other content types
    };
    
    // Content types that require seasonal updates
    this.seasonalContentTypes = [
      'holiday', 'seasonal', 'event', 'promotion'
    ];
  }
  
  async initialize() {
    this.logger.info('Initializing freshness checker module');
    
    // Load custom thresholds from config
    if (this.config.freshness_thresholds) {
      this.freshnessThresholds = {
        ...this.freshnessThresholds,
        ...this.config.freshness_thresholds
      };
      
      this.logger.info('Loaded custom freshness thresholds', { 
        thresholds: this.freshnessThresholds 
      });
    }
  }
  
  /**
   * Check content freshness
   * @param {Array} contentIds - Optional array of content IDs to check, checks all if not provided
   * @param {number} thresholdDays - Override the default threshold (in days)
   * @returns {Object} Freshness check results
   */
  async checkFreshness(contentIds = null, thresholdDays = null) {
    this.logger.info('Checking content freshness', { 
      specificIds: !!contentIds,
      thresholdDays 
    });
    
    // Build query for content items
    let query = {};
    
    if (contentIds && contentIds.length > 0) {
      // Convert string IDs to ObjectIds
      const objectIds = contentIds.map(id => this.storage.ObjectId(id));
      query._id = { $in: objectIds };
    } else {
      // Only check published content if checking everything
      query.status = { $in: ['published', 'updated'] };
    }
    
    // Get content items
    const contentItems = await this.storage.collections.content_items.find(query).toArray();
    
    this.logger.info(`Found ${contentItems.length} content items to check`);
    
    // Check each item for freshness
    const now = new Date();
    const results = {
      total_checked: contentItems.length,
      fresh: [],
      needs_update: []
    };
    
    for (const item of contentItems) {
      // Determine the appropriate threshold for this content type
      const itemType = (item.type || 'default').toLowerCase();
      let threshold = thresholdDays || this.freshnessThresholds[itemType] || this.freshnessThresholds.default;
      
      // Adjust threshold for seasonal content
      if (this._isSeasonalContent(item)) {
        threshold = Math.min(threshold, 60); // Seasonal content should be checked more frequently
      }
      
      // Check if the item has been updated recently
      const lastUpdated = item.updated_at || item.created_at;
      const daysSinceUpdate = Math.floor((now - new Date(lastUpdated)) / (1000 * 60 * 60 * 24));
      
      // Determine if content needs an update
      const needsUpdate = daysSinceUpdate > threshold;
      
      // Add to the appropriate result list
      const resultItem = {
        content_id: item._id.toString(),
        title: item.title || 'Untitled',
        type: item.type || 'unknown',
        last_updated: lastUpdated,
        days_since_update: daysSinceUpdate,
        threshold_days: threshold
      };
      
      if (needsUpdate) {
        // For content needing updates, include update priority
        resultItem.update_priority = this._calculateUpdatePriority(
          item, 
          daysSinceUpdate, 
          threshold
        );
        results.needs_update.push(resultItem);
      } else {
        results.fresh.push(resultItem);
      }
    }
    
    // Sort needs_update by priority (highest first)
    results.needs_update.sort((a, b) => b.update_priority - a.update_priority);
    
    this.logger.info('Freshness check completed', { 
      fresh: results.fresh.length,
      needsUpdate: results.needs_update.length
    });
    
    return results;
  }
  
  /**
   * Analyze content for freshness signals
   * @param {Object} contentItem - Content item to analyze
   * @returns {Object} Analysis results with recommended updates
   */
  async analyzeForUpdates(contentItem) {
    this.logger.info('Analyzing content for possible updates', { 
      contentId: contentItem._id 
    });
    
    // Extract text from the content for analysis
    let contentText = '';
    
    if (typeof contentItem.content === 'string') {
      contentText = contentItem.content;
    } else if (contentItem.content && typeof contentItem.content === 'object') {
      // For structured content, create a flattened text version
      if (contentItem.content.content) contentText += contentItem.content.content + ' ';
      if (contentItem.content.title) contentText += contentItem.content.title + ' ';
      
      // Handle nested sections
      if (contentItem.content.sections) {
        for (const [sectionKey, section] of Object.entries(contentItem.content.sections)) {
          if (typeof section === 'object') {
            if (section.heading) contentText += section.heading + ' ';
            if (section.content) contentText += section.content + ' ';
            if (section.description) contentText += section.description + ' ';
          }
        }
      }
    }
    
    // Add metadata for context
    let contentMeta = '';
    if (contentItem.title) contentMeta += `Title: ${contentItem.title}\n`;
    if (contentItem.type) contentMeta += `Type: ${contentItem.type}\n`;
    if (contentItem.categories && contentItem.categories.length > 0) {
      contentMeta += `Categories: ${contentItem.categories.join(', ')}\n`;
    }
    if (contentItem.keywords && contentItem.keywords.length > 0) {
      contentMeta += `Keywords: ${contentItem.keywords.join(', ')}\n`;
    }
    
    // Use AI to analyze for freshness
    const systemPrompt = `
You are a content freshness analyzer for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Your task is to analyze content for outdated information, statistics, references, or examples.
Identify specific elements that might need updating and provide concrete suggestions.
    `;
    
    const userPrompt = `
Analyze this content for freshness and identify elements that might need updating:

Content Metadata:
${contentMeta}

Creation Date: ${contentItem.created_at}
Last Updated: ${contentItem.updated_at || 'Never updated'}

Content Sample:
"""
${contentText.substring(0, 5000)} ${contentText.length > 5000 ? '...' : ''}
"""

Please provide:
1. An overall freshness score from 1-10 (where 10 is completely current and 1 is severely outdated)
2. Specific elements that might need updating (references, statistics, examples, etc.)
3. Concrete update suggestions

Format your response as JSON with the following structure:
{
  "freshness_score": [1-10 score],
  "outdated_elements": [
    {
      "element": "[description of outdated element]",
      "reason": "[why it needs updating]",
      "suggestion": "[update suggestion]"
    },
    ...
  ],
  "summary": "[brief summary of findings]"
}
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 2000
      });
      
      // Parse JSON response
      let analysis;
      try {
        // Try to parse the response as JSON
        analysis = JSON.parse(response);
      } catch (parseError) {
        // If that fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            // If JSON parsing fails, create a structured object manually
            analysis = this._extractAnalysisResults(response);
          }
        } else {
          // If no JSON-like structure is found, extract analysis manually
          analysis = this._extractAnalysisResults(response);
        }
      }
      
      this.logger.info('Content freshness analysis completed', { 
        contentId: contentItem._id,
        freshnessScore: analysis.freshness_score,
        outdatedElements: analysis.outdated_elements.length
      });
      
      // Store analysis results
      await this.storage.collections.content_freshness.insertOne({
        content_id: contentItem._id,
        analysis_date: new Date(),
        freshness_score: analysis.freshness_score,
        outdated_elements: analysis.outdated_elements,
        summary: analysis.summary
      });
      
      return analysis;
    } catch (error) {
      this.logger.error('Error analyzing content for updates:', error);
      
      // Return basic analysis results as fallback
      return {
        freshness_score: 5,
        outdated_elements: [
          {
            element: 'General content',
            reason: 'Content is aging and might need refreshing',
            suggestion: 'Review content for currency and relevance'
          }
        ],
        summary: 'Content may need review due to its age. Error occurred during detailed analysis.'
      };
    }
  }
  
  /**
   * Determine if content is seasonal in nature
   * @private
   */
  _isSeasonalContent(contentItem) {
    // Check if content has seasonal categories
    if (contentItem.categories && contentItem.categories.some(category => 
      this.seasonalContentTypes.includes(category.toLowerCase())
    )) {
      return true;
    }
    
    // Check content title and text for seasonal keywords
    const seasonalKeywords = [
      'holiday', 'christmas', 'halloween', 'thanksgiving', 'easter',
      'summer', 'winter', 'spring', 'fall', 'autumn',
      'season', 'black friday', 'cyber monday', 'new year'
    ];
    
    // Check title
    if (contentItem.title && seasonalKeywords.some(keyword => 
      contentItem.title.toLowerCase().includes(keyword)
    )) {
      return true;
    }
    
    // Check content text (simplified for performance)
    if (typeof contentItem.content === 'string' && seasonalKeywords.some(keyword => 
      contentItem.content.toLowerCase().includes(keyword)
    )) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Calculate update priority for content
   * @private
   */
  _calculateUpdatePriority(contentItem, daysSinceUpdate, threshold) {
    // Base priority calculation: how far past threshold
    const thresholdRatio = daysSinceUpdate / threshold;
    let priority = Math.min(thresholdRatio * 5, 10); // Scale from 0-10
    
    // Increase priority for high-traffic content
    if (contentItem.metrics && contentItem.metrics.views) {
      // Content with >1000 views gets priority boost
      if (contentItem.metrics.views > 1000) {
        priority += 2;
      } else if (contentItem.metrics.views > 500) {
        priority += 1;
      }
    }
    
    // Increase priority for SEO-important content
    if (contentItem.seo_importance === 'high') {
      priority += 2;
    } else if (contentItem.seo_importance === 'medium') {
      priority += 1;
    }
    
    // Increase priority for product/feature pages
    if (contentItem.type === 'product_page' || contentItem.type === 'feature_page') {
      priority += 2;
    }
    
    // Cap priority at 10
    return Math.min(priority, 10);
  }
  
  /**
   * Extract analysis results when JSON parsing fails
   * @private
   */
  _extractAnalysisResults(response) {
    const freshnessScoreMatch = response.match(/freshness score:?\s*(\d+)/i);
    const freshnessScore = freshnessScoreMatch 
      ? parseInt(freshnessScoreMatch[1], 10) 
      : 5;
    
    const outdatedElements = [];
    const elementRegex = /element:?\s*([^\n]+)[\s\S]*?reason:?\s*([^\n]+)[\s\S]*?suggestion:?\s*([^\n]+)/gi;
    
    let elementMatch;
    while ((elementMatch = elementRegex.exec(response)) !== null) {
      outdatedElements.push({
        element: elementMatch[1].trim(),
        reason: elementMatch[2].trim(),
        suggestion: elementMatch[3].trim()
      });
    }
    
    const summaryMatch = response.match(/summary:?\s*([^\n]+(?:\n[^{]+)*)/i);
    const summary = summaryMatch 
      ? summaryMatch[1].trim() 
      : 'Content may need review due to its age.';
    
    return {
      freshness_score: freshnessScore,
      outdated_elements: outdatedElements.length > 0 ? outdatedElements : [
        {
          element: 'General content',
          reason: 'Content is aging and might need refreshing',
          suggestion: 'Review content for currency and relevance'
        }
      ],
      summary
    };
  }
}

module.exports = FreshnessChecker;