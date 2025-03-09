/**
 * Content Editor Module
 * Edits and refines content based on feedback or SEO recommendations
 */

const BaseModule = require('../../../common/models/base-module');

class ContentEditor extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'content_editor';
  }
  
  async initialize() {
    this.logger.info('Initializing content editor module');
    
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
  }
  
  /**
   * Edit content based on feedback
   * @param {string} content - Original content
   * @param {string} feedback - Feedback or revision instructions
   * @returns {string} Edited content
   */
  async edit(content, feedback) {
    this.logger.info('Editing content based on feedback');
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a professional content editor for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be editing content to ensure it follows the brand voice: ${this.brandVoice}.

Your task is to carefully revise the provided content based on the feedback while maintaining the original structure and purpose.
Make specific, targeted changes rather than completely rewriting the content unless absolutely necessary.
Always ensure the content highlights Landing Pad Digital's AI website builder capabilities.
    `;
    
    const userPrompt = `
Here is the original content:

"""
${content}
"""

Here is the feedback to address:

"""
${feedback}
"""

Please provide the edited version of the content that addresses all the feedback points while maintaining the brand voice.
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: content.length * 1.2
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error editing content:', error);
      throw new Error(`Failed to edit content: ${error.message}`);
    }
  }
  
  /**
   * Apply SEO recommendations to content
   * @param {string} content - Original content
   * @param {Array} recommendations - SEO recommendations
   * @returns {string} Optimised content
   */
  async applySeoRecommendations(content, recommendations) {
    this.logger.info('Applying SEO recommendations', { 
      recommendationCount: recommendations.length 
    });
    
    // Construct prompt for the AI
    const systemPrompt = `
You are an SEO specialist editing content for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be optimizing content based on specific SEO recommendations while maintaining the brand voice: ${this.brandVoice}.

Your task is to carefully revise the provided content to implement the SEO recommendations while:
1. Maintaining the original content structure and flow
2. Ensuring the content remains natural and readable
3. Preserving the original meaning and information
4. Keeping the content on brand and helpful for the audience
    `;
    
    const userPrompt = `
Here is the original content:

"""
${content}
"""

Please implement the following SEO recommendations:

${recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

Provide the edited version of the content that implements all the SEO recommendations while maintaining the content's overall quality and readability.
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
        max_tokens: content.length * 1.2
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error applying SEO recommendations:', error);
      throw new Error(`Failed to apply SEO recommendations: ${error.message}`);
    }
  }
  
  /**
   * Generate update suggestions based on a content brief
   * @param {string} content - Original content
   * @param {Object} brief - Updated content brief
   * @returns {Array} Content update suggestions
   */
  async generateUpdateSuggestions(content, brief) {
    this.logger.info('Generating content update suggestions');
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a content strategist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be analyzing content against an updated content brief to suggest specific improvements.

Your task is to carefully review the content and identify specific areas that should be updated to align with the new brief.
Focus on concrete, actionable suggestions rather than general feedback.
    `;
    
    const userPrompt = `
Here is the original content:

"""
${content}
"""

Here is the updated content brief:

"""
${JSON.stringify(brief, null, 2)}
"""

Please provide 3-5 specific update suggestions that would improve the content to better align with the updated brief.
Format each suggestion as:
1. [Brief description of the change]
2. [Brief description of the change]
3. [Brief description of the change]
...

For each suggestion, include:
- The specific section or element that needs updating
- The reason for the update
- A concise recommendation for how to implement the change
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 1500
      });
      
      // Parse the suggestions
      const suggestionLines = response.split(/\n\d+\.\s+/).filter(line => line.trim().length > 0);
      
      return suggestionLines.map(suggestion => suggestion.trim());
    } catch (error) {
      this.logger.error('Error generating update suggestions:', error);
      throw new Error(`Failed to generate update suggestions: ${error.message}`);
    }
  }
  
  /**
   * Improve readability of content
   * @param {string} content - Original content
   * @returns {string} More readable content
   */
  async improveReadability(content) {
    this.logger.info('Improving content readability');
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a content editor for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be improving the readability of content while maintaining the brand voice: ${this.brandVoice}.

Your task is to carefully revise the provided content to:
1. Break up long paragraphs into shorter ones
2. Simplify complex sentences
3. Add subheadings where appropriate
4. Use bullet points for lists
5. Add transition words for better flow
6. Ensure consistent formatting
7. Maintain all original key information and meaning
    `;
    
    const userPrompt = `
Here is the content to improve for readability:

"""
${content}
"""

Please provide the edited version with improved readability while maintaining the same information and brand voice.
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
        max_tokens: content.length * 1.2
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error improving readability:', error);
      throw new Error(`Failed to improve readability: ${error.message}`);
    }
  }
  
  /**
   * Check content for brand consistency
   * @param {string} content - Content to check
   * @returns {Object} Consistency check results
   */
  async checkBrandConsistency(content) {
    this.logger.info('Checking content for brand consistency');
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a brand guardian for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be analyzing content for brand consistency against the brand voice: ${this.brandVoice}.

Your task is to carefully review the provided content and identify any inconsistencies with the brand voice, 
terminology, messaging, or tone.
    `;
    
    const userPrompt = `
Here is the content to check for brand consistency:

"""
${content}
"""

Please analyze the content and provide:
1. An overall consistency score from 1-10
2. A list of specific inconsistencies found (if any)
3. Suggestions for how to correct each inconsistency

Format your response as JSON with the following structure:
{
  "score": [1-10 score],
  "inconsistencies": [
    {
      "issue": "[description of inconsistency]",
      "suggestion": "[how to correct it]"
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
        max_tokens: 1500
      });
      
      // Parse JSON response
      let results;
      try {
        // Try to parse the response as JSON
        results = JSON.parse(response);
      } catch (parseError) {
        // If that fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            results = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            // If JSON parsing fails, create a structured object manually
            results = this._extractBrandConsistencyResults(response);
          }
        } else {
          // If no JSON-like structure is found, extract results manually
          results = this._extractBrandConsistencyResults(response);
        }
      }
      
      return results;
    } catch (error) {
      this.logger.error('Error checking brand consistency:', error);
      throw new Error(`Failed to check brand consistency: ${error.message}`);
    }
  }
  
  /**
   * Extract brand consistency results when JSON parsing fails
   * @private
   */
  _extractBrandConsistencyResults(response) {
    const scoreMatch = response.match(/score:?\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 5;
    
    const inconsistencies = [];
    const issueMatches = response.match(/issue:?\s*([^\n]+)/gi);
    const suggestionMatches = response.match(/suggestion:?\s*([^\n]+)/gi);
    
    if (issueMatches && suggestionMatches) {
      const count = Math.min(issueMatches.length, suggestionMatches.length);
      
      for (let i = 0; i < count; i++) {
        const issue = issueMatches[i].replace(/issue:?\s*/i, '').trim();
        const suggestion = suggestionMatches[i].replace(/suggestion:?\s*/i, '').trim();
        
        inconsistencies.push({ issue, suggestion });
      }
    }
    
    const summaryMatch = response.match(/summary:?\s*([^\n]+(?:\n[^\n]+)*)/i);
    const summary = summaryMatch 
      ? summaryMatch[1].trim() 
      : 'Content has some brand consistency issues that should be addressed.';
    
    return {
      score,
      inconsistencies,
      summary
    };
  }
}

module.exports = ContentEditor;