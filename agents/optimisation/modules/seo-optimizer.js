/**
 * SEO Optimizer Module for Optimisation Agent
 * 
 * This module provides SEO recommendations for content:
 * - Keyword analysis and optimization
 * - Meta tag suggestions
 * - URL structure improvements
 * - Content structure recommendations
 * - Mobile optimization suggestions
 */

const BaseModule = require('../../../core/BaseModule');

class SeoOptimizer extends BaseModule {
  /**
   * Module-specific initialization
   * @protected
   */
  async _initialize() {
    this.logger.info('Initializing SEO Optimizer module');
    
    // Validate module-specific config
    this._validateSeoConfig();
    
    return true;
  }

  /**
   * Generate SEO recommendations for content
   * @param {Object} content - Content to analyze
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - SEO recommendations
   */
  async generateSeoRecommendations(content, options = {}) {
    try {
      this.logger.info('Generating SEO recommendations for content');
      
      // Extract content information
      const { title, body, metaDescription, url, keywords = [] } = content;
      
      // Prepare recommendations object
      const recommendations = {
        score: 0,
        issues: [],
        improvements: [],
        titleRecommendations: {},
        metaDescriptionRecommendations: {},
        contentRecommendations: {},
        keywordRecommendations: {},
        urlRecommendations: {}
      };
      
      // Check title
      await this._analyzeTitleSeo(title, keywords, recommendations);
      
      // Check meta description
      await this._analyzeMetaDescriptionSeo(metaDescription, keywords, recommendations);
      
      // Check content
      await this._analyzeContentSeo(body, keywords, recommendations);
      
      // Check URL
      if (url) {
        await this._analyzeUrlSeo(url, keywords, recommendations);
      }
      
      // Calculate score
      recommendations.score = this._calculateSeoScore(recommendations);
      
      this._logActivity('Generated SEO recommendations', { 
        contentId: content.id,
        score: recommendations.score,
        issueCount: recommendations.issues.length
      });
      
      return recommendations;
    } catch (error) {
      return this._handleError(error, 'generateSeoRecommendations');
    }
  }

  /**
   * Optimize content based on SEO recommendations
   * @param {Object} content - Content to optimize
   * @param {Object} recommendations - SEO recommendations
   * @returns {Promise<Object>} - Optimized content
   */
  async optimizeContent(content, recommendations) {
    try {
      this.logger.info('Optimizing content based on SEO recommendations');
      
      // Create a copy of the content to avoid modifying original
      const optimizedContent = { ...content };
      
      // Apply title recommendations
      if (recommendations.titleRecommendations.optimizedTitle) {
        optimizedContent.title = recommendations.titleRecommendations.optimizedTitle;
      }
      
      // Apply meta description recommendations
      if (recommendations.metaDescriptionRecommendations.optimizedMetaDescription) {
        optimizedContent.metaDescription = recommendations.metaDescriptionRecommendations.optimizedMetaDescription;
      }
      
      // Apply content recommendations using AI
      if (recommendations.contentRecommendations.suggestions && recommendations.contentRecommendations.suggestions.length > 0) {
        // Prompt AI to improve content based on recommendations
        const improvementPrompt = this._createContentImprovementPrompt(
          optimizedContent.body,
          recommendations.contentRecommendations.suggestions
        );
        
        // Generate improved content
        optimizedContent.body = await this.services.ai.generateText(improvementPrompt, {
          provider: 'anthropic',
          temperature: 0.3,
          maxTokens: 2000
        });
      }
      
      this._logActivity('Optimized content', { 
        contentId: content.id,
        originalScore: recommendations.score,
        optimized: true
      });
      
      return optimizedContent;
    } catch (error) {
      return this._handleError(error, 'optimizeContent');
    }
  }

  /**
   * Analyze keyword usage and recommendations
   * @param {Object} content - Content to analyze
   * @param {Array} targetKeywords - Target keywords
   * @returns {Promise<Object>} - Keyword analysis
   */
  async analyzeKeywords(content, targetKeywords) {
    try {
      this.logger.info('Analyzing keyword usage');
      
      const { title, body, metaDescription } = content;
      const analysis = {
        keywords: {},
        missingKeywords: [],
        overusedKeywords: [],
        suggestions: []
      };
      
      // Analyze each target keyword
      for (const keyword of targetKeywords) {
        const keywordAnalysis = {
          keyword,
          titleUsage: this._countKeywordOccurrences(title, keyword),
          descriptionUsage: this._countKeywordOccurrences(metaDescription, keyword),
          bodyUsage: this._countKeywordOccurrences(body, keyword),
          density: this._calculateKeywordDensity(body, keyword),
          status: 'good'
        };
        
        // Check for missing or overused keywords
        if (keywordAnalysis.bodyUsage === 0) {
          keywordAnalysis.status = 'missing';
          analysis.missingKeywords.push(keyword);
          analysis.suggestions.push(`Add the keyword "${keyword}" to your content.`);
        } else if (keywordAnalysis.density > this.settings.keywordDensityTarget * 1.5) {
          keywordAnalysis.status = 'overused';
          analysis.overusedKeywords.push(keyword);
          analysis.suggestions.push(`Reduce usage of "${keyword}" to avoid keyword stuffing.`);
        }
        
        analysis.keywords[keyword] = keywordAnalysis;
      }
      
      // Suggest additional keywords using AI
      const additionalKeywords = await this._suggestAdditionalKeywords(content, targetKeywords);
      analysis.additionalKeywords = additionalKeywords;
      
      return analysis;
    } catch (error) {
      return this._handleError(error, 'analyzeKeywords');
    }
  }

  /**
   * Analyze title SEO
   * @private
   * @param {string} title - Content title
   * @param {Array} keywords - Target keywords
   * @param {Object} recommendations - Recommendations object
   */
  async _analyzeTitleSeo(title, keywords, recommendations) {
    // Check title length
    const titleLength = title.length;
    const [minLength, maxLength] = this.settings.titleLengthRange;
    
    recommendations.titleRecommendations.length = titleLength;
    recommendations.titleRecommendations.ideal = `${minLength}-${maxLength} characters`;
    
    if (titleLength < minLength) {
      recommendations.issues.push('Title is too short');
      recommendations.titleRecommendations.lengthIssue = 'too short';
    } else if (titleLength > maxLength) {
      recommendations.issues.push('Title is too long');
      recommendations.titleRecommendations.lengthIssue = 'too long';
    }
    
    // Check keyword usage in title
    let primaryKeyword = keywords[0] || '';
    let keywordInTitle = false;
    
    if (primaryKeyword) {
      keywordInTitle = title.toLowerCase().includes(primaryKeyword.toLowerCase());
      recommendations.titleRecommendations.includesPrimaryKeyword = keywordInTitle;
      
      if (!keywordInTitle) {
        recommendations.issues.push('Primary keyword missing from title');
        recommendations.improvements.push('Add primary keyword to title');
      }
    }
    
    // Generate optimized title if needed
    if (!keywordInTitle || titleLength < minLength || titleLength > maxLength) {
      // Use AI to suggest an improved title
      const titlePrompt = `Optimize this title for SEO: "${title}".\n\n` +
                         `Primary keyword: ${primaryKeyword}\n` +
                         `Secondary keywords: ${keywords.slice(1).join(', ')}\n\n` +
                         `Requirements:\n` +
                         `- Title must be between ${minLength} and ${maxLength} characters\n` +
                         `- Must include the primary keyword\n` +
                         `- Should be compelling and relevant to the content\n` +
                         `- Keep the original meaning and intent\n\n` +
                         `Return only the optimized title without explanation or quotes.`;
      
      const optimizedTitle = await this.services.ai.generateText(titlePrompt, {
        temperature: 0.3,
        maxTokens: 100
      });
      
      recommendations.titleRecommendations.optimizedTitle = optimizedTitle;
    }
  }

  /**
   * Analyze meta description SEO
   * @private
   * @param {string} metaDescription - Meta description
   * @param {Array} keywords - Target keywords
   * @param {Object} recommendations - Recommendations object
   */
  async _analyzeMetaDescriptionSeo(metaDescription, keywords, recommendations) {
    // Check if meta description exists
    if (!metaDescription) {
      recommendations.issues.push('Missing meta description');
      recommendations.improvements.push('Add meta description');
      recommendations.metaDescriptionRecommendations.exists = false;
      
      // Generate meta description
      const descriptionPrompt = `Create an SEO-optimized meta description for content with the following keywords: ${keywords.join(', ')}.\n\n` +
                               `Requirements:\n` +
                               `- Between 120-160 characters\n` +
                               `- Include the primary keyword (${keywords[0] || 'none provided'})\n` +
                               `- Be compelling and encourage clicks\n` +
                               `- Clearly describe the content\n\n` +
                               `Return only the meta description without explanation or quotes.`;
      
      const generatedDescription = await this.services.ai.generateText(descriptionPrompt, {
        temperature: 0.3,
        maxTokens: 200
      });
      
      recommendations.metaDescriptionRecommendations.optimizedMetaDescription = generatedDescription;
      return;
    }
    
    recommendations.metaDescriptionRecommendations.exists = true;
    
    // Check meta description length
    const descriptionLength = metaDescription.length;
    const [minLength, maxLength] = this.settings.metaDescriptionLengthRange;
    
    recommendations.metaDescriptionRecommendations.length = descriptionLength;
    recommendations.metaDescriptionRecommendations.ideal = `${minLength}-${maxLength} characters`;
    
    if (descriptionLength < minLength) {
      recommendations.issues.push('Meta description is too short');
      recommendations.metaDescriptionRecommendations.lengthIssue = 'too short';
    } else if (descriptionLength > maxLength) {
      recommendations.issues.push('Meta description is too long');
      recommendations.metaDescriptionRecommendations.lengthIssue = 'too long';
    }
    
    // Check keyword usage in meta description
    let primaryKeyword = keywords[0] || '';
    let keywordInDescription = false;
    
    if (primaryKeyword) {
      keywordInDescription = metaDescription.toLowerCase().includes(primaryKeyword.toLowerCase());
      recommendations.metaDescriptionRecommendations.includesPrimaryKeyword = keywordInDescription;
      
      if (!keywordInDescription) {
        recommendations.issues.push('Primary keyword missing from meta description');
        recommendations.improvements.push('Add primary keyword to meta description');
      }
    }
    
    // Generate optimized meta description if needed
    if (!keywordInDescription || descriptionLength < minLength || descriptionLength > maxLength) {
      // Use AI to suggest an improved meta description
      const descriptionPrompt = `Optimize this meta description for SEO: "${metaDescription}".\n\n` +
                               `Primary keyword: ${primaryKeyword}\n` +
                               `Secondary keywords: ${keywords.slice(1).join(', ')}\n\n` +
                               `Requirements:\n` +
                               `- Meta description must be between ${minLength} and ${maxLength} characters\n` +
                               `- Must include the primary keyword\n` +
                               `- Should be compelling and encourage clicks\n` +
                               `- Keep the original meaning and intent\n\n` +
                               `Return only the optimized meta description without explanation or quotes.`;
      
      const optimizedDescription = await this.services.ai.generateText(descriptionPrompt, {
        temperature: 0.3,
        maxTokens: 200
      });
      
      recommendations.metaDescriptionRecommendations.optimizedMetaDescription = optimizedDescription;
    }
  }

  /**
   * Analyze content SEO
   * @private
   * @param {string} content - Content body
   * @param {Array} keywords - Target keywords
   * @param {Object} recommendations - Recommendations object
   */
  async _analyzeContentSeo(content, keywords, recommendations) {
    const contentRecommendations = {
      wordCount: 0,
      headingStructure: {
        hasH1: false,
        headingsInOrder: false,
        headingsSeo: []
      },
      keywordDensity: {},
      readability: {},
      mediaUsage: {
        hasImages: false,
        imageAltText: false
      },
      suggestions: []
    };
    
    // Word count
    const words = content.split(/\s+/).filter(Boolean);
    contentRecommendations.wordCount = words.length;
    
    if (contentRecommendations.wordCount < 300) {
      recommendations.issues.push('Content is too short');
      contentRecommendations.suggestions.push('Increase content length to at least 300 words');
    }
    
    // Heading structure
    const headings = this._extractHeadings(content);
    contentRecommendations.headingStructure.headings = headings;
    
    // Check if has H1
    contentRecommendations.headingStructure.hasH1 = headings.some(h => h.level === 1);
    
    if (!contentRecommendations.headingStructure.hasH1) {
      recommendations.issues.push('Missing H1 heading');
      contentRecommendations.suggestions.push('Add an H1 heading that includes the primary keyword');
    }
    
    // Check heading order
    let previousLevel = 0;
    let headingsInOrder = true;
    
    for (const heading of headings) {
      if (heading.level > previousLevel + 1 && previousLevel !== 0) {
        headingsInOrder = false;
        break;
      }
      previousLevel = heading.level;
    }
    
    contentRecommendations.headingStructure.headingsInOrder = headingsInOrder;
    
    if (!headingsInOrder) {
      recommendations.issues.push('Headings not in hierarchical order');
      contentRecommendations.suggestions.push('Ensure headings follow a logical hierarchy (H1 > H2 > H3)');
    }
    
    // Check keyword usage in headings
    let primaryKeyword = keywords[0] || '';
    let keywordInHeadings = false;
    
    if (primaryKeyword) {
      keywordInHeadings = headings.some(h => 
        h.text.toLowerCase().includes(primaryKeyword.toLowerCase())
      );
      
      if (!keywordInHeadings) {
        recommendations.issues.push('Primary keyword missing from headings');
        contentRecommendations.suggestions.push('Include primary keyword in at least one heading');
      }
    }
    
    // Analyze keyword density
    if (keywords.length > 0) {
      for (const keyword of keywords) {
        const density = this._calculateKeywordDensity(content, keyword);
        contentRecommendations.keywordDensity[keyword] = density;
        
        if (density === 0) {
          recommendations.issues.push(`Keyword "${keyword}" not found in content`);
          contentRecommendations.suggestions.push(`Add keyword "${keyword}" to the content`);
        } else if (density > this.settings.keywordDensityTarget * 1.5) {
          recommendations.issues.push(`Keyword "${keyword}" overused (density: ${density.toFixed(2)}%)`);
          contentRecommendations.suggestions.push(`Reduce usage of keyword "${keyword}" to avoid keyword stuffing`);
        }
      }
    }
    
    // Check for images and alt text
    contentRecommendations.mediaUsage.hasImages = content.includes('<img');
    const imgTags = content.match(/<img[^>]*>/g) || [];
    
    if (imgTags.length > 0) {
      // Check if all images have alt text
      const imagesWithAlt = imgTags.filter(img => img.includes('alt='));
      contentRecommendations.mediaUsage.imageAltText = imagesWithAlt.length === imgTags.length;
      
      if (!contentRecommendations.mediaUsage.imageAltText) {
        recommendations.issues.push('Some images missing alt text');
        contentRecommendations.suggestions.push('Add descriptive alt text to all images');
      }
    } else if (contentRecommendations.wordCount > 500) {
      // Suggest adding images for longer content
      recommendations.issues.push('No images in content');
      contentRecommendations.suggestions.push('Add relevant images to break up text and improve engagement');
    }
    
    // Add recommendations to main object
    recommendations.contentRecommendations = contentRecommendations;
  }

  /**
   * Analyze URL SEO
   * @private
   * @param {string} url - Content URL
   * @param {Array} keywords - Target keywords
   * @param {Object} recommendations - Recommendations object
   */
  async _analyzeUrlSeo(url, keywords, recommendations) {
    // Parse URL
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const segments = path.split('/').filter(Boolean);
    
    const urlRecommendations = {
      length: path.length,
      segments: segments.length,
      includesKeyword: false,
      hasStopWords: false,
      suggestions: []
    };
    
    // Check URL length
    if (path.length > 100) {
      recommendations.issues.push('URL is too long');
      urlRecommendations.suggestions.push('Shorten URL to improve readability and memorability');
    }
    
    // Check keyword usage in URL
    let primaryKeyword = keywords[0] || '';
    
    if (primaryKeyword) {
      // Convert to slug format for comparison
      const keywordSlug = primaryKeyword.toLowerCase().replace(/\s+/g, '-');
      urlRecommendations.includesKeyword = path.toLowerCase().includes(keywordSlug);
      
      if (!urlRecommendations.includesKeyword) {
        recommendations.issues.push('Primary keyword missing from URL');
        urlRecommendations.suggestions.push('Include primary keyword in URL');
      }
    }
    
    // Check for stop words
    const stopWords = ['a', 'and', 'the', 'in', 'with', 'of', 'for', 'on', 'by', 'at'];
    const containsStopWords = segments.some(segment => 
      stopWords.some(word => segment.toLowerCase() === word)
    );
    
    urlRecommendations.hasStopWords = containsStopWords;
    
    if (containsStopWords) {
      recommendations.issues.push('URL contains stop words');
      urlRecommendations.suggestions.push('Remove stop words from URL');
    }
    
    // Generate optimized URL if needed
    if (!urlRecommendations.includesKeyword || urlRecommendations.hasStopWords || path.length > 100) {
      const urlPrompt = `Optimize this URL for SEO: "${path}".\n\n` +
                       `Primary keyword: ${primaryKeyword}\n` +
                       `Secondary keywords: ${keywords.slice(1).join(', ')}\n\n` +
                       `Requirements:\n` +
                       `- URL should be short and descriptive\n` +
                       `- Include the primary keyword\n` +
                       `- Use hyphens to separate words\n` +
                       `- Avoid stop words (a, an, the, and, etc.)\n` +
                       `- Keep within 100 characters\n\n` +
                       `Return only the path portion of the URL without explanation or quotes. Do not include the domain name.`;
      
      const optimizedPath = await this.services.ai.generateText(urlPrompt, {
        temperature: 0.3,
        maxTokens: 100
      });
      
      // Ensure path starts with a slash
      urlRecommendations.optimizedUrl = optimizedPath.startsWith('/') ? optimizedPath : `/${optimizedPath}`;
    }
    
    // Add recommendations to main object
    recommendations.urlRecommendations = urlRecommendations;
  }

  /**
   * Create content improvement prompt
   * @private
   * @param {string} content - Content to improve
   * @param {Array} suggestions - Improvement suggestions
   * @returns {string} - Prompt for AI
   */
  _createContentImprovementPrompt(content, suggestions) {
    return `Improve the following content based on these SEO recommendations:\n\n` +
           `RECOMMENDATIONS:\n${suggestions.map(s => `- ${s}`).join('\n')}\n\n` +
           `CONTENT:\n${content}\n\n` +
           `Please provide the improved content that addresses all the recommendations above. ` +
           `Maintain the original tone and meaning, but enhance the SEO aspects as suggested. ` +
           `Return only the improved content without explanations.`;
  }

  /**
   * Calculate SEO score based on issues
   * @private
   * @param {Object} recommendations - Recommendations object
   * @returns {number} - SEO score (0-100)
   */
  _calculateSeoScore(recommendations) {
    // Start with perfect score
    let score = 100;
    
    // Deduct points for issues
    const issueDeductions = {
      'Title is too short': 5,
      'Title is too long': 3,
      'Primary keyword missing from title': 10,
      'Missing meta description': 15,
      'Meta description is too short': 5,
      'Meta description is too long': 3,
      'Primary keyword missing from meta description': 7,
      'Content is too short': 10,
      'Missing H1 heading': 8,
      'Headings not in hierarchical order': 5,
      'Primary keyword missing from headings': 7,
      'No images in content': 5,
      'Some images missing alt text': 3,
      'URL is too long': 3,
      'Primary keyword missing from URL': 5,
      'URL contains stop words': 2
    };
    
    // Deduct points for each issue
    for (const issue of recommendations.issues) {
      score -= issueDeductions[issue] || 2; // Default 2 points for unlisted issues
    }
    
    // Ensure score is within range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Extract headings from content
   * @private
   * @param {string} content - Content body
   * @returns {Array} - Extracted headings
   */
  _extractHeadings(content) {
    const headings = [];
    const headingPattern = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    let match;
    
    while ((match = headingPattern.exec(content)) !== null) {
      headings.push({
        level: parseInt(match[1], 10),
        text: match[2].replace(/<[^>]*>/g, '') // Remove any HTML inside heading
      });
    }
    
    // Check for markdown headings
    const markdownPattern = /^(#{1,6})\s+(.+)$/gm;
    
    while ((match = markdownPattern.exec(content)) !== null) {
      headings.push({
        level: match[1].length,
        text: match[2].trim()
      });
    }
    
    return headings;
  }

  /**
   * Count keyword occurrences in text
   * @private
   * @param {string} text - Text to search in
   * @param {string} keyword - Keyword to count
   * @returns {number} - Number of occurrences
   */
  _countKeywordOccurrences(text, keyword) {
    if (!text || !keyword) return 0;
    
    // Convert to lowercase for case-insensitive comparison
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // Count occurrences
    let count = 0;
    let position = lowerText.indexOf(lowerKeyword);
    
    while (position !== -1) {
      count++;
      position = lowerText.indexOf(lowerKeyword, position + 1);
    }
    
    return count;
  }

  /**
   * Calculate keyword density in content
   * @private
   * @param {string} content - Content body
   * @param {string} keyword - Keyword to analyze
   * @returns {number} - Keyword density percentage
   */
  _calculateKeywordDensity(content, keyword) {
    if (!content || !keyword) return 0;
    
    // Count keyword occurrences
    const occurrences = this._countKeywordOccurrences(content, keyword);
    
    // Count total words
    const totalWords = content.split(/\s+/).filter(Boolean).length;
    
    // Calculate density
    return totalWords > 0 ? (occurrences / totalWords) * 100 : 0;
  }

  /**
   * Suggest additional keywords based on content
   * @private
   * @param {Object} content - Content object
   * @param {Array} existingKeywords - Existing keywords
   * @returns {Promise<Array>} - Suggested keywords
   */
  async _suggestAdditionalKeywords(content, existingKeywords) {
    try {
      const { title, body } = content;
      
      const prompt = `Analyze this content and suggest 5 additional SEO keywords or phrases that are relevant but not already in use.\n\n` +
                    `Title: ${title}\n\n` +
                    `Content: ${body.substring(0, 1000)}...\n\n` +
                    `Existing keywords: ${existingKeywords.join(', ')}\n\n` +
                    `Return only a comma-separated list of 5 suggested keywords without explanation or additional text.`;
      
      const response = await this.services.ai.generateText(prompt, {
        temperature: 0.4,
        maxTokens: 200
      });
      
      // Parse comma-separated list
      return response.split(',').map(keyword => keyword.trim()).filter(Boolean);
    } catch (error) {
      this.logger.error(`Failed to suggest additional keywords: ${error.message}`, error);
      return [];
    }
  }

  /**
   * Validate SEO-specific configuration
   * @private
   */
  _validateSeoConfig() {
    // Validate title length range
    if (!Array.isArray(this.settings.titleLengthRange) || this.settings.titleLengthRange.length !== 2) {
      this.settings.titleLengthRange = [40, 60]; // Default values
    }
    
    // Validate meta description length range
    if (!Array.isArray(this.settings.metaDescriptionLengthRange) || this.settings.metaDescriptionLengthRange.length !== 2) {
      this.settings.metaDescriptionLengthRange = [120, 160]; // Default values
    }
    
    // Validate keyword density target
    if (typeof this.settings.keywordDensityTarget !== 'number' || this.settings.keywordDensityTarget <= 0) {
      this.settings.keywordDensityTarget = 2.0; // Default value
    }
    
    // Validate heading structure check
    if (typeof this.settings.headingStructureCheck !== 'boolean') {
      this.settings.headingStructureCheck = true; // Default value
    }
    
    return true;
  }
}

module.exports = SeoOptimizer;