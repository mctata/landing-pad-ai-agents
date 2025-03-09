/**
 * SEO Optimizer Module
 * Generates SEO recommendations for content
 */

const BaseModule = require('../../../common/models/base-module');

class SeoOptimizer extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'seo_optimizer';
  }
  
  async initialize() {
    this.logger.info('Initializing SEO optimizer module');
    
    // Default SEO best practices
    this.seoBestPractices = {
      title_length: { min: 30, max: 60 },
      meta_description_length: { min: 70, max: 160 },
      heading_structure: true,
      keyword_density: { min: 0.5, max: 2.5 }, // Percentage
      internal_links: { min: 2 },
      external_links: { min: 1 },
      image_alt_text: true,
      content_length: { min: 300 }
    };
    
    // Load custom SEO best practices
    try {
      const seoPractices = await this.storage.collections.seo_practices.findOne();
      
      if (seoPractices) {
        this.seoBestPractices = {
          ...this.seoBestPractices,
          ...seoPractices.practices
        };
        this.logger.info('Loaded custom SEO best practices');
      }
    } catch (error) {
      this.logger.error('Error loading SEO best practices:', error);
    }
  }
  
  /**
   * Generate SEO recommendations for content
   * @param {Object} contentItem - Content item to analyze
   * @param {Array} keywords - Optional target keywords to optimize for
   * @returns {Array} SEO recommendations
   */
  async generateRecommendations(contentItem, keywords = []) {
    this.logger.info('Generating SEO recommendations', { 
      contentId: contentItem._id,
      type: contentItem.type 
    });
    
    // Extract content text and metadata for analysis
    const { contentText, metadata } = this._extractContentData(contentItem);
    
    // If keywords were not provided, extract them from content
    let targetKeywords = keywords.length > 0 ? keywords : [];
    if (targetKeywords.length === 0 && contentItem.keywords) {
      targetKeywords = contentItem.keywords;
    }
    
    // If still no keywords, extract them from the content
    if (targetKeywords.length === 0) {
      targetKeywords = await this._extractKeywordsFromContent(contentText, metadata);
    }
    
    this.logger.info('Using target keywords for SEO analysis', { 
      keywordCount: targetKeywords.length,
      keywords: targetKeywords
    });
    
    // Perform basic SEO checks
    const basicRecommendations = this._performBasicSeoChecks(contentItem, contentText, metadata);
    
    // Get AI-powered recommendations
    const aiRecommendations = await this._getAiSeoRecommendations(
      contentText,
      metadata,
      targetKeywords
    );
    
    // Combine and deduplicate recommendations
    const allRecommendations = [
      ...basicRecommendations,
      ...aiRecommendations
    ];
    
    // Deduplicate by category
    const recommendationsByCategory = {};
    for (const recommendation of allRecommendations) {
      const category = recommendation.category || 'general';
      if (!recommendationsByCategory[category]) {
        recommendationsByCategory[category] = [];
      }
      
      // Check if a similar recommendation already exists
      const isDuplicate = recommendationsByCategory[category].some(
        existing => this._areSimilarRecommendations(existing, recommendation)
      );
      
      if (!isDuplicate) {
        recommendationsByCategory[category].push(recommendation);
      }
    }
    
    // Flatten and return recommendations
    const finalRecommendations = Object.values(recommendationsByCategory)
      .flat()
      .sort((a, b) => b.priority - a.priority);
    
    this.logger.info('Generated SEO recommendations', { 
      count: finalRecommendations.length 
    });
    
    return finalRecommendations;
  }
  
  /**
   * Analyze content for keyword opportunities
   * @param {string} contentText - Content text
   * @param {Object} metadata - Content metadata
   * @param {Array} currentKeywords - Current keywords
   * @returns {Array} Keyword opportunities
   */
  async findKeywordOpportunities(contentText, metadata, currentKeywords = []) {
    this.logger.info('Finding keyword opportunities');
    
    // Identify related keywords and semantic variations
    const keywordOpportunities = await this._analyzeKeywordOpportunities(
      contentText, 
      metadata, 
      currentKeywords
    );
    
    return keywordOpportunities;
  }
  
  /**
   * Analyze content against competitors
   * @param {Object} contentItem - Content item to analyze
   * @param {Array} competitorUrls - URLs of competitor content
   * @returns {Object} Competitive analysis
   */
  async analyzeCompetitors(contentItem, competitorUrls) {
    this.logger.info('Analyzing content against competitors', {
      contentId: contentItem._id,
      competitorCount: competitorUrls.length
    });
    
    // This would typically involve fetching competitor content and analyzing it
    // For this implementation, we'll simulate the analysis
    
    const competitiveAnalysis = {
      keyword_gaps: [],
      content_length_comparison: {},
      topic_coverage_gaps: [],
      recommendations: []
    };
    
    // Simulate competitive analysis results
    competitiveAnalysis.keyword_gaps = ['AI website templates', 'responsive design tools'];
    competitiveAnalysis.content_length_comparison = {
      your_content: contentItem.content ? contentItem.content.length : 0,
      competitor_average: 1500,
      difference_percentage: -15
    };
    competitiveAnalysis.topic_coverage_gaps = ['mobile optimization', 'SEO benefits'];
    competitiveAnalysis.recommendations = [
      {
        type: 'content_length',
        recommendation: 'Increase content length by approximately 15% to match competitor average'
      },
      {
        type: 'keyword_gap',
        recommendation: 'Add content about "AI website templates" to fill a keyword gap'
      },
      {
        type: 'topic_coverage',
        recommendation: 'Add a section about mobile optimization benefits'
      }
    ];
    
    return competitiveAnalysis;
  }
  
  /**
   * Extract content data for analysis
   * @private
   */
  _extractContentData(contentItem) {
    // Initialize variables
    let contentText = '';
    const metadata = {
      title: '',
      description: '',
      headings: [],
      links: { internal: 0, external: 0 },
      images: { total: 0, with_alt: 0 }
    };
    
    // Process title and meta description
    if (contentItem.title) {
      metadata.title = contentItem.title;
    }
    
    if (contentItem.meta_description) {
      metadata.description = contentItem.meta_description;
    }
    
    // Extract content based on content type and structure
    if (typeof contentItem.content === 'string') {
      // Simple string content
      contentText = contentItem.content;
      
      // Try to extract headings using regex (simplified)
      const h1Matches = contentText.match(/<h1[^>]*>(.*?)<\/h1>/gi) || [];
      const h2Matches = contentText.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
      const h3Matches = contentText.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
      
      metadata.headings = [
        ...h1Matches.map(h => ({ level: 1, text: h.replace(/<\/?h1[^>]*>/gi, '') })),
        ...h2Matches.map(h => ({ level: 2, text: h.replace(/<\/?h2[^>]*>/gi, '') })),
        ...h3Matches.map(h => ({ level: 3, text: h.replace(/<\/?h3[^>]*>/gi, '') }))
      ];
      
      // Count links (simplified)
      const internalLinks = (contentText.match(/href=["'][^"']*landing-pad-digital[^"']*["']/gi) || []).length;
      const externalLinks = (contentText.match(/href=["']http[^"']*["']/gi) || []).length - internalLinks;
      
      metadata.links = {
        internal: internalLinks,
        external: externalLinks
      };
      
      // Count images and alt text
      const imgTags = contentText.match(/<img[^>]*>/gi) || [];
      const imgWithAlt = contentText.match(/<img[^>]*alt=["'][^"']+["'][^>]*>/gi) || [];
      
      metadata.images = {
        total: imgTags.length,
        with_alt: imgWithAlt.length
      };
    } else if (contentItem.content && typeof contentItem.content === 'object') {
      // Structured content (e.g., blog post or website copy)
      
      // Extract title and description from content object if available
      if (contentItem.content.title && !metadata.title) {
        metadata.title = contentItem.content.title;
      }
      
      if (contentItem.content.meta_description && !metadata.description) {
        metadata.description = contentItem.content.meta_description;
      }
      
      // Handle content body
      if (contentItem.content.content) {
        contentText += contentItem.content.content + ' ';
      }
      
      // Handle nested sections (e.g., for website copy)
      if (contentItem.content.sections) {
        for (const [sectionKey, section] of Object.entries(contentItem.content.sections)) {
          if (typeof section === 'object') {
            // Extract text from section
            if (section.heading) {
              contentText += section.heading + ' ';
              metadata.headings.push({ level: 2, text: section.heading });
            }
            
            if (section.subheading) {
              contentText += section.subheading + ' ';
              metadata.headings.push({ level: 3, text: section.subheading });
            }
            
            if (section.content) {
              contentText += section.content + ' ';
            }
            
            if (section.description) {
              contentText += section.description + ' ';
            }
            
            // Extract items from lists
            if (section.items && Array.isArray(section.items)) {
              for (const item of section.items) {
                if (typeof item === 'string') {
                  contentText += item + ' ';
                } else if (typeof item === 'object') {
                  if (item.title) contentText += item.title + ' ';
                  if (item.description) contentText += item.description + ' ';
                  if (item.content) contentText += item.content + ' ';
                }
              }
            }
          }
        }
      }
    }
    
    return { contentText, metadata };
  }
  
  /**
   * Extract keywords from content
   * @private
   */
  async _extractKeywordsFromContent(contentText, metadata) {
    this.logger.info('Extracting keywords from content');
    
    // Construct prompt for the AI
    const systemPrompt = `
You are an SEO keyword extraction tool. Your task is to identify the most relevant keywords and 
phrases for search engine optimization based on the provided content.
    `;
    
    const userPrompt = `
Extract the 5 most relevant keywords or phrases for SEO from this content:

Title: ${metadata.title}
Description: ${metadata.description}

Content:
${contentText.substring(0, 5000)} ${contentText.length > 5000 ? '...' : ''}

Return only a JSON array of keywords/phrases, e.g. ["keyword 1", "keyword 2", ...]
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
        max_tokens: 200
      });
      
      // Parse JSON response
      let keywords = [];
      try {
        // Try to parse the response as JSON
        keywords = JSON.parse(response);
        
        // Ensure it's an array
        if (!Array.isArray(keywords)) {
          if (typeof keywords === 'object') {
            // Some models might return an object with a keywords property
            keywords = keywords.keywords || [];
          } else {
            keywords = [];
          }
        }
      } catch (parseError) {
        // If JSON parsing fails, try to extract keywords using regex
        const keywordMatches = response.match(/["']([^"']+)["']/g);
        if (keywordMatches) {
          keywords = keywordMatches.map(match => 
            match.replace(/["']/g, '')
          );
        }
      }
      
      this.logger.info('Extracted keywords from content', { 
        keywordCount: keywords.length 
      });
      
      return keywords;
    } catch (error) {
      this.logger.error('Error extracting keywords from content:', error);
      
      // Fallback: extract keywords based on frequency
      return this._extractKeywordsByFrequency(contentText);
    }
  }
  
  /**
   * Extract keywords from content based on frequency
   * @private
   */
  _extractKeywordsByFrequency(text) {
    // Simplistic keyword extraction based on word frequency
    // In a real implementation, this would be much more sophisticated
    
    // Normalize text
    const normalizedText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into words
    const words = normalizedText.split(' ');
    
    // Count word frequency
    const wordCounts = {};
    for (const word of words) {
      if (word.length < 3) continue; // Skip short words
      
      // Skip common stop words
      if (['the', 'and', 'for', 'with', 'that', 'this', 'are', 'from'].includes(word)) {
        continue;
      }
      
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    
    // Sort by frequency and take top 5
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
  
  /**
   * Perform basic SEO checks based on best practices
   * @private
   */
  _performBasicSeoChecks(contentItem, contentText, metadata) {
    const recommendations = [];
    
    // Check title length
    if (metadata.title) {
      const titleLength = metadata.title.length;
      if (titleLength < this.seoBestPractices.title_length.min) {
        recommendations.push({
          category: 'title',
          issue: 'Title is too short',
          recommendation: `Extend your title to at least ${this.seoBestPractices.title_length.min} characters. Current length: ${titleLength}`,
          priority: 9
        });
      } else if (titleLength > this.seoBestPractices.title_length.max) {
        recommendations.push({
          category: 'title',
          issue: 'Title is too long',
          recommendation: `Shorten your title to ${this.seoBestPractices.title_length.max} characters or less. Current length: ${titleLength}`,
          priority: 8
        });
      }
    } else {
      recommendations.push({
        category: 'title',
        issue: 'Missing title',
        recommendation: 'Add a descriptive title that includes your main keyword',
        priority: 10
      });
    }
    
    // Check meta description
    if (metadata.description) {
      const descriptionLength = metadata.description.length;
      if (descriptionLength < this.seoBestPractices.meta_description_length.min) {
        recommendations.push({
          category: 'meta_description',
          issue: 'Meta description is too short',
          recommendation: `Extend your meta description to at least ${this.seoBestPractices.meta_description_length.min} characters. Current length: ${descriptionLength}`,
          priority: 8
        });
      } else if (descriptionLength > this.seoBestPractices.meta_description_length.max) {
        recommendations.push({
          category: 'meta_description',
          issue: 'Meta description is too long',
          recommendation: `Shorten your meta description to ${this.seoBestPractices.meta_description_length.max} characters or less. Current length: ${descriptionLength}`,
          priority: 7
        });
      }
    } else {
      recommendations.push({
        category: 'meta_description',
        issue: 'Missing meta description',
        recommendation: 'Add a compelling meta description that includes your main keyword',
        priority: 9
      });
    }
    
    // Check heading structure
    if (this.seoBestPractices.heading_structure) {
      // Check if there's at least one heading
      if (metadata.headings.length === 0) {
        recommendations.push({
          category: 'headings',
          issue: 'No headings found',
          recommendation: 'Add headings (H1, H2, H3) to structure your content and improve readability',
          priority: 7
        });
      } else {
        // Check if there's an H1
        const hasH1 = metadata.headings.some(h => h.level === 1);
        if (!hasH1) {
          recommendations.push({
            category: 'headings',
            issue: 'Missing H1 heading',
            recommendation: 'Add an H1 heading that includes your main keyword',
            priority: 8
          });
        }
        
        // Check heading hierarchy
        let previousLevel = 0;
        let hasHierarchyIssue = false;
        for (const heading of metadata.headings) {
          if (heading.level > previousLevel + 1) {
            hasHierarchyIssue = true;
            break;
          }
          previousLevel = heading.level;
        }
        
        if (hasHierarchyIssue) {
          recommendations.push({
            category: 'headings',
            issue: 'Improper heading hierarchy',
            recommendation: 'Ensure proper heading hierarchy (H1 > H2 > H3) without skipping levels',
            priority: 6
          });
        }
      }
    }
    
    // Check internal links
    if (this.seoBestPractices.internal_links) {
      if (metadata.links.internal < this.seoBestPractices.internal_links.min) {
        recommendations.push({
          category: 'links',
          issue: 'Insufficient internal links',
          recommendation: `Add at least ${this.seoBestPractices.internal_links.min} internal links to other relevant pages on your site`,
          priority: 7
        });
      }
    }
    
    // Check external links
    if (this.seoBestPractices.external_links) {
      if (metadata.links.external < this.seoBestPractices.external_links.min) {
        recommendations.push({
          category: 'links',
          issue: 'Insufficient external links',
          recommendation: `Add at least ${this.seoBestPractices.external_links.min} external links to authoritative sources`,
          priority: 6
        });
      }
    }
    
    // Check image alt text
    if (this.seoBestPractices.image_alt_text && metadata.images.total > 0) {
      if (metadata.images.with_alt < metadata.images.total) {
        recommendations.push({
          category: 'images',
          issue: 'Images missing alt text',
          recommendation: `Add descriptive alt text to all images. ${metadata.images.with_alt} of ${metadata.images.total} images have alt text`,
          priority: 7
        });
      }
    }
    
    // Check content length
    if (this.seoBestPractices.content_length) {
      const wordCount = contentText.split(/\s+/).length;
      if (wordCount < this.seoBestPractices.content_length.min) {
        recommendations.push({
          category: 'content',
          issue: 'Content is too short',
          recommendation: `Expand your content to at least ${this.seoBestPractices.content_length.min} words. Current word count: approximately ${wordCount}`,
          priority: 8
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Get AI-powered SEO recommendations
   * @private
   */
  async _getAiSeoRecommendations(contentText, metadata, keywords) {
    this.logger.info('Getting AI-powered SEO recommendations');
    
    // Create a content sample for analysis (truncate if too long)
    const contentSample = contentText.length > 5000 
      ? contentText.substring(0, 5000) + '...'
      : contentText;
    
    // Construct prompt for the AI
    const systemPrompt = `
You are an SEO expert analyzing content for search engine optimization. Your task is to provide 
specific, actionable recommendations to improve the content's SEO performance.
    `;
    
    const userPrompt = `
Analyze this content for SEO optimization:

Title: ${metadata.title}
Description: ${metadata.description}
Target keywords: ${keywords.join(', ')}

Content sample:
${contentSample}

Provide specific, actionable SEO recommendations in these categories:
1. Keyword usage and placement
2. Content structure and readability
3. On-page SEO elements
4. User engagement factors

Format your response as JSON with the following structure:
[
  {
    "category": "category_name",
    "issue": "brief description of the issue",
    "recommendation": "specific, actionable recommendation",
    "priority": number from 1-10 (10 being highest priority)
  },
  ...
]
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
      let recommendations = [];
      try {
        // Try to parse the response as JSON
        recommendations = JSON.parse(response);
        
        // Ensure it's an array
        if (!Array.isArray(recommendations)) {
          if (typeof recommendations === 'object') {
            // Some models might return an object with a recommendations property
            recommendations = recommendations.recommendations || [];
          } else {
            recommendations = [];
          }
        }
      } catch (parseError) {
        // If JSON parsing fails, try to extract recommendations manually
        this.logger.warn('Error parsing AI SEO recommendations:', parseError);
        recommendations = this._extractRecommendationsFromText(response);
      }
      
      this.logger.info('Generated AI-powered SEO recommendations', { 
        count: recommendations.length 
      });
      
      return recommendations;
    } catch (error) {
      this.logger.error('Error getting AI-powered SEO recommendations:', error);
      return [];
    }
  }
  
  /**
   * Analyze keyword opportunities
   * @private
   */
  async _analyzeKeywordOpportunities(contentText, metadata, currentKeywords) {
    this.logger.info('Analyzing keyword opportunities');
    
    // Construct prompt for the AI
    const systemPrompt = `
You are an SEO keyword researcher specialized in identifying keyword opportunities and semantic variations.
Your task is to analyze content and suggest additional keywords that could improve SEO performance.
    `;
    
    const userPrompt = `
Analyze this content and suggest additional keyword opportunities:

Title: ${metadata.title}
Description: ${metadata.description}
Current keywords: ${currentKeywords.join(', ')}

Content sample:
${contentText.substring(0, 5000)} ${contentText.length > 5000 ? '...' : ''}

Suggest:
1. Related keywords that could enhance the content
2. Semantic variations of existing keywords
3. Long-tail keyword opportunities

Return your suggestions as a JSON array of objects with the following structure:
[
  {
    "keyword": "suggested keyword",
    "type": "related|semantic|long_tail",
    "relevance": number from 1-10 (10 being most relevant),
    "search_volume": "high|medium|low" (estimated)
  },
  ...
]
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
        max_tokens: 1500
      });
      
      // Parse JSON response
      let opportunities = [];
      try {
        // Try to parse the response as JSON
        opportunities = JSON.parse(response);
        
        // Ensure it's an array
        if (!Array.isArray(opportunities)) {
          if (typeof opportunities === 'object') {
            // Some models might return an object with an opportunities property
            opportunities = opportunities.opportunities || [];
          } else {
            opportunities = [];
          }
        }
      } catch (parseError) {
        this.logger.warn('Error parsing keyword opportunities:', parseError);
        return [];
      }
      
      this.logger.info('Identified keyword opportunities', { 
        count: opportunities.length 
      });
      
      return opportunities;
    } catch (error) {
      this.logger.error('Error analyzing keyword opportunities:', error);
      return [];
    }
  }
  
  /**
   * Extract recommendations from text when JSON parsing fails
   * @private
   */
  _extractRecommendationsFromText(text) {
    const recommendations = [];
    
    // Try to identify recommendation patterns in the text
    const categoryPatterns = [
      'keyword usage', 'keyword placement', 'keywords?',
      'content structure', 'readability',
      'on-page SEO', 'meta',
      'user engagement', 'engagement'
    ];
    
    for (const category of categoryPatterns) {
      const categoryRegex = new RegExp(`${category}[:\\s]+(.*?)(?=\\n\\n|$)`, 'gi');
      const matches = text.match(categoryRegex);
      
      if (matches) {
        for (const match of matches) {
          // Try to extract a concise recommendation
          const recommendationText = match.replace(/^.*?[:\\s]+/, '').trim();
          
          if (recommendationText) {
            recommendations.push({
              category: category.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
              issue: 'Improvement opportunity',
              recommendation: recommendationText,
              priority: 5 // Default priority
            });
          }
        }
      }
    }
    
    // Fallback: If we couldn't extract structured recommendations, 
    // create a general recommendation from the text
    if (recommendations.length === 0 && text.trim().length > 0) {
      recommendations.push({
        category: 'general',
        issue: 'SEO improvement opportunity',
        recommendation: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        priority: 5
      });
    }
    
    return recommendations;
  }
  
  /**
   * Check if two recommendations are similar
   * @private
   */
  _areSimilarRecommendations(rec1, rec2) {
    // Check if the category is the same
    if (rec1.category !== rec2.category) {
      return false;
    }
    
    // Check if the issue is similar (using substring matching)
    if (!rec1.issue.includes(rec2.issue) && !rec2.issue.includes(rec1.issue)) {
      return false;
    }
    
    // Check if the recommendations are similar
    const normalizedRec1 = rec1.recommendation.toLowerCase().replace(/[^\w\s]/g, '');
    const normalizedRec2 = rec2.recommendation.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Simple similarity check: if one is a substring of the other or they share significant words
    return normalizedRec1.includes(normalizedRec2) || 
           normalizedRec2.includes(normalizedRec1) ||
           this._calculateWordOverlap(normalizedRec1, normalizedRec2) > 0.7;
  }
  
  /**
   * Calculate word overlap between two strings
   * @private
   */
  _calculateWordOverlap(str1, str2) {
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));
    
    // Count shared words
    let sharedCount = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        sharedCount++;
      }
    }
    
    // Calculate overlap ratio
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    return totalUniqueWords > 0 ? sharedCount / totalUniqueWords : 0;
  }
}

module.exports = SeoOptimizer;