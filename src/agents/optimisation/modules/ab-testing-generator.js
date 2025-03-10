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
    
    this.logger.debug(`Generating variations for ${element}`, { originalValue });
    
    // Define prompt based on element type
    const promptForElement = this._getPromptForElement(element, contentItem, originalValue);
    
    // Generate variations using AI
    let variations = [];
    try {
      const result = await this.aiProvider.generateText({
        messages: [
          {
            role: 'system',
            content: promptForElement.system
          },
          {
            role: 'user',
            content: promptForElement.user
          }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });
      
      // Parse AI-generated variations
      variations = this._parseVariations(result, element);
      
      // Ensure we have unique variations
      variations = variations
        .filter(v => v.text && v.text !== originalValue)
        .filter((v, i, self) => self.findIndex(s => s.text === v.text) === i);
      
      // Add hypothesis to each variation
      variations = variations.map(v => ({
        ...v,
        hypothesis: this._generateHypothesis(element, originalValue, v.text)
      }));
      
      // Limit to reasonable number
      const maxVariations = Math.min(variations.length, 3);
      variations = variations.slice(0, maxVariations);
      
      // Add original as first variation for reference
      variations.unshift({
        text: originalValue,
        is_original: true,
        rationale: 'Original content',
        hypothesis: null
      });
      
    } catch (error) {
      this.logger.error(`Error generating variations with AI for ${element}:`, error);
      return [{ 
        text: originalValue, 
        is_original: true, 
        rationale: 'Original content',
        hypothesis: null
      }];
    }
    
    return variations;
  }

  /**
   * Get value of a specific element from content
   * @private
   */
  _getElementValue(contentItem, element) {
    switch (element.toLowerCase()) {
      case 'headline':
      case 'title':
        return contentItem.title || contentItem.headline;
        
      case 'cta':
      case 'call_to_action':
        return contentItem.cta || 
               contentItem.call_to_action || 
               (contentItem.elements && contentItem.elements.cta);
        
      case 'subheadline':
      case 'subtitle':
        return contentItem.subheadline || 
               contentItem.subtitle || 
               contentItem.description;
        
      case 'hero_image':
      case 'image':
        if (contentItem.hero_image) return contentItem.hero_image;
        if (contentItem.images && contentItem.images.length > 0) return contentItem.images[0];
        if (contentItem.elements && contentItem.elements.hero_image) return contentItem.elements.hero_image;
        return null;
        
      case 'intro':
      case 'introduction':
        if (contentItem.intro) return contentItem.intro;
        if (contentItem.introduction) return contentItem.introduction;
        if (contentItem.content && typeof contentItem.content === 'string') {
          // Extract first paragraph
          const firstParagraph = contentItem.content.split('\n\n')[0];
          if (firstParagraph.length < 500) return firstParagraph;
        }
        return null;
        
      default:
        // Check for custom elements
        if (contentItem.elements && contentItem.elements[element]) {
          return contentItem.elements[element];
        }
        return contentItem[element];
    }
  }

  /**
   * Generate prompt for specific element
   * @private
   */
  _getPromptForElement(element, contentItem, originalValue) {
    const contentType = contentItem.type || 'content';
    const contentPurpose = contentItem.purpose || 'To educate users about Landing Pad Digital\'s AI website builder';
    
    const baseSystemPrompt = 
      `You are an expert copywriter specializing in conversion optimization and A/B testing for digital content. Your task is to generate 3 alternative versions of a ${element} for a ${contentType}.

The content is about Landing Pad Digital's AI-powered website builder platform. Alternatives should maintain the same core message but use different approaches to potentially improve conversion rates.

For each alternative, provide:
1. The alternative text
2. A brief rationale for why this version might perform better

Format each alternative as:
---
ALTERNATIVE: [alternative text]
RATIONALE: [brief explanation of why this might perform better]
---`;

    const userPrompts = {
      headline: `Generate 3 alternative headlines for this ${contentType} about Landing Pad Digital's AI website builder. 
      
Original headline: "${originalValue}"

Content purpose: ${contentPurpose}

The alternatives should:
- Be concise and compelling
- Clearly communicate the value proposition
- Use action words where appropriate
- Highlight the AI-powered features
- Maintain the same core message but test different angles or emotional appeals`,

      cta: `Generate 3 alternative call-to-action (CTA) texts for this ${contentType} about Landing Pad Digital's AI website builder.
      
Original CTA: "${originalValue}"

Content purpose: ${contentPurpose}

The alternatives should:
- Be action-oriented and clear
- Create a sense of urgency or value
- Be concise (typically 2-5 words)
- Eliminate friction or hesitation
- Test different value propositions or benefits`,

      subheadline: `Generate 3 alternative subheadlines for this ${contentType} about Landing Pad Digital's AI website builder.
      
Original subheadline: "${originalValue}"

Main headline: "${contentItem.title || contentItem.headline || 'Unknown'}"

Content purpose: ${contentPurpose}

The alternatives should:
- Expand on the headline's promise
- Provide more specific benefits or features
- Support the main headline
- Be concise but descriptive
- Address potential customer pain points`,

      intro: `Generate 3 alternative introductions for this ${contentType} about Landing Pad Digital's AI website builder.
      
Original introduction: "${originalValue}"

Content purpose: ${contentPurpose}

The alternatives should:
- Hook the reader immediately
- Clearly state the problem being solved
- Hint at the solution (Landing Pad Digital's AI website builder)
- Be concise yet informative
- Use different approaches (question, statistic, story, etc.)`
    };
    
    // Default prompt if not specifically defined
    const defaultUserPrompt = `Generate 3 alternatives for this ${element} in a ${contentType} about Landing Pad Digital's AI website builder.
    
Original ${element}: "${originalValue}"

Content purpose: ${contentPurpose}

The alternatives should:
- Maintain the same core message
- Test different approaches or wording
- Be optimized for better conversion
- Highlight Landing Pad Digital's AI website builder features and benefits`;
    
    return {
      system: baseSystemPrompt,
      user: userPrompts[element.toLowerCase()] || defaultUserPrompt
    };
  }

  /**
   * Parse AI-generated variations
   * @private
   */
  _parseVariations(aiResponse, element) {
    try {
      const variations = [];
      
      // Split by alternative sections
      const alternativeSections = aiResponse.split('---').filter(section => section.trim() !== '');
      
      for (const section of alternativeSections) {
        const alternativeMatch = section.match(/ALTERNATIVE:?\s*(.*?)(?=RATIONALE:|$)/is);
        const rationaleMatch = section.match(/RATIONALE:?\s*(.*?)(?=---|$)/is);
        
        if (alternativeMatch) {
          const text = alternativeMatch[1].trim();
          const rationale = rationaleMatch ? rationaleMatch[1].trim() : 'No rationale provided';
          
          variations.push({
            text,
            is_original: false,
            rationale
          });
        }
      }
      
      // If parsing failed, try simpler parsing
      if (variations.length === 0) {
        // Look for numbered alternatives (1., 2., 3., etc.)
        const numberedAlternatives = aiResponse.match(/\d+\.\s*(.*?)(?=\d+\.|$)/gs);
        
        if (numberedAlternatives) {
          for (const alternative of numberedAlternatives) {
            const text = alternative.replace(/^\d+\.\s*/, '').trim();
            if (text) {
              variations.push({
                text,
                is_original: false,
                rationale: 'Alternative version'
              });
            }
          }
        }
      }
      
      return variations;
    } catch (error) {
      this.logger.error(`Error parsing AI response for ${element}:`, error);
      return [];
    }
  }

  /**
   * Generate hypothesis for A/B test
   * @private
   */
  _generateHypothesis(element, original, variation) {
    // Generic hypotheses based on element type
    const hypotheses = {
      headline: `Changing the headline from "${this._truncate(original)}" to "${this._truncate(variation)}" will increase CTR by testing a different value proposition.`,
      title: `Changing the title from "${this._truncate(original)}" to "${this._truncate(variation)}" will increase engagement by using more compelling language.`,
      cta: `Changing the CTA from "${original}" to "${variation}" will increase conversion rate by creating more urgency/clarity.`,
      subheadline: `Changing the subheadline will improve understanding of the value proposition and increase time on page.`,
      intro: `A different introduction approach will reduce bounce rate and increase reader engagement with the rest of the content.`
    };
    
    return hypotheses[element.toLowerCase()] || 
      `Changing the ${element} will improve user engagement and conversion metrics.`;
  }

  /**
   * Truncate text for display
   * @private
   */
  _truncate(text, length = 40) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length - 3) + '...';
  }
}

module.exports = AbTestingGenerator;