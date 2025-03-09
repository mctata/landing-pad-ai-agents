/**
 * Content Categoriser Module
 * Automatically categorises content based on its content and metadata
 */

const BaseModule = require('../../../common/models/base-module');

class ContentCategoriser extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'content_categoriser';
  }
  
  async initialize() {
    this.logger.info('Initializing content categoriser module');
    
    // Load category taxonomy
    try {
      const taxonomy = await this.storage.collections.category_taxonomy.find().toArray();
      
      if (taxonomy && taxonomy.length > 0) {
        this.taxonomy = taxonomy;
        this.logger.info('Loaded category taxonomy', { count: taxonomy.length });
      } else {
        // Default taxonomy if none exists in database
        this.taxonomy = [
          {
            id: 'website_building',
            name: 'Website Building',
            description: 'Content about creating and managing websites',
            keywords: ['website', 'web design', 'web development', 'site', 'webpage']
          },
          {
            id: 'ai_technology',
            name: 'AI Technology',
            description: 'Content about artificial intelligence technology',
            keywords: ['AI', 'artificial intelligence', 'machine learning', 'ML', 'automation']
          },
          {
            id: 'digital_marketing',
            name: 'Digital Marketing',
            description: 'Content about online marketing strategies',
            keywords: ['marketing', 'digital marketing', 'SEO', 'PPC', 'social media marketing']
          },
          {
            id: 'business_tips',
            name: 'Business Tips',
            description: 'Content offering business advice and tips',
            keywords: ['business', 'entrepreneurship', 'startup', 'tips', 'advice']
          },
          {
            id: 'design_inspiration',
            name: 'Design Inspiration',
            description: 'Content about design trends and inspiration',
            keywords: ['design', 'UI', 'UX', 'trends', 'inspiration', 'creative']
          }
        ];
        
        // Save default taxonomy to database
        await Promise.all(this.taxonomy.map(category => 
          this.storage.collections.category_taxonomy.insertOne(category)
        ));
        
        this.logger.warn('Category taxonomy not found, created default taxonomy');
      }
    } catch (error) {
      this.logger.error('Error loading category taxonomy:', error);
      this.taxonomy = [];
    }
  }
  
  /**
   * Categorise content based on its content and metadata
   * @param {Object} contentItem - Content item to categorise
   * @param {Array} manualCategories - Optional manual category assignments
   * @returns {Array} Assigned categories
   */
  async categorise(contentItem, manualCategories = []) {
    this.logger.info('Categorising content', { 
      contentId: contentItem._id,
      type: contentItem.type,
      hasManualCategories: manualCategories.length > 0
    });
    
    // If manual categories are provided, use those
    if (manualCategories.length > 0) {
      // Validate manual categories against taxonomy
      const validCategories = manualCategories.filter(categoryId => 
        this.taxonomy.some(taxCategory => taxCategory.id === categoryId)
      );
      
      if (validCategories.length > 0) {
        this.logger.info('Using manual categories', { count: validCategories.length });
        return validCategories;
      }
    }
    
    // For small taxonomy, we can use keyword matching for efficiency
    if (this.taxonomy.length < 20) {
      const keywordCategories = await this._categoriseByKeywords(contentItem);
      
      if (keywordCategories.length > 0) {
        this.logger.info('Categorised by keywords', { count: keywordCategories.length });
        return keywordCategories;
      }
    }
    
    // Fall back to AI categorisation for more complex cases
    return this._categoriseWithAI(contentItem);
  }
  
  /**
   * Categorise content using keyword matching
   * @private
   */
  async _categoriseByKeywords(contentItem) {
    // Extract text from the content
    let contentText = '';
    
    if (typeof contentItem.content === 'string') {
      contentText = contentItem.content;
    } else if (contentItem.content && typeof contentItem.content === 'object') {
      // Handle different content structures
      if (contentItem.content.title) contentText += contentItem.content.title + ' ';
      if (contentItem.content.content) contentText += contentItem.content.content + ' ';
      if (contentItem.content.meta_description) contentText += contentItem.content.meta_description + ' ';
      
      // Handle nested sections (e.g., for website copy)
      if (contentItem.content.sections) {
        for (const [sectionKey, section] of Object.entries(contentItem.content.sections)) {
          if (section.heading) contentText += section.heading + ' ';
          if (section.subheading) contentText += section.subheading + ' ';
          if (section.content) contentText += section.content + ' ';
          if (section.description) contentText += section.description + ' ';
        }
      }
    }
    
    // Include title and type
    if (contentItem.title) contentText += ' ' + contentItem.title;
    if (contentItem.type) contentText += ' ' + contentItem.type;
    
    // Convert to lowercase for case-insensitive matching
    contentText = contentText.toLowerCase();
    
    // Calculate category scores based on keyword matches
    const categoryScores = {};
    
    for (const category of this.taxonomy) {
      categoryScores[category.id] = 0;
      
      // Check for keyword matches
      for (const keyword of category.keywords || []) {
        // Create regex to match whole words only
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
        const matches = contentText.match(regex);
        
        if (matches) {
          // Score is based on number of matches and keyword length (longer keywords have higher weight)
          categoryScores[category.id] += matches.length * Math.min(keyword.length, 10);
        }
      }
    }
    
    // Sort categories by score
    const sortedCategories = Object.entries(categoryScores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([categoryId]) => categoryId);
    
    // Return top 3 categories (or fewer if not enough matches)
    return sortedCategories.slice(0, 3);
  }
  
  /**
   * Categorise content using AI
   * @private
   */
  async _categoriseWithAI(contentItem) {
    this.logger.info('Using AI for content categorisation');
    
    // Prepare content for analysis
    let contentForAnalysis = '';
    
    if (typeof contentItem.content === 'string') {
      // If content is a string, use the first 500 characters for analysis
      contentForAnalysis = contentItem.content.substring(0, 5000);
    } else if (contentItem.content && typeof contentItem.content === 'object') {
      // For structured content, create a summary
      contentForAnalysis = JSON.stringify(contentItem.content).substring(0, 5000);
    }
    
    // Add content metadata
    let contentMeta = `Title: ${contentItem.title || 'Unknown'}\n`;
    contentMeta += `Type: ${contentItem.type || 'Unknown'}\n`;
    
    if (contentItem.meta_description) {
      contentMeta += `Description: ${contentItem.meta_description}\n`;
    }
    
    if (contentItem.keywords && contentItem.keywords.length > 0) {
      contentMeta += `Keywords: ${contentItem.keywords.join(', ')}\n`;
    }
    
    // Prepare taxonomy for AI
    const taxonomyForAI = this.taxonomy.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description
    }));
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a content categorisation system for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Your task is to analyse content and categorise it according to a predefined taxonomy.
    `;
    
    const userPrompt = `
Here is the content to categorise:

Content Metadata:
${contentMeta}

Content Sample:
"""
${contentForAnalysis}
"""

Please categorise this content according to the following taxonomy:
${JSON.stringify(taxonomyForAI, null, 2)}

Assign 1-3 categories from the taxonomy that best match the content.
Return only the category IDs in a JSON array format.
    `;
    
    try {
      const response = await this.aiProvider.generateText({
        provider: this.config.ai_model.provider,
        model: this.config.ai_model.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 150
      });
      
      // Parse AI response to extract categories
      let categories = [];
      
      try {
        // Try to parse as JSON
        categories = JSON.parse(response);
        
        // Ensure it's an array
        if (!Array.isArray(categories)) {
          if (typeof categories === 'object') {
            // Some models might return an object with a categories property
            categories = categories.categories || categories.category_ids || [];
          } else {
            categories = [];
          }
        }
      } catch (parseError) {
        // If JSON parsing fails, try to extract IDs using regex
        const categoryMatches = response.match(/['"]([\w_]+)['"]/g);
        if (categoryMatches) {
          categories = categoryMatches.map(match => 
            match.replace(/['"]/g, '')
          );
        }
      }
      
      // Validate categories against taxonomy
      const validCategories = categories.filter(categoryId => 
        this.taxonomy.some(taxCategory => taxCategory.id === categoryId)
      );
      
      // Ensure we return at least one category if possible
      if (validCategories.length === 0 && this.taxonomy.length > 0) {
        // Default to the most relevant category based on content type
        const contentType = contentItem.type ? contentItem.type.toLowerCase() : '';
        
        if (contentType.includes('blog')) {
          const blogCategory = this.taxonomy.find(c => 
            c.id === 'website_building' || c.name.toLowerCase().includes('blog')
          );
          if (blogCategory) validCategories.push(blogCategory.id);
        } else if (contentType.includes('social')) {
          const socialCategory = this.taxonomy.find(c => 
            c.id === 'digital_marketing' || c.name.toLowerCase().includes('social')
          );
          if (socialCategory) validCategories.push(socialCategory.id);
        } else {
          // Use the first category as a fallback
          validCategories.push(this.taxonomy[0].id);
        }
      }
      
      this.logger.info('AI categorisation completed', { count: validCategories.length });
      
      return validCategories.slice(0, 3); // Limit to top 3 categories
    } catch (error) {
      this.logger.error('Error in AI categorisation:', error);
      
      // Fallback to basic categorisation
      return this._fallbackCategorisation(contentItem);
    }
  }
  
  /**
   * Fallback categorisation method when other methods fail
   * @private
   */
  _fallbackCategorisation(contentItem) {
    this.logger.info('Using fallback categorisation');
    
    // Default categories based on content type
    const contentType = contentItem.type ? contentItem.type.toLowerCase() : '';
    const defaultCategories = [];
    
    if (contentType.includes('blog')) {
      const blogCategory = this.taxonomy.find(c => 
        c.id === 'website_building' || c.name.toLowerCase().includes('blog')
      );
      if (blogCategory) defaultCategories.push(blogCategory.id);
    } else if (contentType.includes('social')) {
      const socialCategory = this.taxonomy.find(c => 
        c.id === 'digital_marketing' || c.name.toLowerCase().includes('social')
      );
      if (socialCategory) defaultCategories.push(socialCategory.id);
    } else if (contentType.includes('website') || contentType.includes('landing')) {
      const websiteCategory = this.taxonomy.find(c => 
        c.id === 'website_building' || c.name.toLowerCase().includes('website')
      );
      if (websiteCategory) defaultCategories.push(websiteCategory.id);
    }
    
    // If we couldn't determine a category, use the first one
    if (defaultCategories.length === 0 && this.taxonomy.length > 0) {
      defaultCategories.push(this.taxonomy[0].id);
    }
    
    return defaultCategories;
  }
}

module.exports = ContentCategoriser;