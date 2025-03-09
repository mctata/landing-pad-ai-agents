/**
 * Website Copy Generator Module
 * Generates copy for website pages and landing pages
 */

const BaseModule = require('../../../common/models/base-module');

class WebsiteCopyGenerator extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'website_copy_generator';
    this.pageTypes = [
      'homepage', 'about', 'features', 'pricing', 
      'contact', 'landing_page', 'services'
    ];
  }
  
  async initialize() {
    this.logger.info('Initializing website copy generator module');
    
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
    
    // Load AI website builder features
    try {
      const features = await this.storage.collections.product_features.find(
        { category: 'ai_website_builder' }
      ).toArray();
      
      if (features && features.length > 0) {
        this.productFeatures = features.map(f => ({
          name: f.name,
          description: f.description
        }));
        this.logger.info('Loaded product features', { count: features.length });
      } else {
        this.productFeatures = [
          { name: 'AI Content Generation', description: 'Automatically generate website content based on your business information' },
          { name: 'Smart Layout Recommendations', description: 'Get AI-powered layout recommendations optimized for your industry' },
          { name: 'Conversion Optimization', description: 'AI helps optimize your site for better conversion rates' }
        ];
        this.logger.warn('Product features not found, using defaults');
      }
    } catch (error) {
      this.logger.error('Error loading product features:', error);
      this.productFeatures = [
        { name: 'AI Content Generation', description: 'Automatically generate website content based on your business information' },
        { name: 'Smart Layout Recommendations', description: 'Get AI-powered layout recommendations optimized for your industry' },
        { name: 'Conversion Optimization', description: 'AI helps optimize your site for better conversion rates' }
      ];
    }
    
    // Load page section templates
    this.sectionTemplates = {
      hero: {
        elements: ['headline', 'subheadline', 'cta_button'],
        maxLength: 150
      },
      features: {
        elements: ['heading', 'intro', 'feature_items'],
        maxLength: 500
      },
      benefits: {
        elements: ['heading', 'benefit_items'],
        maxLength: 400
      },
      testimonials: {
        elements: ['heading', 'testimonial_intro'],
        maxLength: 200
      },
      cta: {
        elements: ['heading', 'description', 'button_text'],
        maxLength: 150
      },
      about: {
        elements: ['heading', 'company_description', 'mission', 'values'],
        maxLength: 600
      },
      pricing: {
        elements: ['heading', 'pricing_intro', 'plan_descriptions'],
        maxLength: 400
      }
    };
  }
  
  /**
   * Generate website copy based on a content brief
   * @param {Object} brief - Content brief with page type, business info, and other metadata
   * @returns {Object} Generated website copy
   */
  async generate(brief) {
    const { 
      type: pageType = 'landing_page', 
      business_info = {}, 
      target_audience,
      sections = ['hero', 'features', 'benefits', 'cta'],
      keywords = []
    } = brief;
    
    this.logger.info('Generating website copy', { pageType, sections });
    
    // Determine the target page type
    const targetPageType = this.pageTypes.includes(pageType.toLowerCase()) 
      ? pageType.toLowerCase() 
      : 'landing_page';
    
    // Process audience information
    const audienceInfo = typeof target_audience === 'string' 
      ? target_audience 
      : JSON.stringify(target_audience || 'small business owners');
    
    // Generate copy for each requested section
    const pageSections = {};
    
    for (const section of sections) {
      if (this.sectionTemplates[section]) {
        pageSections[section] = await this._generateSection(
          section,
          targetPageType,
          business_info,
          audienceInfo,
          keywords
        );
      }
    }
    
    // Generate SEO metadata
    const seoMetadata = await this._generateSeoMetadata(
      targetPageType,
      business_info,
      keywords
    );
    
    return {
      page_type: targetPageType,
      sections: pageSections,
      seo_metadata: seoMetadata,
      generated_at: new Date()
    };
  }
  
  /**
   * Generate a complete landing page
   * @param {Object} brief - Landing page brief
   * @returns {Object} Complete landing page content
   */
  async generateLandingPage(brief) {
    const { 
      title, 
      business_info = {}, 
      target_audience,
      value_proposition,
      primary_cta,
      secondary_cta,
      keywords = []
    } = brief;
    
    this.logger.info('Generating landing page', { title });
    
    // Process audience information
    const audienceInfo = typeof target_audience === 'string' 
      ? target_audience 
      : JSON.stringify(target_audience || 'small business owners');
    
    // Construct the prompt for the AI
    const systemPrompt = `
You are a professional website copywriter for Landing Pad Digital, a company that offers an AI-powered website builder platform. 
Write in the following brand voice: ${this.brandVoice}.

Create conversion-focused landing page copy that highlights the benefits of Landing Pad Digital's AI website builder for the target audience.

Key product features to mention:
${this.productFeatures.map(f => `- ${f.name}: ${f.description}`).join('\n')}
    `;
    
    const userPrompt = `
Create complete landing page copy for a page titled "${title}".

Target audience: ${audienceInfo}
Value proposition: ${value_proposition || 'Create professional websites in minutes with AI-powered assistance'}
Primary CTA: ${primary_cta || 'Start Building for Free'}
Secondary CTA: ${secondary_cta || 'View Templates'}
Business information: ${JSON.stringify(business_info)}
Keywords to include: ${keywords.join(', ')}

Include the following sections:
1. Hero section (headline, subheadline, CTA button text)
2. Features section (heading, 3-4 key features with brief descriptions)
3. Benefits section (heading, 3-4 benefits with brief descriptions)
4. How it works section (heading, 3-4 steps with brief descriptions)
5. Testimonial section placeholder (heading and intro text)
6. Call to action section (heading, brief description, button text)

Also include SEO metadata (title tag, meta description).

Format each section clearly in your response.
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
        max_tokens: 3000
      });
      
      // Parse response to extract sections
      return this._parseLandingPageResponse(response, title);
    } catch (error) {
      this.logger.error('Error generating landing page:', error);
      throw new Error(`Failed to generate landing page: ${error.message}`);
    }
  }
  
  /**
   * Generate a single section of website copy
   * @private
   */
  async _generateSection(sectionType, pageType, businessInfo, audienceInfo, keywords) {
    const template = this.sectionTemplates[sectionType];
    
    if (!template) {
      throw new Error(`Section template not found: ${sectionType}`);
    }
    
    const systemPrompt = `
You are a professional website copywriter for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Write in the following brand voice: ${this.brandVoice}.

You are creating copy for a ${sectionType} section of a ${pageType} page.
    `;
    
    const userPrompt = `
Write compelling copy for a ${sectionType} section of a ${pageType} page for Landing Pad Digital's AI website builder.

Target audience: ${audienceInfo}
Business information: ${JSON.stringify(businessInfo)}
Keywords to include: ${keywords.join(', ')}

The section should include: ${template.elements.join(', ')}
Maximum length: ${template.maxLength} characters

Format your response as JSON with keys matching the elements listed above.
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
        max_tokens: 1000
      });
      
      // Parse JSON response
      let sectionContent;
      try {
        // First, try to parse the response as JSON directly
        sectionContent = JSON.parse(response);
      } catch (parseError) {
        // If that fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            sectionContent = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            // If JSON parsing fails, create a structured object manually
            sectionContent = this._extractSectionContent(response, template.elements);
          }
        } else {
          // If no JSON-like structure is found, extract content manually
          sectionContent = this._extractSectionContent(response, template.elements);
        }
      }
      
      return {
        ...sectionContent,
        section_type: sectionType
      };
    } catch (error) {
      this.logger.error(`Error generating ${sectionType} section:`, error);
      throw new Error(`Failed to generate ${sectionType} section: ${error.message}`);
    }
  }
  
  /**
   * Generate SEO metadata for a page
   * @private
   */
  async _generateSeoMetadata(pageType, businessInfo, keywords) {
    const systemPrompt = `
You are an SEO specialist creating metadata for Landing Pad Digital's website pages.
    `;
    
    const userPrompt = `
Create SEO metadata for a ${pageType} page about Landing Pad Digital's AI website builder.

Business information: ${JSON.stringify(businessInfo)}
Keywords to include: ${keywords.join(', ')}

Include:
1. Title tag (max 60 characters)
2. Meta description (max 155 characters)
3. Focus keyword
4. 3-5 secondary keywords

Format your response as JSON.
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
      
      // Parse JSON response
      let metadata;
      try {
        // Try to parse the response as JSON
        metadata = JSON.parse(response);
      } catch (parseError) {
        // If that fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            metadata = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            // If JSON parsing fails, create a structured object manually
            metadata = this._extractMetadata(response);
          }
        } else {
          // If no JSON-like structure is found, extract metadata manually
          metadata = this._extractMetadata(response);
        }
      }
      
      return metadata;
    } catch (error) {
      this.logger.error('Error generating SEO metadata:', error);
      throw new Error(`Failed to generate SEO metadata: ${error.message}`);
    }
  }
  
  /**
   * Parse landing page response into structured content
   * @private
   */
  _parseLandingPageResponse(response, title) {
    const sections = {};
    const sectionTypes = ['hero', 'features', 'benefits', 'how_it_works', 'testimonial', 'cta'];
    
    // Extract SEO metadata
    const titleTagMatch = response.match(/Title Tag:?\s*([^\n]+)/i);
    const metaDescriptionMatch = response.match(/Meta Description:?\s*([^\n]+)/i);
    
    const seoMetadata = {
      title_tag: titleTagMatch ? titleTagMatch[1].trim() : `${title} | Landing Pad Digital`,
      meta_description: metaDescriptionMatch 
        ? metaDescriptionMatch[1].trim() 
        : `Create professional websites in minutes with Landing Pad Digital's AI-powered website builder.`
    };
    
    // Extract each section
    for (const sectionType of sectionTypes) {
      const sectionRegex = new RegExp(`${sectionType} section:?\\s*([\\s\\S]*?)(?=\\n\\s*\\d+\\.\\s*|\\n\\s*$|$)`, 'i');
      const sectionMatch = response.match(sectionRegex);
      
      if (sectionMatch) {
        const sectionContent = sectionMatch[1].trim();
        
        // Further parse the section based on its type
        switch (sectionType.toLowerCase()) {
          case 'hero':
            sections.hero = this._parseHeroSection(sectionContent);
            break;
          case 'features':
            sections.features = this._parseFeaturesSection(sectionContent);
            break;
          case 'benefits':
            sections.benefits = this._parseBenefitsSection(sectionContent);
            break;
          case 'how_it_works':
            sections.how_it_works = this._parseHowItWorksSection(sectionContent);
            break;
          case 'testimonial':
            sections.testimonial = this._parseTestimonialSection(sectionContent);
            break;
          case 'cta':
            sections.cta = this._parseCtaSection(sectionContent);
            break;
          default:
            // For any other section, store the raw content
            sections[sectionType] = { content: sectionContent };
        }
      }
    }
    
    return {
      title,
      sections,
      seo_metadata: seoMetadata,
      generated_at: new Date()
    };
  }
  
  /**
   * Parse hero section content
   * @private
   */
  _parseHeroSection(content) {
    const headlineMatch = content.match(/headline:?\s*([^\n]+)/i) || 
                           content.match(/title:?\s*([^\n]+)/i) || 
                           content.match(/^(.+)$/m);
    
    const subheadlineMatch = content.match(/subheadline:?\s*([^\n]+(?:\n[^\n]+)*)/i) || 
                              content.match(/subtitle:?\s*([^\n]+(?:\n[^\n]+)*)/i) || 
                              content.match(/^.+\n(.+)$/m);
    
    const ctaButtonMatch = content.match(/cta button:?\s*([^\n]+)/i) || 
                            content.match(/button:?\s*([^\n]+)/i) ||
                            content.match(/cta:?\s*([^\n]+)/i);
    
    return {
      section_type: 'hero',
      headline: headlineMatch ? headlineMatch[1].trim() : 'Build Your Website in Minutes with AI',
      subheadline: subheadlineMatch ? subheadlineMatch[1].trim() : 'Let artificial intelligence do the hard work for you',
      cta_button: ctaButtonMatch ? ctaButtonMatch[1].trim() : 'Start Building for Free'
    };
  }
  
  /**
   * Parse features section content
   * @private
   */
  _parseFeaturesSection(content) {
    const headingMatch = content.match(/heading:?\s*([^\n]+)/i) || 
                          content.match(/title:?\s*([^\n]+)/i) || 
                          content.match(/^(.+)$/m);
    
    const introMatch = content.match(/intro:?\s*([^\n]+(?:\n[^\n]+)*)/i) || 
                        content.match(/introduction:?\s*([^\n]+(?:\n[^\n]+)*)/i);
    
    // Extract feature items using numbered or bulleted list patterns
    const featureRegex = /(?:(?:\d+|-)[\s\.]+|feature\s+\d+:?\s+|•\s+)(.+?)(?:\s*:\s*|\s*-\s*|\n)([^]*?)(?=(?:\n+(?:\d+|-)[\s\.]+|feature\s+\d+:|•\s+|\n\s*$|$))/gi;
    
    const featureItems = [];
    let featureMatch;
    
    while ((featureMatch = featureRegex.exec(content)) !== null) {
      featureItems.push({
        title: featureMatch[1].trim(),
        description: featureMatch[2].trim()
      });
    }
    
    // If regex didn't work, try a simpler approach
    if (featureItems.length === 0) {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^[-•*]|^\d+\.\s+/)) {
          const parts = line.replace(/^[-•*]|^\d+\.\s+/, '').split(/:\s*|--\s*/);
          if (parts.length > 1) {
            featureItems.push({
              title: parts[0].trim(),
              description: parts[1].trim()
            });
          } else {
            featureItems.push({
              title: parts[0].trim(),
              description: ''
            });
          }
        }
      }
    }
    
    return {
      section_type: 'features',
      heading: headingMatch ? headingMatch[1].trim() : 'Powerful Features',
      intro: introMatch ? introMatch[1].trim() : 'Our AI-powered website builder makes creating professional websites easy and fast.',
      feature_items: featureItems.length > 0 ? featureItems : [
        { title: 'AI Content Generation', description: 'Get professionally written content tailored to your business' },
        { title: 'Smart Layout Recommendations', description: 'Receive AI-powered layout suggestions for your industry' },
        { title: 'Conversion Optimization', description: 'Boost conversions with AI-driven design and content recommendations' }
      ]
    };
  }
  
  /**
   * Parse benefits section content
   * @private
   */
  _parseBenefitsSection(content) {
    const headingMatch = content.match(/heading:?\s*([^\n]+)/i) || 
                          content.match(/title:?\s*([^\n]+)/i) || 
                          content.match(/^(.+)$/m);
    
    // Extract benefit items
    const benefitRegex = /(?:(?:\d+|-)[\s\.]+|benefit\s+\d+:?\s+|•\s+)(.+?)(?:\s*:\s*|\s*-\s*|\n)([^]*?)(?=(?:\n+(?:\d+|-)[\s\.]+|benefit\s+\d+:|•\s+|\n\s*$|$))/gi;
    
    const benefitItems = [];
    let benefitMatch;
    
    while ((benefitMatch = benefitRegex.exec(content)) !== null) {
      benefitItems.push({
        title: benefitMatch[1].trim(),
        description: benefitMatch[2].trim()
      });
    }
    
    // If regex didn't work, try a simpler approach
    if (benefitItems.length === 0) {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^[-•*]|^\d+\.\s+/)) {
          const parts = line.replace(/^[-•*]|^\d+\.\s+/, '').split(/:\s*|--\s*/);
          if (parts.length > 1) {
            benefitItems.push({
              title: parts[0].trim(),
              description: parts[1].trim()
            });
          } else {
            benefitItems.push({
              title: parts[0].trim(),
              description: ''
            });
          }
        }
      }
    }
    
    return {
      section_type: 'benefits',
      heading: headingMatch ? headingMatch[1].trim() : 'Why Choose Our AI Website Builder',
      benefit_items: benefitItems.length > 0 ? benefitItems : [
        { title: 'Save Time', description: 'Build professional websites in minutes, not weeks' },
        { title: 'Professional Results', description: 'Get expert-level design and content without hiring specialists' },
        { title: 'Cost Effective', description: 'Reduce website development costs significantly' }
      ]
    };
  }
  
  /**
   * Parse how it works section content
   * @private
   */
  _parseHowItWorksSection(content) {
    const headingMatch = content.match(/heading:?\s*([^\n]+)/i) || 
                          content.match(/title:?\s*([^\n]+)/i) || 
                          content.match(/^(.+)$/m);
    
    // Extract step items
    const stepRegex = /(?:(?:\d+|-)[\s\.]+|step\s+\d+:?\s+|•\s+)(.+?)(?:\s*:\s*|\s*-\s*|\n)([^]*?)(?=(?:\n+(?:\d+|-)[\s\.]+|step\s+\d+:|•\s+|\n\s*$|$))/gi;
    
    const stepItems = [];
    let stepMatch;
    
    while ((stepMatch = stepRegex.exec(content)) !== null) {
      stepItems.push({
        title: stepMatch[1].trim(),
        description: stepMatch[2].trim()
      });
    }
    
    // If regex didn't work, try a simpler approach
    if (stepItems.length === 0) {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^[-•*]|^\d+\.\s+/)) {
          const parts = line.replace(/^[-•*]|^\d+\.\s+/, '').split(/:\s*|--\s*/);
          if (parts.length > 1) {
            stepItems.push({
              title: parts[0].trim(),
              description: parts[1].trim()
            });
          } else {
            stepItems.push({
              title: parts[0].trim(),
              description: ''
            });
          }
        }
      }
    }
    
    return {
      section_type: 'how_it_works',
      heading: headingMatch ? headingMatch[1].trim() : 'How It Works',
      step_items: stepItems.length > 0 ? stepItems : [
        { title: 'Share Your Business Info', description: 'Tell us about your business and goals' },
        { title: 'AI Creates Your Website', description: 'Our AI generates content and design for your review' },
        { title: 'Customize and Launch', description: 'Make final adjustments and publish your website' }
      ]
    };
  }
  
  /**
   * Parse testimonial section content
   * @private
   */
  _parseTestimonialSection(content) {
    const headingMatch = content.match(/heading:?\s*([^\n]+)/i) || 
                          content.match(/title:?\s*([^\n]+)/i) || 
                          content.match(/^(.+)$/m);
    
    const introMatch = content.match(/intro:?\s*([^\n]+(?:\n[^\n]+)*)/i) || 
                        content.match(/introduction:?\s*([^\n]+(?:\n[^\n]+)*)/i);
    
    return {
      section_type: 'testimonial',
      heading: headingMatch ? headingMatch[1].trim() : 'What Our Customers Say',
      testimonial_intro: introMatch ? introMatch[1].trim() : 'Here\'s what business owners are saying about Landing Pad Digital\'s AI website builder.'
    };
  }
  
  /**
   * Parse CTA section content
   * @private
   */
  _parseCtaSection(content) {
    const headingMatch = content.match(/heading:?\s*([^\n]+)/i) || 
                         content.match(/title:?\s*([^\n]+)/i) || 
                         content.match(/^(.+)$/m);
    
    const descriptionMatch = content.match(/description:?\s*([^\n]+(?:\n[^\n]+)*)/i) || 
                             content.match(/text:?\s*([^\n]+(?:\n[^\n]+)*)/i);
    
    const buttonTextMatch = content.match(/button text:?\s*([^\n]+)/i) || 
                            content.match(/button:?\s*([^\n]+)/i) ||
                            content.match(/cta:?\s*([^\n]+)/i);
    
    return {
      section_type: 'cta',
      heading: headingMatch ? headingMatch[1].trim() : 'Ready to Build Your Website?',
      description: descriptionMatch ? descriptionMatch[1].trim() : 'Get started today and launch your professional website in minutes.',
      button_text: buttonTextMatch ? buttonTextMatch[1].trim() : 'Start Building for Free'
    };
  }
  
  /**
   * Extract section content when JSON parsing fails
   * @private
   */
  _extractSectionContent(response, elements) {
    const content = {};
    
    for (const element of elements) {
      const elementRegex = new RegExp(`${element.replace(/_/g, ' ')}:?\\s*([^\\n]+(?:\\n[^\\n]+)*)`, 'i');
      const match = response.match(elementRegex);
      
      if (match) {
        content[element] = match[1].trim();
      } else {
        content[element] = '';
      }
    }
    
    return content;
  }
  
  /**
   * Extract metadata when JSON parsing fails
   * @private
   */
  _extractMetadata(response) {
    const titleMatch = response.match(/title tag:?\s*([^\n]+)/i);
    const descriptionMatch = response.match(/meta description:?\s*([^\n]+)/i);
    const focusKeywordMatch = response.match(/focus keyword:?\s*([^\n]+)/i);
    const secondaryKeywordsMatch = response.match(/secondary keywords:?\s*([^\n]+)/i);
    
    return {
      title_tag: titleMatch ? titleMatch[1].trim() : '',
      meta_description: descriptionMatch ? descriptionMatch[1].trim() : '',
      focus_keyword: focusKeywordMatch ? focusKeywordMatch[1].trim() : '',
      secondary_keywords: secondaryKeywordsMatch 
        ? secondaryKeywordsMatch[1].split(/,\s*/).map(k => k.trim()) 
        : []
    };
  }
}

module.exports = WebsiteCopyGenerator;