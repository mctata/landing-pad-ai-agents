/**
 * A/B Testing Generator Module for Optimisation Agent
 * Generates suggestions for A/B testing different content elements
 */

const BaseModule = require('../../../common/models/base-module');

class AbTestingGenerator extends BaseModule {
  constructor(config, storage, logger) {
    super(config, storage, logger);
    this.name = 'ab_testing_generator';
    this.aiProvider = null;
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing A/B testing generator module');
    
    // Create collection for A/B testing suggestions if it doesn't exist
    if (!this.storage.collections.ab_testing_suggestions) {
      await this.storage.db.createCollection('ab_testing_suggestions');
      this.storage.collections.ab_testing_suggestions = this.storage.db.collection('ab_testing_suggestions');
      
      // Create indexes
      await this.storage.collections.ab_testing_suggestions.createIndex({ content_id: 1 });
      await this.storage.collections.ab_testing_suggestions.createIndex({ generated_at: -1 });
    }
    
    this.logger.info('A/B testing generator module initialized');
  }

  /**
   * Set AI Provider service
   * @param {Object} aiProvider - AI Provider service instance
   */
  setAiProvider(aiProvider) {
    this.aiProvider = aiProvider;
  }

  /**
   * Generate A/B testing suggestions for content elements
   * 
   * @param {Object} contentItem - Content item to generate suggestions for
   * @param {Array<string>} elements - Content elements to generate variations for
   * @returns {Object} Suggestions for each element
   */
  async generateSuggestions(contentItem, elements = ['headline', 'cta']) {
    this.logger.info('Generating A/B testing suggestions', { 
      contentId: contentItem._id,
      elements 
    });
    
    if (!this.aiProvider) {
      throw new Error('AI Provider service not available');
    }
    
    const suggestions = {};
    
    // Process each element
    for (const element of elements) {
      try {
        const variations = await this._generateVariationsForElement(contentItem, element);
        
        if (variations && variations.length > 0) {
          suggestions[element] = variations;
        }
      } catch (error) {
        this.logger.error(`Error generating variations for ${element}:`, error);
      }
    }
    
    // Add metadata to suggestions
    const result = {
      content_id: contentItem._id,
      content_type: contentItem.type || 'unknown',
      elements: Object.keys(suggestions),
      suggestions,
      created_at: new Date()
    };
    
    // Save suggestions to database
    await this.storage.collections.ab_testing_suggestions.insertOne({
      content_id: this.storage.ObjectId(contentItem._id.toString()),
      generated_at: new Date(),
      elements,
      suggestions,
      implemented: false
    });
    
    return result;
  }

  /**
   * Generate variations for a specific content element
   * @private
   */
  async _generateVariationsForElement(contentItem, element) {
    // Check if content has the specified element
    const originalValue = this._getElementValue(contentItem, element);
    
    if (!originalValue) {
      this.logger.warn(`Content does not have element: ${element}`);
      return [];
    }
    
    // Define prompt based on element type
    let prompt = this._getPromptForElement(element, originalValue, contentItem);
    
    // Generate variations using AI
    const variations = await this._generateVariationsWithAI(prompt, element, contentItem.type);
    
    // Add original value as reference
    variations.unshift({
      text: originalValue,
      is_original: true,
      rationale: 'Original content'
    });
    
    return variations;
  }

  /**
   * Get element value from content item
   * @private
   */
  _getElementValue(contentItem, element) {
    // Map common element names to potential content item properties
    const elementMappings = {
      'headline': ['headline', 'title', 'heading'],
      'cta': ['cta', 'call_to_action', 'button_text'],
      'hero_image': ['hero_image', 'main_image', 'featured_image'],
      'subheading': ['subheading', 'subtitle', 'secondary_heading'],
      'description': ['description', 'excerpt', 'summary'],
      'intro': ['intro', 'introduction', 'lead'],
      'outro': ['outro', 'conclusion']
    };
    
    // Look for the element in the content item
    if (element in contentItem) {
      return contentItem[element];
    }
    
    // Try alternative property names
    if (element in elementMappings) {
      for (const alt of elementMappings[element]) {
        if (alt in contentItem) {
          return contentItem[alt];
        }
      }
    }
    
    // Check for nested elements
    if (contentItem.elements && element in contentItem.elements) {
      return contentItem.elements[element];
    }
    
    // Check for content object
    if (contentItem.content) {
      if (typeof contentItem.content === 'string') {
        // If content is a string, see if we can extract the element
        return this._extractElementFromContent(contentItem.content, element);
      } else if (typeof contentItem.content === 'object' && element in contentItem.content) {
        return contentItem.content[element];
      }
    }
    
    return null;
  }

  /**
   * Extract element from content string
   * @private
   */
  _extractElementFromContent(content, element) {
    // Simple extraction based on common patterns
    switch (element) {
      case 'headline':
      case 'title':
        // Try to extract title from markdown or HTML
        const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/<h1[^>]*>(.+?)<\/h1>/);
        return titleMatch ? titleMatch[1] : null;
        
      case 'subheading':
      case 'subtitle':
        const subtitleMatch = content.match(/^##\s+(.+)$/m) || content.match(/<h2[^>]*>(.+?)<\/h2>/);
        return subtitleMatch ? subtitleMatch[1] : null;
        
      case 'cta':
      case 'call_to_action':
        const ctaMatch = content.match(/\[([^\]]+)\]\([^)]+\)/g) || 
                         content.match(/<a[^>]*>(.+?)<\/a>/g) ||
                         content.match(/<button[^>]*>(.+?)<\/button>/g);
        return ctaMatch ? ctaMatch[0] : null;
        
      default:
        return null;
    }
  }

  /**
   * Get appropriate prompt for element
   * @private
   */
  _getPromptForElement(element, originalValue, contentItem) {
    const contentType = contentItem.type || 'content';
    const targetAudience = contentItem.target_audience || 'general audience';
    
    // Base prompt with context
    let prompt = `Generate 3 alternative versions for the ${element} of this ${contentType}. The target audience is ${targetAudience}. The original ${element} is: "${originalValue}"\n\n`;
    
    // Add element-specific guidance
    switch (element) {
      case 'headline':
      case 'title':
        prompt += `For each alternative, focus on clarity, impact, and audience appeal. Each headline should highlight Landing Pad Digital's AI website builder capabilities. Make each headline distinct in approach (e.g., benefit-focused, question-based, curiosity-driven) but maintain professional tone.`;
        break;
        
      case 'cta':
      case 'call_to_action':
        prompt += `Create compelling call-to-action alternatives that drive conversions. Focus on action verbs, urgency, and value proposition. Keep CTAs concise but impactful. Each CTA should relate to Landing Pad Digital's website building platform.`;
        break;
        
      case 'hero_image':
        prompt += `Suggest 3 alternative concepts for the hero image that would resonate with the target audience. Describe the image clearly, including subject, mood, style, and key elements. Each concept should visually represent Landing Pad Digital's AI website builder platform.`;
        break;
        
      case 'subheading':
      case 'subtitle':
        prompt += `Create subheading alternatives that support the main headline and elaborate on the value proposition. Focus on clarity and benefits. Each subheading should add information while maintaining brand voice.`;
        break;
        
      case 'description':
      case 'summary':
        prompt += `Generate concise description alternatives that clearly communicate the core message. Focus on benefits, outcomes, and unique value. Keep the same approximate length as the original.`;
        break;
        
      default:
        prompt += `Create 3 alternatives that maintain the core message while introducing variations in tone, structure, or emphasis. Ensure each alternative aligns with Landing Pad Digital's brand voice and highlights the AI website builder platform.`;
    }
    
    // Add formatting instructions
    prompt += `\n\nFor each alternative, include a brief rationale explaining why this version might perform better. Format each alternative as:\nAlternative X: [TEXT]\nRationale: [WHY THIS MIGHT PERFORM BETTER]`;
    
    return prompt;
  }

  /**
   * Generate variations using AI
   * @private
   */
  async _generateVariationsWithAI(prompt, element, contentType) {
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        messages: [
          {
            role: 'system',
            content: `You are an expert A/B testing specialist for Landing Pad Digital, a company offering an AI-powered website builder. Generate creative, effective variations for content elements that would drive better performance.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });
      
      // Parse the response into structured variations
      return this._parseVariationsFromResponse(response, element);
    } catch (error) {
      this.logger.error('Error generating variations with AI:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Parse variations from AI response
   * @private
   */
  _parseVariationsFromResponse(response, element) {
    // Define regex patterns for different response formats
    const alternativePatterns = [
      // Pattern: Alternative X: [text] \n Rationale: [rationale]
      /Alternative\s+\d+:(?:\s+)?(.+?)(?:\n|\r\n)Rationale:(?:\s+)?(.+?)(?:\n\n|\r\n\r\n|$)/gis,
      
      // Pattern: X. [text] \n Rationale: [rationale]
      /\d+\.(?:\s+)?(.+?)(?:\n|\r\n)Rationale:(?:\s+)?(.+?)(?:\n\n|\r\n\r\n|$)/gis,
      
      // Pattern: X: [text] \n Rationale: [rationale]
      /\d+:(?:\s+)?(.+?)(?:\n|\r\n)Rationale:(?:\s+)?(.+?)(?:\n\n|\r\n\r\n|$)/gis,
      
      // Pattern: X: [text] \n Reason: [rationale]
      /\d+:(?:\s+)?(.+?)(?:\n|\r\n)Reason:(?:\s+)?(.+?)(?:\n\n|\r\n\r\n|$)/gis
    ];
    
    // Try each pattern
    for (const pattern of alternativePatterns) {
      const matches = [...response.matchAll(pattern)];
      
      if (matches.length > 0) {
        return matches.map((match, index) => ({
          text: match[1].trim(),
          rationale: match[2].trim(),
          is_original: false,
          element_type: element,
          variation_number: index + 1
        }));
      }
    }
    
    // Fallback: try to extract any numbered alternatives
    const fallbackPattern = /(\d+[\.:]\s+.+?)(?=\n\d+[\.:]\s+|\n\n|$)/gs;
    const fallbackMatches = [...response.matchAll(fallbackPattern)];
    
    if (fallbackMatches.length > 0) {
      return fallbackMatches.map((match, index) => ({
        text: match[1].replace(/^\d+[\.:]\s+/, '').trim(),
        rationale: "Generated alternative",
        is_original: false,
        element_type: element,
        variation_number: index + 1
      }));
    }
    
    // If no structured format found, split by double newlines
    const lines = response.split(/\n\n+/).filter(line => line.trim().length > 0);
    
    if (lines.length > 0) {
      return lines.map((line, index) => ({
        text: line.trim(),
        rationale: "Generated alternative",
        is_original: false,
        element_type: element,
        variation_number: index + 1
      }));
    }
    
    // Last resort: just return the whole response as one variation
    return [{
      text: response.trim(),
      rationale: "Generated alternative",
      is_original: false,
      element_type: element,
      variation_number: 1
    }];
  }
}

module.exports = AbTestingGenerator;