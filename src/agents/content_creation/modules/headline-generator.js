/**
 * Headline Generator Module
 * Generates compelling headlines and calls-to-action
 */

const BaseModule = require('../../../common/models/base-module');

class HeadlineGenerator extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'headline_generator';
    this.headlineTypes = [
      'blog', 'social', 'website', 'email', 'ad', 'cta'
    ];
  }
  
  async initialize() {
    this.logger.info('Initializing headline generator module');
    
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
    
    // Load headline templates
    this.headlineTemplates = {
      blog: [
        'How to {action} With {topic}',
        '{number} Ways to {action} Using {topic}',
        'The Ultimate Guide to {topic}',
        'Why {topic} Is Essential for {audience}'
      ],
      website: [
        'Build Your {topic} Website in Minutes with AI',
        'Create a Professional {topic} Website Without Coding',
        '{action} Your Online Presence with Landing Pad Digital'
      ],
      cta: [
        'Start Building Your {topic} Website',
        'Try Our AI Website Builder Today',
        'Get Started For Free',
        'See {topic} Templates'
      ]
    };
  }
  
  /**
   * Generate headlines for a given topic
   * @param {string} topic - Topic for the headlines
   * @param {number} count - Number of headlines to generate
   * @param {string} type - Type of headline
   * @param {string} targetAudience - Target audience description
   * @returns {Array} Generated headlines
   */
  async generate(topic, count = 5, type = 'blog', targetAudience = null) {
    this.logger.info('Generating headlines', { topic, count, type });
    
    // Validate headline type
    const headlineType = this.headlineTypes.includes(type.toLowerCase()) 
      ? type.toLowerCase() 
      : 'blog';
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a headline specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be generating compelling headlines in the brand voice: ${this.brandVoice}.

Your headlines should be attention-grabbing, clear, and persuasive, highlighting the benefits of Landing Pad Digital's AI website builder where appropriate.
    `;
    
    const userPrompt = `
Generate ${count} unique and compelling ${headlineType} headlines about "${topic}".

${targetAudience ? `Target audience: ${targetAudience}` : ''}

The headlines should:
1. Be attention-grabbing and compelling
2. Be clear and specific
3. Create curiosity or address a pain point
4. Be between 40-65 characters where possible
5. Include the topic naturally
${headlineType === 'cta' ? '6. Use action verbs and create urgency' : ''}

Format your response as a numbered list of headlines only.
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
        max_tokens: 1000
      });
      
      // Parse response to extract headlines
      const headlines = this._parseHeadlineResponse(response, count);
      
      return headlines.map(headline => ({
        text: headline,
        type: headlineType,
        topic,
        character_count: headline.length
      }));
    } catch (error) {
      this.logger.error('Error generating headlines:', error);
      throw new Error(`Failed to generate headlines: ${error.message}`);
    }
  }
  
  /**
   * Generate calls-to-action
   * @param {string} topic - Topic for the CTAs
   * @param {number} count - Number of CTAs to generate
   * @param {string} goal - Goal of the CTA
   * @returns {Array} Generated CTAs
   */
  async generateCtas(topic, count = 5, goal = 'conversion') {
    this.logger.info('Generating CTAs', { topic, count, goal });
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a conversion specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be generating compelling call-to-action (CTA) button text in the brand voice: ${this.brandVoice}.

Your CTAs should be action-oriented, clear, and create a sense of value or urgency.
    `;
    
    const userPrompt = `
Generate ${count} unique and compelling call-to-action button texts related to "${topic}" with the goal of ${goal}.

The CTAs should:
1. Use strong action verbs
2. Be concise (2-5 words)
3. Create a sense of value or urgency
4. Be specific and clear about the next step
5. Align with Landing Pad Digital's AI website builder offering

Format your response as a numbered list of CTA texts only.
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
        max_tokens: 500
      });
      
      // Parse response to extract CTAs
      const ctas = this._parseHeadlineResponse(response, count);
      
      return ctas.map(cta => ({
        text: cta,
        type: 'cta',
        topic,
        goal,
        character_count: cta.length
      }));
    } catch (error) {
      this.logger.error('Error generating CTAs:', error);
      throw new Error(`Failed to generate CTAs: ${error.message}`);
    }
  }
  
  /**
   * Generate headline variations
   * @param {string} originalHeadline - Original headline to create variations of
   * @param {number} count - Number of variations to generate
   * @returns {Array} Headline variations
   */
  async generateVariations(originalHeadline, count = 3) {
    this.logger.info('Generating headline variations', { originalHeadline, count });
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a headline specialist for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be generating variations of an existing headline while maintaining the brand voice: ${this.brandVoice}.

Your variations should keep the same main concept but use different wording, structure, or emotional appeal.
    `;
    
    const userPrompt = `
Generate ${count} unique variations of this headline:

"${originalHeadline}"

The variations should:
1. Keep the same core message and intent
2. Use different wording, structure, or emotional appeal
3. Be of similar length
4. Stay true to the brand voice

Format your response as a numbered list of headline variations only.
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
        max_tokens: 500
      });
      
      // Parse response to extract variations
      const variations = this._parseHeadlineResponse(response, count);
      
      return variations.map(variation => ({
        original: originalHeadline,
        variation,
        character_count: variation.length
      }));
    } catch (error) {
      this.logger.error('Error generating headline variations:', error);
      throw new Error(`Failed to generate headline variations: ${error.message}`);
    }
  }
  
  /**
   * Test headline effectiveness
   * @param {Array} headlines - Headlines to test
   * @returns {Array} Headlines with effectiveness scores
   */
  async testEffectiveness(headlines) {
    this.logger.info('Testing headline effectiveness', { count: headlines.length });
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a headline analysis expert for Landing Pad Digital, a company that offers an AI-powered website builder platform.
You will be evaluating headlines for their potential effectiveness.

Rate each headline on a scale of 1-10 based on:
1. Clarity (Is the message instantly clear?)
2. Appeal (Does it create interest or address a pain point?)
3. Relevance (Is it relevant to an AI website builder audience?)
4. Uniqueness (Does it stand out from common headlines?)
5. Action-orientation (Does it encourage the next step?)
    `;
    
    const userPrompt = `
Evaluate the following headlines for their effectiveness:

${headlines.map((h, i) => `${i + 1}. "${h}"`).join('\n')}

For each headline, provide:
1. Overall score (1-10)
2. Brief explanation (1-2 sentences)
3. One suggestion for improvement

Format your response as JSON with the headline text as the key and an object with score, explanation, and suggestion as the value.
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
            results = this._extractHeadlineResults(response, headlines);
          }
        } else {
          // If no JSON-like structure is found, extract results manually
          results = this._extractHeadlineResults(response, headlines);
        }
      }
      
      // Convert to array format
      return headlines.map(headline => {
        const result = results[headline] || {
          score: 5,
          explanation: 'No analysis available',
          suggestion: 'Consider revising for clarity and impact'
        };
        
        return {
          headline,
          score: result.score,
          explanation: result.explanation,
          suggestion: result.suggestion
        };
      });
    } catch (error) {
      this.logger.error('Error testing headline effectiveness:', error);
      throw new Error(`Failed to test headline effectiveness: ${error.message}`);
    }
  }
  
  /**
   * Parse headline response from AI
   * @private
   */
  _parseHeadlineResponse(response, count) {
    // Extract headlines from numbered list
    const headlineRegex = /\d+\.\s+(.+?)(?=\n\d+\.|\n*$)/g;
    const headlines = [];
    let match;
    
    while ((match = headlineRegex.exec(response)) !== null && headlines.length < count) {
      const headline = match[1].trim();
      // Remove quotes if present
      const cleanHeadline = headline.replace(/^["']|["']$/g, '');
      headlines.push(cleanHeadline);
    }
    
    // If regex failed to extract, use a simpler approach
    if (headlines.length === 0) {
      const lines = response.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      for (const line of lines) {
        // Remove numbering and quotes
        const cleanLine = line
          .replace(/^\d+\.\s+/, '')
          .replace(/^["']|["']$/g, '')
          .trim();
        
        if (cleanLine.length > 0) {
          headlines.push(cleanLine);
          if (headlines.length >= count) break;
        }
      }
    }
    
    // Use templates as fallback if no headlines were extracted
    if (headlines.length === 0) {
      const templates = this.headlineTemplates.blog || [
        'How to Build a Website with AI',
        'The Ultimate Guide to Website Creation',
        'Create Your Professional Website in Minutes'
      ];
      
      return templates.slice(0, count);
    }
    
    return headlines;
  }
  
  /**
   * Extract headline results when JSON parsing fails
   * @private
   */
  _extractHeadlineResults(response, headlines) {
    const results = {};
    
    for (const headline of headlines) {
      const headlinePattern = headline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex special chars
      const headlineRegex = new RegExp(`"${headlinePattern}"[\\s\\S]*?score:?\\s*(\\d+)[\\s\\S]*?explanation:?\\s*([^\\n]+(?:\\n[^\\n]+)*?)[\\s\\S]*?suggestion:?\\s*([^\\n]+)`, 'i');
      
      const match = response.match(headlineRegex);
      
      if (match) {
        results[headline] = {
          score: parseInt(match[1], 10),
          explanation: match[2].trim(),
          suggestion: match[3].trim()
        };
      } else {
        // Default values if no match found
        results[headline] = {
          score: 5,
          explanation: 'No analysis available',
          suggestion: 'Consider revising for clarity and impact'
        };
      }
    }
    
    return results;
  }
}

module.exports = HeadlineGenerator;