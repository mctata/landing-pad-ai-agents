/**
 * Terminology Checker Module for Brand Consistency Agent
 * Ensures correct terminology usage according to brand guidelines
 */

const BaseModule = require('../../../common/models/base-module');

class TerminologyChecker extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'terminology_checker';
    this.terminology = {};
    this.caseSensitive = true;
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing terminology checker module');
    
    // Set configuration options
    if (this.config.settings) {
      this.caseSensitive = this.config.settings.caseSensitive !== false;
      this.glossarySource = this.config.settings.glossarySource || 'brand-terminology';
    }
    
    // Create collection for terminology if it doesn't exist
    if (!this.storage.collections.terminology) {
      await this.storage.db.createCollection('terminology');
      this.storage.collections.terminology = this.storage.db.collection('terminology');
      
      // Create indexes
      await this.storage.collections.terminology.createIndex({ term: 1 });
      await this.storage.collections.terminology.createIndex({ category: 1 });
    }
    
    // Load brand terminology
    await this._loadTerminology();
    
    this.logger.info('Terminology checker module initialized');
  }

  /**
   * Check content for terminology issues
   * 
   * @param {Object} contentItem - Content to check
   * @returns {Object} Results with terminology issues
   */
  async checkTerminology(contentItem) {
    this.logger.info('Checking terminology', { contentId: contentItem._id });
    
    // Extract content text
    const contentText = this._extractText(contentItem);
    
    // Check for terminology issues
    const issues = this._findTerminologyIssues(contentText);
    
    // Group issues by category
    const issuesByCategory = {};
    for (const issue of issues) {
      if (!issuesByCategory[issue.category]) {
        issuesByCategory[issue.category] = [];
      }
      issuesByCategory[issue.category].push(issue);
    }
    
    // Generate improvement suggestions
    const suggestions = await this._generateSuggestions(contentText, issues);
    
    // Create results object
    const results = {
      content_id: contentItem._id,
      content_title: contentItem.title,
      timestamp: new Date(),
      issues_count: issues.length,
      issues_by_category: issuesByCategory,
      suggestions,
      text_checked: contentText.substring(0, 100) + '...'
    };
    
    this.logger.info('Completed terminology check', { 
      contentId: contentItem._id,
      issuesCount: issues.length
    });
    
    return results;
  }

  /**
   * Update terminology in the database
   * 
   * @param {Array} terminology - Array of terminology objects
   * @returns {Object} Result of update operation
   */
  async updateTerminology(terminology) {
    this.logger.info('Updating terminology', { count: terminology.length });
    
    // Validate terminology entries
    const validTerminology = terminology.filter(term => {
      return term.term && 
             term.preferred && 
             term.category && 
             typeof term.term === 'string' && 
             typeof term.preferred === 'string' &&
             typeof term.category === 'string';
    });
    
    if (validTerminology.length !== terminology.length) {
      this.logger.warn('Some terminology entries were invalid', {
        total: terminology.length,
        valid: validTerminology.length
      });
    }
    
    // Clear existing terminology
    await this.storage.collections.terminology.deleteMany({
      source: this.glossarySource
    });
    
    // Insert new terminology
    if (validTerminology.length > 0) {
      // Add source and timestamp to each entry
      const terminologyWithMeta = validTerminology.map(term => ({
        ...term,
        source: this.glossarySource,
        updated_at: new Date()
      }));
      
      await this.storage.collections.terminology.insertMany(terminologyWithMeta);
    }
    
    // Reload terminology
    await this._loadTerminology();
    
    return {
      success: true,
      count: validTerminology.length
    };
  }

  /**
   * Get all terminology entries
   * 
   * @param {string} category - Optional category filter
   * @returns {Array} Terminology entries
   */
  async getTerminology(category = null) {
    const query = { source: this.glossarySource };
    
    if (category) {
      query.category = category;
    }
    
    const terminology = await this.storage.collections.terminology
      .find(query)
      .toArray();
    
    return terminology;
  }

  /**
   * Extract text from content item
   * @private
   */
  _extractText(contentItem) {
    let text = '';
    
    // Extract title
    if (contentItem.title) {
      text += contentItem.title + ' ';
    }
    
    // Extract meta description
    if (contentItem.meta_description) {
      text += contentItem.meta_description + ' ';
    }
    
    // Extract content based on content type
    if (typeof contentItem.content === 'string') {
      text += contentItem.content;
    } else if (contentItem.content && typeof contentItem.content === 'object') {
      // Handle structured content
      if (contentItem.content.content) {
        text += contentItem.content.content + ' ';
      }
      
      // Handle sections
      if (contentItem.content.sections && Array.isArray(contentItem.content.sections)) {
        for (const section of contentItem.content.sections) {
          if (section.heading) text += section.heading + ' ';
          if (section.content) text += section.content + ' ';
        }
      } else if (contentItem.content.sections && typeof contentItem.content.sections === 'object') {
        for (const [key, section] of Object.entries(contentItem.content.sections)) {
          if (section.heading) text += section.heading + ' ';
          if (section.content) text += section.content + ' ';
        }
      }
    }
    
    return text;
  }

  /**
   * Find terminology issues in text
   * @private
   */
  _findTerminologyIssues(text) {
    const issues = [];
    
    // Process each terminology entry
    for (const [term, termData] of Object.entries(this.terminology)) {
      // Skip if term is not in text
      if (!this._textContainsTerm(text, term, this.caseSensitive)) {
        continue;
      }
      
      // Check if using non-preferred term
      if (termData.type === 'incorrect' && termData.preferred) {
        const positions = this._findTermPositions(text, term, this.caseSensitive);
        
        for (const position of positions) {
          issues.push({
            term,
            preferred: termData.preferred,
            category: termData.category,
            type: 'incorrect_term',
            position,
            context: this._getTextContext(text, position, term.length)
          });
        }
      }
      
      // Check for incorrect styling (capitalization)
      if (termData.type === 'styling' && term !== termData.preferred) {
        // Find all occurrences of term (case insensitive)
        const positions = this._findTermPositions(text, term, false);
        
        for (const position of positions) {
          const actualTerm = text.substr(position, term.length);
          
          if (actualTerm !== termData.preferred) {
            issues.push({
              term: actualTerm,
              preferred: termData.preferred,
              category: termData.category,
              type: 'incorrect_styling',
              position,
              context: this._getTextContext(text, position, term.length)
            });
          }
        }
      }
    }
    
    return issues;
  }

  /**
   * Generate suggestions for fixing terminology issues
   * @private
   */
  async _generateSuggestions(text, issues) {
    // If no issues, no suggestions needed
    if (issues.length === 0) {
      return {
        corrected_text: text,
        summary: "No terminology issues found."
      };
    }
    
    // Create a map of replacements
    const replacements = {};
    for (const issue of issues) {
      replacements[issue.term] = issue.preferred;
    }
    
    // Apply replacements for clear text replacements
    let correctedText = text;
    for (const [term, preferred] of Object.entries(replacements)) {
      // If case sensitive is enabled, use exact replacement
      if (this.caseSensitive) {
        correctedText = correctedText.split(term).join(preferred);
      } else {
        // Case insensitive replacement
        const regex = new RegExp(this._escapeRegExp(term), 'gi');
        correctedText = correctedText.replace(regex, preferred);
      }
    }
    
    // Generate summary with AI
    const summaryPrompt = `
The following terminology issues were found in brand content:

${issues.map(issue => `- "${issue.term}" should be "${issue.preferred}" (${issue.category})`).join('\n')}

Write a brief, helpful summary of these terminology issues that explains why consistent terminology 
matters for brand identity. Keep it under 150 words and make it actionable for content creators.
`;
    
    let summary = "";
    try {
      const aiResponse = await this.aiProvider.generateText({
        provider: 'anthropic',
        model: 'claude-2',
        messages: [
          { role: 'user', content: summaryPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      });
      
      summary = aiResponse.trim();
    } catch (error) {
      this.logger.error('Error generating terminology summary:', error);
      summary = `Found ${issues.length} terminology issues. Please review and update to ensure consistent brand terminology.`;
    }
    
    return {
      corrected_text: correctedText,
      summary
    };
  }

  /**
   * Load terminology from database
   * @private
   */
  async _loadTerminology() {
    this.logger.info('Loading terminology');
    
    // Clear existing terminology
    this.terminology = {};
    
    // Load from database
    const terms = await this.storage.collections.terminology
      .find({ source: this.glossarySource })
      .toArray();
    
    // Process each term
    for (const term of terms) {
      // Determine term type
      let type = 'correct';
      
      if (term.incorrect) {
        type = 'incorrect';
      } else if (term.term !== term.preferred) {
        type = 'styling';
      }
      
      // Add to terminology map
      this.terminology[term.term] = {
        preferred: term.preferred,
        category: term.category,
        description: term.description,
        type
      };
    }
    
    this.logger.info('Terminology loaded', { count: terms.length });
    
    // If no terms loaded, load default terminology
    if (terms.length === 0) {
      await this._loadDefaultTerminology();
    }
  }

  /**
   * Load default terminology for demo purposes
   * @private
   */
  async _loadDefaultTerminology() {
    this.logger.info('Loading default terminology');
    
    const defaultTerminology = [
      {
        term: 'landing pad digital',
        preferred: 'Landing Pad Digital',
        category: 'brand_name',
        description: 'Our company name, always capitalized'
      },
      {
        term: 'landing pad',
        preferred: 'Landing Pad Digital',
        category: 'brand_name',
        description: 'Always use full brand name, not shortened version'
      },
      {
        term: 'lpd',
        preferred: 'Landing Pad Digital',
        category: 'brand_name',
        description: 'Do not use acronym'
      },
      {
        term: 'AI website builder',
        preferred: 'AI Website Builder',
        category: 'product_name',
        description: 'Product name with correct capitalization'
      },
      {
        term: 'website',
        preferred: 'website',
        category: 'general',
        description: 'Lowercase, not "web site" or "Website"'
      },
      {
        term: 'web site',
        preferred: 'website',
        category: 'general',
        description: 'One word, not two'
      },
      {
        term: 'artificial intelligence',
        preferred: 'AI',
        category: 'technology',
        description: 'Use acronym instead of full term'
      },
      {
        term: 'machine learning',
        preferred: 'machine learning',
        category: 'technology',
        description: 'Lowercase unless at beginning of sentence'
      },
      {
        term: 'e-commerce',
        preferred: 'eCommerce',
        category: 'industry',
        description: 'No hyphen, capital C'
      },
      {
        term: 'ecommerce',
        preferred: 'eCommerce',
        category: 'industry',
        description: 'Capital C'
      }
    ];
    
    // Insert default terminology
    await this.updateTerminology(defaultTerminology);
  }

  /**
   * Check if text contains term
   * @private
   */
  _textContainsTerm(text, term, caseSensitive) {
    if (caseSensitive) {
      return text.includes(term);
    } else {
      return text.toLowerCase().includes(term.toLowerCase());
    }
  }

  /**
   * Find all positions of term in text
   * @private
   */
  _findTermPositions(text, term, caseSensitive) {
    const positions = [];
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchTerm = caseSensitive ? term : term.toLowerCase();
    
    let position = searchText.indexOf(searchTerm);
    while (position !== -1) {
      positions.push(position);
      position = searchText.indexOf(searchTerm, position + 1);
    }
    
    return positions;
  }

  /**
   * Get text context around position
   * @private
   */
  _getTextContext(text, position, length, contextSize = 30) {
    const start = Math.max(0, position - contextSize);
    const end = Math.min(text.length, position + length + contextSize);
    
    return text.substring(start, end);
  }

  /**
   * Escape regular expression special characters
   * @private
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = TerminologyChecker;