/**
 * Aligned Generator Module for Brand Consistency Agent
 * Generates content that aligns with brand voice, tone, and messaging
 */

const BaseModule = require('../../../common/models/base-module');

class AlignedGenerator extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'aligned_generator';
    this.referenceContent = [];
    this.alignmentStrength = 0.8;
    this.preserveKeyMessages = true;
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing aligned generator module');
    
    // Set configuration options
    if (this.config.settings) {
      this.referenceContentSource = this.config.settings.referenceContent || 'brand-exemplars';
      this.alignmentStrength = this.config.settings.alignmentStrength || 0.8;
      this.preserveKeyMessages = this.config.settings.preserveKeyMessages !== false;
    }
    
    // Create collections if they don't exist
    if (!this.storage.collections.brand_exemplars) {
      await this.storage.db.createCollection('brand_exemplars');
      this.storage.collections.brand_exemplars = this.storage.db.collection('brand_exemplars');
      
      // Create indexes
      await this.storage.collections.brand_exemplars.createIndex({ category: 1 });
      await this.storage.collections.brand_exemplars.createIndex({ quality_score: -1 });
    }
    
    if (!this.storage.collections.brand_voice) {
      await this.storage.db.createCollection('brand_voice');
      this.storage.collections.brand_voice = this.storage.db.collection('brand_voice');
    }
    
    // Load reference content
    await this._loadReferenceContent();
    
    // Load brand voice definition
    await this._loadBrandVoice();
    
    this.logger.info('Aligned generator module initialized');
  }

  /**
   * Generate brand-aligned content
   * 
   * @param {string} contentType - Type of content to generate
   * @param {Object} parameters - Content generation parameters
   * @returns {Object} Generated content
   */
  async generateAlignedContent(contentType, parameters) {
    this.logger.info('Generating aligned content', { contentType });
    
    // Get relevant reference content
    const references = this._getRelevantReferences(contentType, parameters);
    
    // Select generation method based on content type
    let content;
    
    switch (contentType) {
      case 'headline':
        content = await this._generateHeadline(parameters, references);
        break;
      case 'social_post':
        content = await this._generateSocialPost(parameters, references);
        break;
      case 'product_description':
        content = await this._generateProductDescription(parameters, references);
        break;
      case 'email':
        content = await this._generateEmail(parameters, references);
        break;
      case 'landing_page':
        content = await this._generateLandingPage(parameters, references);
        break;
      default:
        content = await this._generateGenericContent(contentType, parameters, references);
    }
    
    // Store generation record
    const generationId = await this._storeGenerationRecord(contentType, parameters, content);
    
    return {
      generation_id: generationId,
      content_type: contentType,
      content,
      generated_at: new Date(),
      parameters: this._sanitizeParameters(parameters)
    };
  }

  /**
   * Convert existing content to align with brand voice and tone
   * 
   * @param {Object} contentItem - Content to convert
   * @param {Object} options - Conversion options
   * @returns {Object} Converted content
   */
  async convertToBrandVoice(contentItem, options = {}) {
    this.logger.info('Converting content to brand voice', { 
      contentId: contentItem._id
    });
    
    // Extract content text
    const contentParts = this._extractContentParts(contentItem);
    
    // Convert each part
    const convertedParts = {};
    
    for (const [key, text] of Object.entries(contentParts)) {
      if (typeof text === 'string' && text.trim().length > 0) {
        convertedParts[key] = await this._alignTextToBrandVoice(
          text, 
          options.alignmentStrength || this.alignmentStrength,
          options.preserveKeyMessages || this.preserveKeyMessages
        );
      } else {
        convertedParts[key] = text;
      }
    }
    
    // Create converted content item
    const convertedContent = { ...contentItem };
    
    // Update each converted part
    for (const [key, value] of Object.entries(convertedParts)) {
      this._setNestedPropertyValue(convertedContent, key, value);
    }
    
    // Generate conversion notes
    const conversionNotes = await this._generateConversionNotes(contentParts, convertedParts);
    
    return {
      original_content_id: contentItem._id,
      converted_content: convertedContent,
      converted_at: new Date(),
      alignment_strength: options.alignmentStrength || this.alignmentStrength,
      notes: conversionNotes
    };
  }

  /**
   * Add new exemplary content to reference database
   * 
   * @param {Object} exemplar - Exemplary content
   * @returns {Object} Result of operation
   */
  async addReferenceContent(exemplar) {
    this.logger.info('Adding reference content', { 
      category: exemplar.category
    });
    
    // Validate exemplar
    if (!exemplar.content || !exemplar.category) {
      throw new Error('Exemplar must include content and category');
    }
    
    // Add metadata
    const exemplarWithMeta = {
      ...exemplar,
      added_at: new Date(),
      quality_score: exemplar.quality_score || 1
    };
    
    // Store in database
    const result = await this.storage.collections.brand_exemplars.insertOne(exemplarWithMeta);
    
    // Reload reference content
    await this._loadReferenceContent();
    
    return {
      success: true,
      exemplar_id: result.insertedId
    };
  }

  /**
   * Update brand voice definition
   * 
   * @param {Object} brandVoice - Brand voice definition
   * @returns {Object} Result of operation
   */
  async updateBrandVoice(brandVoice) {
    this.logger.info('Updating brand voice definition');
    
    // Validate brand voice
    if (!brandVoice.attributes || !Array.isArray(brandVoice.attributes)) {
      throw new Error('Brand voice must include attributes array');
    }
    
    // Add metadata
    const brandVoiceWithMeta = {
      ...brandVoice,
      updated_at: new Date()
    };
    
    // Store in database
    await this.storage.collections.brand_voice.deleteMany({});
    await this.storage.collections.brand_voice.insertOne(brandVoiceWithMeta);
    
    // Update local copy
    this.brandVoice = brandVoiceWithMeta;
    
    return {
      success: true
    };
  }

  /**
   * Load reference content from database
   * @private
   */
  async _loadReferenceContent() {
    this.logger.info('Loading reference content');
    
    // Load exemplars from database
    const exemplars = await this.storage.collections.brand_exemplars
      .find()
      .sort({ quality_score: -1 })
      .toArray();
    
    this.referenceContent = exemplars;
    
    this.logger.info('Reference content loaded', { count: exemplars.length });
    
    // If no exemplars, load defaults
    if (exemplars.length === 0) {
      await this._loadDefaultExemplars();
    }
  }

  /**
   * Load brand voice definition from database
   * @private
   */
  async _loadBrandVoice() {
    this.logger.info('Loading brand voice definition');
    
    // Load brand voice from database
    const brandVoice = await this.storage.collections.brand_voice.findOne();
    
    if (brandVoice) {
      this.brandVoice = brandVoice;
      this.logger.info('Brand voice loaded');
    } else {
      // Load default brand voice
      await this._loadDefaultBrandVoice();
    }
  }

  /**
   * Load default exemplary content for demo purposes
   * @private
   */
  async _loadDefaultExemplars() {
    this.logger.info('Loading default exemplars');
    
    const defaultExemplars = [
      {
        category: 'headline',
        content: 'Build Your Perfect Website in Minutes with AI-Powered Design',
        notes: 'Clear value proposition, emphasizes AI benefits, positive tone',
        quality_score: 5
      },
      {
        category: 'headline',
        content: 'Design Smarter, Not Harder: AI Website Builder for Modern Businesses',
        notes: 'Clever wordplay, focuses on efficiency, addresses business audience',
        quality_score: 4
      },
      {
        category: 'social_post',
        content: 'Struggling with web design? Let our AI Website Builder do the heavy lifting! With Landing Pad Digital, you can create a stunning, conversion-optimized site in minutes. No coding. No design skills. Just beautiful results. Try it free today! #AIWebsites #WebDesignMadeEasy',
        notes: 'Conversational, addresses pain point, clear call to action',
        quality_score: 5
      },
      {
        category: 'product_description',
        content: 'Landing Pad Digital's AI Website Builder transforms the website creation process from complicated to completed in minutes. Our intelligent design engine analyzes your business needs and generates custom layouts optimized for conversions. With smart content suggestions, responsive designs that look perfect on any device, and built-in SEO tools, you'll launch faster and perform better than ever before.',
        notes: 'Benefit-focused, emphasizes transformation, clear features and advantages',
        quality_score: 5
      },
      {
        category: 'email',
        content: 'Hi {first_name},\n\nI noticed you've been exploring website options for {company_name}. Building a great website shouldn't be complicated or expensive.\n\nLanding Pad Digital's AI Website Builder can help you create a professional site in minutes, not months. Our customers typically see:\n\n- 75% reduction in website development time\n- 40% improvement in conversion rates\n- 65% decrease in design costs\n\nWould you be interested in a 15-minute demo to see how it works?\n\nBest regards,\n{sales_rep_name}\nLanding Pad Digital',
        notes: 'Personal, problem-solution format, specific benefits with statistics',
        quality_score: 4
      },
      {
        category: 'landing_page',
        content: '# Transform Your Web Presence with AI-Powered Design\n\nCreate stunning, conversion-optimized websites in minutes without coding or design skills.\n\n## How It Works\n\n1. **Tell us about your business** - Answer a few simple questions about your goals\n2. **AI generates your site** - Our engine creates custom designs based on your needs\n3. **Customize and launch** - Fine-tune your site and publish with one click\n\n## Why Landing Pad Digital?\n\n- **Save Time** - Build in minutes, not months\n- **Increase Conversions** - AI-optimized for maximum results\n- **No Technical Skills Required** - User-friendly interface for everyone\n- **Always Professional** - Beautiful designs for any industry\n\n## Join 10,000+ Businesses Already Using Landing Pad Digital\n\n"I launched my new site in under an hour. The AI understood exactly what my business needed." - Sarah T., Small Business Owner',
        notes: 'Clear structure, benefit-focused headlines, social proof',
        quality_score: 5
      }
    ];
    
    // Add exemplars to database
    for (const exemplar of defaultExemplars) {
      await this.addReferenceContent({
        ...exemplar,
        source: 'default'
      });
    }
  }

  /**
   * Load default brand voice definition
   * @private
   */
  async _loadDefaultBrandVoice() {
    this.logger.info('Loading default brand voice');
    
    const defaultBrandVoice = {
      name: 'Landing Pad Digital Brand Voice',
      attributes: [
        {
          name: 'Professional',
          description: 'Knowledgeable without being academic, using clear language that establishes expertise'
        },
        {
          name: 'Approachable',
          description: 'Warm and conversational, speaking to users as peers rather than talking down to them'
        },
        {
          name: 'Confident',
          description: 'Decisive and assured without being arrogant, showing conviction in our solutions'
        },
        {
          name: 'Empowering',
          description: 'Focusing on enabling users, emphasizing what they can achieve with our tools'
        }
      ],
      do: [
        'Use active voice whenever possible',
        'Speak directly to the user with "you" and "your"',
        'Be concise and straightforward',
        'Use inclusive language that welcomes everyone',
        'Focus on benefits rather than just features',
        'Include specific examples and results when possible'
      ],
      dont: [
        'Use jargon or unnecessarily technical language',
        'Be negative about competitors or traditional methods',
        'Make exaggerated claims without evidence',
        'Use complex sentences with multiple clauses',
        'Be overly casual with slang or trendy expressions',
        'Sound robotic or template-driven'
      ],
      key_messages: [
        'AI technology makes website creation faster and easier',
        'Beautiful design and high conversion rates go hand-in-hand',
        'No technical skills are required to create professional websites',
        'Websites should continuously improve based on performance data'
      ]
    };
    
    await this.updateBrandVoice(defaultBrandVoice);
  }

  /**
   * Get relevant reference content for generation
   * @private
   */
  _getRelevantReferences(contentType, parameters) {
    // Find exact matches for content type
    const exactMatches = this.referenceContent.filter(ref => 
      ref.category === contentType
    );
    
    // If we have enough exact matches, use those
    if (exactMatches.length >= 3) {
      return exactMatches.slice(0, 5);
    }
    
    // If not enough exact matches, include other content types
    const otherReferences = this.referenceContent
      .filter(ref => ref.category !== contentType)
      .sort((a, b) => b.quality_score - a.quality_score)
      .slice(0, 5 - exactMatches.length);
    
    return [...exactMatches, ...otherReferences];
  }

  /**
   * Generate headline content
   * @private
   */
  async _generateHeadline(parameters, references) {
    const { topic, keywords = [], tone = 'professional', max_length = 60 } = parameters;
    
    // Get exemplary headlines
    const headlineExamples = references
      .filter(ref => ref.category === 'headline')
      .map(ref => ref.content)
      .join('\n');
    
    // Create prompt
    const prompt = `
Write a headline for a Landing Pad Digital webpage about: ${topic}

HEADLINE LENGTH: Maximum ${max_length} characters
TONE: ${tone}
KEYWORDS TO INCLUDE (if possible): ${keywords.join(', ')}

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

EXAMPLES OF GOOD HEADLINES:
${headlineExamples || 'Build Your Perfect Website in Minutes with AI-Powered Design'}

Write ONLY the headline text without quotation marks or additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 100
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating headline:', error);
      throw error;
    }
  }

  /**
   * Generate social post content
   * @private
   */
  async _generateSocialPost(parameters, references) {
    const { 
      platform = 'general', 
      topic, 
      tone = 'conversational',
      keywords = [],
      include_hashtags = true,
      include_emoji = true,
      max_length = 280
    } = parameters;
    
    // Get exemplary social posts
    const socialExamples = references
      .filter(ref => ref.category === 'social_post')
      .map(ref => ref.content)
      .join('\n\n---\n\n');
    
    // Create prompt
    const prompt = `
Write a social media post for Landing Pad Digital about: ${topic}

PLATFORM: ${platform}
TONE: ${tone}
MAXIMUM LENGTH: ${max_length} characters
KEYWORDS TO INCLUDE (if possible): ${keywords.join(', ')}
INCLUDE HASHTAGS: ${include_hashtags ? 'Yes' : 'No'}
INCLUDE EMOJI: ${include_emoji ? 'Yes' : 'No'}

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

EXAMPLES OF GOOD POSTS:
${socialExamples || 'Struggling with web design? Let our AI Website Builder do the heavy lifting! With Landing Pad Digital, you can create a stunning, conversion-optimized site in minutes. No coding. No design skills. Just beautiful results. Try it free today! #AIWebsites #WebDesignMadeEasy'}

Write ONLY the social media post without quotation marks or additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: Math.max(max_length * 2, 500)
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating social post:', error);
      throw error;
    }
  }

  /**
   * Generate product description content
   * @private
   */
  async _generateProductDescription(parameters, references) {
    const { 
      product, 
      features = [], 
      tone = 'professional',
      target_audience = 'general',
      emphasis = 'benefits',
      word_count = 200
    } = parameters;
    
    // Get exemplary product descriptions
    const descriptionExamples = references
      .filter(ref => ref.category === 'product_description')
      .map(ref => ref.content)
      .join('\n\n---\n\n');
    
    // Create prompt
    const prompt = `
Write a product description for Landing Pad Digital's product: ${product}

FEATURES TO HIGHLIGHT: ${features.join(', ')}
TONE: ${tone}
TARGET AUDIENCE: ${target_audience}
EMPHASIS: ${emphasis} (focus more on ${emphasis === 'benefits' ? 'benefits to users' : 'technical features'})
WORD COUNT: Approximately ${word_count} words

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

EXAMPLES OF GOOD PRODUCT DESCRIPTIONS:
${descriptionExamples || 'Landing Pad Digital's AI Website Builder transforms the website creation process from complicated to completed in minutes. Our intelligent design engine analyzes your business needs and generates custom layouts optimized for conversions. With smart content suggestions, responsive designs that look perfect on any device, and built-in SEO tools, you'll launch faster and perform better than ever before.'}

Write ONLY the product description without quotation marks or additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: Math.max(word_count * 10, 1000)
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating product description:', error);
      throw error;
    }
  }

  /**
   * Generate email content
   * @private
   */
  async _generateEmail(parameters, references) {
    const { 
      purpose, 
      recipient_type = 'prospect',
      tone = 'friendly professional',
      include_cta = true,
      personalization_fields = [],
      key_points = []
    } = parameters;
    
    // Get exemplary emails
    const emailExamples = references
      .filter(ref => ref.category === 'email')
      .map(ref => ref.content)
      .join('\n\n---\n\n');
    
    // Create prompt
    const prompt = `
Write an email for Landing Pad Digital with the purpose: ${purpose}

RECIPIENT TYPE: ${recipient_type}
TONE: ${tone}
INCLUDE CALL TO ACTION: ${include_cta ? 'Yes' : 'No'}
PERSONALIZATION FIELDS: ${personalization_fields.join(', ')}
KEY POINTS TO INCLUDE: ${key_points.join(', ')}

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

EXAMPLES OF GOOD EMAILS:
${emailExamples || 'Hi {first_name},\n\nI noticed you've been exploring website options for {company_name}. Building a great website shouldn't be complicated or expensive.\n\nLanding Pad Digital's AI Website Builder can help you create a professional site in minutes, not months. Our customers typically see:\n\n- 75% reduction in website development time\n- 40% improvement in conversion rates\n- 65% decrease in design costs\n\nWould you be interested in a 15-minute demo to see how it works?\n\nBest regards,\n{sales_rep_name}\nLanding Pad Digital'}

Write ONLY the email content without quotation marks or additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating email:', error);
      throw error;
    }
  }

  /**
   * Generate landing page content
   * @private
   */
  async _generateLandingPage(parameters, references) {
    const { 
      purpose, 
      target_audience, 
      key_features = [],
      benefits = [],
      include_testimonials = true,
      cta_text = 'Get Started Free',
      sections = ['hero', 'features', 'benefits', 'social_proof', 'cta']
    } = parameters;
    
    // Get exemplary landing pages
    const landingExamples = references
      .filter(ref => ref.category === 'landing_page')
      .map(ref => ref.content)
      .join('\n\n---\n\n');
    
    // Create prompt
    const prompt = `
Create landing page content for Landing Pad Digital with the purpose: ${purpose}

TARGET AUDIENCE: ${target_audience}
KEY FEATURES TO HIGHLIGHT: ${key_features.join(', ')}
KEY BENEFITS TO EMPHASIZE: ${benefits.join(', ')}
INCLUDE TESTIMONIALS: ${include_testimonials ? 'Yes' : 'No'}
CALL TO ACTION TEXT: ${cta_text}
SECTIONS TO INCLUDE: ${sections.join(', ')}

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

EXAMPLES OF GOOD LANDING PAGES:
${landingExamples || '# Transform Your Web Presence with AI-Powered Design\n\nCreate stunning, conversion-optimized websites in minutes without coding or design skills.\n\n## How It Works\n\n1. **Tell us about your business** - Answer a few simple questions about your goals\n2. **AI generates your site** - Our engine creates custom designs based on your needs\n3. **Customize and launch** - Fine-tune your site and publish with one click\n\n## Why Landing Pad Digital?\n\n- **Save Time** - Build in minutes, not months\n- **Increase Conversions** - AI-optimized for maximum results\n- **No Technical Skills Required** - User-friendly interface for everyone\n- **Always Professional** - Beautiful designs for any industry\n\n## Join 10,000+ Businesses Already Using Landing Pad Digital\n\n"I launched my new site in under an hour. The AI understood exactly what my business needed." - Sarah T., Small Business Owner'}

Format the landing page content using Markdown. Write ONLY the landing page content without additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating landing page:', error);
      throw error;
    }
  }

  /**
   * Generate generic content for types not specifically handled
   * @private
   */
  async _generateGenericContent(contentType, parameters, references) {
    const { 
      purpose, 
      tone = 'professional',
      key_points = [],
      length = 'medium'
    } = parameters;
    
    // Get similar examples if available
    const similarExamples = references
      .filter(ref => ref.category === contentType)
      .map(ref => ref.content)
      .join('\n\n---\n\n');
    
    // Word count based on length parameter
    const wordCount = {
      short: 100,
      medium: 300,
      long: 600
    }[length] || 300;
    
    // Create prompt
    const prompt = `
Create ${contentType} content for Landing Pad Digital with the purpose: ${purpose}

TONE: ${tone}
KEY POINTS TO INCLUDE: ${key_points.join(', ')}
APPROXIMATE WORD COUNT: ${wordCount} words

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

${similarExamples ? `EXAMPLES OF SIMILAR CONTENT:\n${similarExamples}` : ''}

Write ONLY the content without quotation marks or additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: Math.max(wordCount * 10, 1500)
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error(`Error generating ${contentType} content:`, error);
      throw error;
    }
  }

  /**
   * Store record of content generation
   * @private
   */
  async _storeGenerationRecord(contentType, parameters, content) {
    try {
      // Generate record ID
      const generationId = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Create record
      const record = {
        generation_id: generationId,
        content_type: contentType,
        parameters: this._sanitizeParameters(parameters),
        content_preview: typeof content === 'string' 
          ? content.substring(0, 100) + (content.length > 100 ? '...' : '')
          : 'Structured content',
        generated_at: new Date(),
        generation_model: 'claude-2'
      };
      
      // Store in database
      if (this.storage.collections.content_generations) {
        await this.storage.collections.content_generations.insertOne(record);
      } else {
        // Create collection if it doesn't exist
        await this.storage.db.createCollection('content_generations');
        this.storage.collections.content_generations = this.storage.db.collection('content_generations');
        await this.storage.collections.content_generations.insertOne(record);
      }
      
      return generationId;
    } catch (error) {
      this.logger.error('Error storing generation record:', error);
      return `gen_${Date.now()}`;
    }
  }

  /**
   * Format brand voice definition for inclusion in prompts
   * @private
   */
  _formatBrandVoiceForPrompt() {
    if (!this.brandVoice) {
      return 'Professional, approachable, confident, and empowering';
    }
    
    let prompt = '';
    
    // Add voice attributes
    if (this.brandVoice.attributes && this.brandVoice.attributes.length > 0) {
      prompt += 'Voice Attributes:\n';
      for (const attr of this.brandVoice.attributes) {
        prompt += `- ${attr.name}: ${attr.description}\n`;
      }
      prompt += '\n';
    }
    
    // Add dos and don'ts
    if (this.brandVoice.do && this.brandVoice.do.length > 0) {
      prompt += 'Do:\n';
      for (const item of this.brandVoice.do) {
        prompt += `- ${item}\n`;
      }
      prompt += '\n';
    }
    
    if (this.brandVoice.dont && this.brandVoice.dont.length > 0) {
      prompt += 'Don\'t:\n';
      for (const item of this.brandVoice.dont) {
        prompt += `- ${item}\n`;
      }
      prompt += '\n';
    }
    
    // Add key messages
    if (this.brandVoice.key_messages && this.brandVoice.key_messages.length > 0) {
      prompt += 'Key Messages:\n';
      for (const message of this.brandVoice.key_messages) {
        prompt += `- ${message}\n`;
      }
    }
    
    return prompt;
  }

  /**
   * Extract content parts from content item
   * @private
   */
  _extractContentParts(contentItem) {
    const parts = {};
    
    // Extract title and meta description
    if (contentItem.title) {
      parts['title'] = contentItem.title;
    }
    
    if (contentItem.meta_description) {
      parts['meta_description'] = contentItem.meta_description;
    }
    
    // Extract content based on structure
    if (typeof contentItem.content === 'string') {
      parts['content'] = contentItem.content;
    } else if (contentItem.content && typeof contentItem.content === 'object') {
      // Handle structured content
      this._extractPartsFromObject(contentItem.content, parts, 'content');
    }
    
    return parts;
  }

  /**
   * Recursively extract parts from nested object
   * @private
   */
  _extractPartsFromObject(obj, parts, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        parts[path] = value;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this._extractPartsFromObject(value, parts, path);
      }
    }
  }

  /**
   * Align text to brand voice
   * @private
   */
  async _alignTextToBrandVoice(text, alignmentStrength, preserveKeyMessages) {
    // Skip if text is too short
    if (text.length < 10) {
      return text;
    }
    
    // Create prompt
    const prompt = `
Rewrite the following text to match Landing Pad Digital's brand voice while preserving the key information:

ORIGINAL TEXT:
"${text}"

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

ALIGNMENT STRENGTH: ${alignmentStrength * 10}/10 (higher = more brand-aligned, may deviate more from original)
PRESERVE KEY MESSAGES: ${preserveKeyMessages ? 'Yes' : 'No'}

Rewrite the text to sound like it was written by Landing Pad Digital, maintaining the original meaning 
but aligning tone, style, and messaging with our brand voice.

Return ONLY the rewritten text without quotation marks or additional explanation.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: Math.max(text.length * 1.5, 1000)
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error aligning text to brand voice:', error);
      return text; // Return original text on error
    }
  }

  /**
   * Generate notes about conversion to brand voice
   * @private
   */
  async _generateConversionNotes(originalParts, convertedParts) {
    // Create sample of before/after
    const samples = [];
    for (const [key, originalValue] of Object.entries(originalParts)) {
      if (typeof originalValue === 'string' && originalValue.trim().length > 0) {
        const convertedValue = convertedParts[key];
        
        if (convertedValue && originalValue !== convertedValue) {
          samples.push({
            part: key,
            original: originalValue.substring(0, 100) + (originalValue.length > 100 ? '...' : ''),
            converted: convertedValue.substring(0, 100) + (convertedValue.length > 100 ? '...' : '')
          });
        }
      }
    }
    
    // If no changes, return simple note
    if (samples.length === 0) {
      return 'No significant changes were made to align with brand voice.';
    }
    
    // Use first sample for analysis
    const analysisPrompt = `
Analyze how the following text was converted to match our brand voice:

ORIGINAL:
"${samples[0].original}"

CONVERTED:
"${samples[0].converted}"

BRAND VOICE:
${this._formatBrandVoiceForPrompt()}

Provide a brief analysis (150 words or less) of how the text was changed to match our brand voice.
Focus on specific changes in tone, style, and messaging.
`;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.4,
        max_tokens: 200
      });
      
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating conversion notes:', error);
      return `Converted ${samples.length} content sections to align with Landing Pad Digital's brand voice.`;
    }
  }

  /**
   * Remove sensitive information from parameters
   * @private
   */
  _sanitizeParameters(parameters) {
    // Create a copy to avoid modifying the original
    const sanitized = { ...parameters };
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['api_key', 'password', 'secret', 'token', 'auth'];
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Set nested property value in object
   * @private
   */
  _setNestedPropertyValue(obj, path, value) {
    if (!path) return;
    
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      
      if (current[part] === undefined) {
        current[part] = {};
      }
      
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
}

module.exports = AlignedGenerator;