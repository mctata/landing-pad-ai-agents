/**
 * Consistency Checker Module
 * Checks content against brand guidelines for consistency
 */

const BaseModule = require('../../../common/models/base-module');

class ConsistencyChecker extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'consistency_checker';
  }
  
  async initialize() {
    this.logger.info('Initializing consistency checker module');
    
    // Load predefined brand patterns and rules
    try {
      const patterns = await this.storage.collections.brand_patterns.find().toArray();
      
      if (patterns && patterns.length > 0) {
        this.brandPatterns = patterns;
        this.logger.info('Loaded brand patterns', { count: patterns.length });
      } else {
        this.brandPatterns = this._getDefaultBrandPatterns();
        
        // Save default patterns to database
        await this.storage.collections.brand_patterns.insertMany(this.brandPatterns);
        
        this.logger.warn('Brand patterns not found, created defaults');
      }
    } catch (error) {
      this.logger.error('Error loading brand patterns:', error);
      this.brandPatterns = this._getDefaultBrandPatterns();
    }
  }
  
  /**
   * Check content against brand guidelines
   * @param {Object} contentItem - Content item to check
   * @param {Object} brandGuidelines - Brand guidelines to check against
   * @param {string} checkLevel - Level of checking to perform (basic, normal, strict)
   * @returns {Object} Consistency check results
   */
  async checkConsistency(contentItem, brandGuidelines, checkLevel = 'normal') {
    this.logger.info('Checking content consistency', { 
      contentId: contentItem._id,
      type: contentItem.type,
      checkLevel
    });
    
    // Extract content as plain text
    const contentText = this._extractContentText(contentItem);
    
    // Determine level of detail for checks
    const isDetailedCheck = checkLevel === 'strict';
    const isQuickCheck = checkLevel === 'basic';
    
    // Results structure
    const results = {
      score: 10, // Start with perfect score
      issues: [],
      autoCorrect: false
    };
    
    // Perform automated pattern checks
    const patternIssues = this._checkPatterns(contentText, isDetailedCheck);
    if (patternIssues.length > 0) {
      results.issues.push(...patternIssues);
      
      // Reduce score based on number and severity of issues
      const severityDeductions = {
        low: 0.2,
        medium: 0.5,
        high: 1.0
      };
      
      for (const issue of patternIssues) {
        results.score -= severityDeductions[issue.severity] || 0.5;
      }
    }
    
    // For normal and strict checks, use AI for more nuanced analysis
    if (!isQuickCheck) {
      const aiAnalysis = await this._performAiConsistencyCheck(
        contentText,
        brandGuidelines,
        isDetailedCheck
      );
      
      // Add AI-detected issues
      if (aiAnalysis.issues && aiAnalysis.issues.length > 0) {
        results.issues.push(...aiAnalysis.issues);
        
        // Reduce score based on AI analysis
        results.score = Math.min(results.score, aiAnalysis.score);
      }
    }
    
    // Ensure score is within range
    results.score = Math.max(1, Math.min(10, Math.round(results.score * 10) / 10));
    
    // Sort issues by severity (high to low)
    results.issues.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    
    // Determine if auto-correction is possible
    results.autoCorrect = results.issues.every(issue => 
      issue.severity === 'low' && issue.autoCorrectible
    );
    
    this.logger.info('Content consistency check completed', { 
      score: results.score,
      issueCount: results.issues.length,
      autoCorrect: results.autoCorrect
    });
    
    return results;
  }
  
  /**
   * Extract content as plain text
   * @private
   */
  _extractContentText(contentItem) {
    if (typeof contentItem.content === 'string') {
      return contentItem.content;
    }
    
    if (contentItem.content && typeof contentItem.content === 'object') {
      // For structured content, create a flattened text version
      let contentText = '';
      
      if (contentItem.content.title) contentText += contentItem.content.title + '\n\n';
      if (contentItem.content.content) contentText += contentItem.content.content + '\n\n';
      
      // Handle nested sections
      if (contentItem.content.sections) {
        for (const [sectionKey, section] of Object.entries(contentItem.content.sections)) {
          if (typeof section === 'object') {
            if (section.heading) contentText += section.heading + '\n';
            if (section.subheading) contentText += section.subheading + '\n';
            if (section.content) contentText += section.content + '\n\n';
            if (section.description) contentText += section.description + '\n\n';
            
            // Handle items in sections
            if (section.items && Array.isArray(section.items)) {
              for (const item of section.items) {
                if (typeof item === 'string') {
                  contentText += '- ' + item + '\n';
                } else if (typeof item === 'object') {
                  if (item.title) contentText += '- ' + item.title + ': ';
                  if (item.description) contentText += item.description + '\n';
                  if (item.content) contentText += item.content + '\n';
                }
              }
              contentText += '\n';
            }
          }
        }
      }
      
      return contentText;
    }
    
    return '';
  }
  
  /**
   * Check content against predefined patterns
   * @private
   */
  _checkPatterns(contentText, isDetailedCheck) {
    const issues = [];
    
    // Normalize content for pattern matching
    const normalizedContent = contentText.toLowerCase();
    
    // Check each pattern
    for (const pattern of this.brandPatterns) {
      // Skip detailed patterns for quick checks
      if (pattern.detailedOnly && !isDetailedCheck) {
        continue;
      }
      
      // Skip inactive patterns
      if (!pattern.active) {
        continue;
      }
      
      // Match pattern based on type
      let matches = [];
      
      if (pattern.type === 'regex') {
        try {
          const regex = new RegExp(pattern.pattern, pattern.flags || 'gi');
          matches = normalizedContent.match(regex) || [];
        } catch (error) {
          this.logger.error('Error with regex pattern:', error);
        }
      } else if (pattern.type === 'substring') {
        const searchTerm = pattern.pattern.toLowerCase();
        let index = normalizedContent.indexOf(searchTerm);
        while (index !== -1) {
          matches.push(pattern.pattern);
          index = normalizedContent.indexOf(searchTerm, index + 1);
        }
      }
      
      // If we found matches, create an issue
      if (matches.length > 0) {
        issues.push({
          type: 'pattern_violation',
          rule: pattern.name,
          severity: pattern.severity || 'medium',
          description: pattern.description,
          matches: matches.slice(0, 5), // Limit number of matches reported
          match_count: matches.length,
          autoCorrectible: pattern.autoCorrectible || false,
          correction: pattern.correction || null
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Perform AI-based consistency check
   * @private
   */
  async _performAiConsistencyCheck(contentText, brandGuidelines, isDetailedCheck) {
    this.logger.info('Performing AI-based consistency check', {
      contentLength: contentText.length,
      detailedCheck: isDetailedCheck
    });
    
    // Construct prompt for the AI
    const systemPrompt = `
You are a brand consistency expert for Landing Pad Digital, a company that offers an AI-powered website builder platform.
Your task is to analyze content against brand guidelines and identify inconsistencies or misalignments.

Be thorough and specific in your analysis, focusing on both obvious and subtle violations of brand guidelines.
${isDetailedCheck ? 'This is a detailed check, so identify even minor issues with tone, voice, and messaging.' : ''}
    `;
    
    const userPrompt = `
Analyze this content against the brand guidelines:

Content:
"""
${contentText.substring(0, 7000)} ${contentText.length > 7000 ? '...' : ''}
"""

Brand Guidelines:
${Object.entries(brandGuidelines).map(([type, content]) => `${type}: ${content}`).join('\n\n')}

Please provide:
1. A brand consistency score from 1-10 (where 10 is perfectly aligned with brand guidelines)
2. Specific issues where the content doesn't align with the brand guidelines
3. For each issue, indicate the severity (high, medium, or low)

Format your response as JSON with the following structure:
{
  "score": [1-10 score],
  "issues": [
    {
      "type": "voice_misalignment|terminology_issue|messaging_inconsistency|tone_issue",
      "severity": "high|medium|low",
      "description": "[detailed description of the issue]",
      "recommendation": "[how to fix it]",
      "location": "[where in the content the issue appears]",
      "autoCorrectible": false
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
        temperature: 0.3,
        max_tokens: 2500
      });
      
      // Parse JSON response
      let analysis;
      try {
        // Try to parse the response as JSON
        analysis = JSON.parse(response);
      } catch (parseError) {
        // If that fails, try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            analysis = JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            // If JSON parsing fails, create a structured object manually
            analysis = this._extractAnalysisFromText(response);
          }
        } else {
          // If no JSON-like structure is found, extract analysis manually
          analysis = this._extractAnalysisFromText(response);
        }
      }
      
      this.logger.info('AI consistency check completed', { 
        score: analysis.score,
        issueCount: analysis.issues.length
      });
      
      return analysis;
    } catch (error) {
      this.logger.error('Error performing AI consistency check:', error);
      
      // Return minimal analysis in case of error
      return {
        score: 7.5, // Default to moderately good score
        issues: [],
        summary: 'Error occurred during AI analysis. Basic pattern checks only.'
      };
    }
  }
  
  /**
   * Extract analysis from text when JSON parsing fails
   * @private
   */
  _extractAnalysisFromText(text) {
    // Default analysis structure
    const analysis = {
      score: 7.5, // Default to moderately good score
      issues: [],
      summary: 'Extracted from text due to JSON parsing failure.'
    };
    
    // Try to extract score
    const scoreMatch = text.match(/score:?\s*(\d+(?:\.\d+)?)/i);
    if (scoreMatch) {
      analysis.score = parseFloat(scoreMatch[1]);
    }
    
    // Try to extract summary
    const summaryMatch = text.match(/summary:?\s*([^\n]+(?:\n[^#]+)*)/i);
    if (summaryMatch) {
      analysis.summary = summaryMatch[1].trim();
    }
    
    // Try to extract issues
    const issueTypes = ['voice_misalignment', 'terminology_issue', 'messaging_inconsistency', 'tone_issue'];
    const severityLevels = ['high', 'medium', 'low'];
    
    // Look for severity indicators
    for (const severity of severityLevels) {
      const severityRegex = new RegExp(`${severity}:?\\s*([^\\n]+(?:\\n[^\\n]+)*)`, 'gi');
      let match;
      
      while ((match = severityRegex.exec(text)) !== null) {
        const issueContent = match[1].trim();
        
        // Determine issue type
        let type = 'general_issue';
        for (const issueType of issueTypes) {
          if (issueContent.toLowerCase().includes(issueType.replace('_', ' '))) {
            type = issueType;
            break;
          }
        }
        
        analysis.issues.push({
          type,
          severity,
          description: issueContent,
          recommendation: 'Review and adjust to align with brand guidelines.',
          location: 'Unspecified',
          autoCorrectible: false
        });
      }
    }
    
    // If no issues found using severity, look for numbered issues
    if (analysis.issues.length === 0) {
      const issueRegex = /\d+\.\s+([^\n]+(?:\n[^\d][^\n]+)*)/g;
      let match;
      
      while ((match = issueRegex.exec(text)) !== null) {
        const issueContent = match[1].trim();
        
        // Determine severity from content
        let severity = 'medium';
        if (issueContent.toLowerCase().includes('critical') || 
            issueContent.toLowerCase().includes('severe')) {
          severity = 'high';
        } else if (issueContent.toLowerCase().includes('minor') || 
                  issueContent.toLowerCase().includes('slight')) {
          severity = 'low';
        }
        
        // Determine issue type
        let type = 'general_issue';
        for (const issueType of issueTypes) {
          if (issueContent.toLowerCase().includes(issueType.replace('_', ' '))) {
            type = issueType;
            break;
          }
        }
        
        analysis.issues.push({
          type,
          severity,
          description: issueContent,
          recommendation: 'Review and adjust to align with brand guidelines.',
          location: 'Unspecified',
          autoCorrectible: false
        });
      }
    }
    
    return analysis;
  }
  
  /**
   * Get default brand patterns for pattern matching
   * @private
   */
  _getDefaultBrandPatterns() {
    return [
      {
        name: 'Company Name Format',
        type: 'regex',
        pattern: 'landing\\s+pad(?!\\s+digital)',
        flags: 'i',
        description: 'Always use full name "Landing Pad Digital" on first mention',
        severity: 'medium',
        active: true,
        detailedOnly: false,
        autoCorrectible: true,
        correction: 'Landing Pad Digital'
      },
      {
        name: 'Product Name Capitalization',
        type: 'regex',
        pattern: 'ai website builder',
        flags: 'i',
        description: 'Always capitalize "AI" in product name',
        severity: 'low',
        active: true,
        detailedOnly: false,
        autoCorrectible: true,
        correction: 'AI website builder'
      },
      {
        name: 'Website Spelling',
        type: 'regex',
        pattern: 'web\\s+site',
        flags: 'i',
        description: 'Use "website" as one word, lowercase',
        severity: 'low',
        active: true,
        detailedOnly: false,
        autoCorrectible: true,
        correction: 'website'
      },
      {
        name: 'Casual Language',
        type: 'regex',
        pattern: '\\b(awesome|cool|super|totally|guys|stuff|things)\\b',
        flags: 'i',
        description: 'Avoid overly casual language that undermines professional tone',
        severity: 'medium',
        active: true,
        detailedOnly: false,
        autoCorrectible: false
      },
      {
        name: 'Technical Jargon',
        type: 'regex',
        pattern: '\\b(algorithm|backend|frontend|codebase|API|framework|implementation|deployment)\\b',
        flags: 'i',
        description: 'Avoid technical jargon unless explaining technical concepts to technical audience',
        severity: 'low',
        active: true,
        detailedOnly: true,
        autoCorrectible: false
      },
      {
        name: 'Competitor References',
        type: 'regex',
        pattern: '\\b(wix|squarespace|wordpress|shopify|weebly)\\b',
        flags: 'i',
        description: 'Avoid direct competitor references without proper context',
        severity: 'high',
        active: true,
        detailedOnly: false,
        autoCorrectible: false
      },
      {
        name: 'First Person Singular',
        type: 'regex',
        pattern: '\\b(I|I\'m|I\'ve|I\'ll|my|mine|myself)\\b',
        flags: 'i',
        description: 'Use first person plural (we, our) instead of first person singular',
        severity: 'medium',
        active: true,
        detailedOnly: true,
        autoCorrectible: false
      },
      {
        name: 'Weak Value Propositions',
        type: 'regex',
        pattern: '\\b(might|could|maybe|possibly|perhaps|sometimes)\\b\\s+help',
        flags: 'i',
        description: 'Use confident language about product benefits',
        severity: 'medium',
        active: true,
        detailedOnly: false,
        autoCorrectible: false
      },
      {
        name: 'Feature Focus Without Benefits',
        type: 'regex',
        pattern: '(includes|offers|provides|has)\\s+[^.]+\\.',
        flags: 'i',
        description: 'Always connect features to benefits',
        severity: 'medium',
        active: true,
        detailedOnly: true,
        autoCorrectible: false
      },
      {
        name: 'Outdated Product References',
        type: 'regex',
        pattern: '\\b(drag and drop|template library|basic website)\\b',
        flags: 'i',
        description: 'Focus on AI-powered capabilities, not basic website builder features',
        severity: 'low',
        active: true,
        detailedOnly: false,
        autoCorrectible: false
      }
    ];
  }
}

module.exports = ConsistencyChecker;