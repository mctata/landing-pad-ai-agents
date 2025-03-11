/**
 * Consistency Fixer Module for Brand Consistency Agent
 * Automatically fixes brand consistency issues in content
 */

const BaseModule = require('../../../common/models/base-module');

class ConsistencyFixer extends BaseModule {
  constructor(config, storage, logger, aiProvider) {
    super(config, storage, logger);
    this.aiProvider = aiProvider;
    this.name = 'consistency_fixer';
    this.autoFixLevel = 'suggestion';
    this.priorityIssues = [];
    this.explanationsEnabled = true;
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing consistency fixer module');
    
    // Set configuration options
    if (this.config.settings) {
      this.autoFixLevel = this.config.settings.autoFixLevel || 'suggestion';
      this.priorityIssues = this.config.settings.priorityIssues || [];
      this.explanationsEnabled = this.config.settings.explanationsEnabled !== false;
    }
    
    // Create collection for fix history if it doesn't exist
    if (!this.storage.collections.consistency_fixes) {
      await this.storage.db.createCollection('consistency_fixes');
      this.storage.collections.consistency_fixes = this.storage.db.collection('consistency_fixes');
      
      // Create indexes
      await this.storage.collections.consistency_fixes.createIndex({ content_id: 1 });
      await this.storage.collections.consistency_fixes.createIndex({ fixed_at: 1 });
    }
    
    this.logger.info('Consistency fixer module initialized');
  }

  /**
   * Fix consistency issues in content
   * 
   * @param {Object} contentItem - Content to fix
   * @param {Array} issues - Consistency issues to fix
   * @returns {Object} Fixed content and fix details
   */
  async fixConsistencyIssues(contentItem, issues) {
    this.logger.info('Fixing consistency issues', { 
      contentId: contentItem._id,
      issueCount: issues.length
    });
    
    // If no issues, return original content
    if (!issues || issues.length === 0) {
      return {
        content_id: contentItem._id,
        content: contentItem,
        fixed_issues: [],
        fixed_at: new Date(),
        summary: "No consistency issues to fix"
      };
    }
    
    // Prioritize issues
    const prioritizedIssues = this._prioritizeIssues(issues);
    
    // Create a copy of content item to modify
    const fixedContent = JSON.parse(JSON.stringify(contentItem));
    const fixDetails = [];
    
    // Apply terminology fixes
    const terminologyFixes = this._applyTerminologyFixes(fixedContent, 
      prioritizedIssues.filter(issue => issue.type === 'terminology'));
    fixDetails.push(...terminologyFixes);
    
    // Apply tone fixes
    const toneFixes = await this._applyToneFixes(fixedContent, 
      prioritizedIssues.filter(issue => issue.type === 'tone'));
    fixDetails.push(...toneFixes);
    
    // Apply messaging fixes
    const messagingFixes = await this._applyMessagingFixes(fixedContent, 
      prioritizedIssues.filter(issue => issue.type === 'messaging'));
    fixDetails.push(...messagingFixes);
    
    // Generate summary of fixes
    const summary = await this._generateFixSummary(fixDetails);
    
    // Track fix history
    await this._trackFixHistory(contentItem._id, fixDetails);
    
    this.logger.info('Consistency issues fixed', { 
      contentId: contentItem._id,
      fixCount: fixDetails.length
    });
    
    return {
      content_id: contentItem._id,
      content: fixedContent,
      fixed_issues: fixDetails,
      fixed_at: new Date(),
      summary
    };
  }

  /**
   * Get fix history for content
   * 
   * @param {string} contentId - Content ID
   * @param {number} limit - Maximum number of records to return
   * @returns {Array} Fix history records
   */
  async getFixHistory(contentId, limit = 10) {
    const history = await this.storage.collections.consistency_fixes
      .find({ content_id: this.storage.ObjectId(contentId) })
      .sort({ fixed_at: -1 })
      .limit(limit)
      .toArray();
    
    return history;
  }

  /**
   * Analyze and suggest batch fixes for multiple content items
   * 
   * @param {Array} contentItems - Array of content items
   * @param {Array} issues - Array of issues by content ID
   * @returns {Object} Batch fix suggestions
   */
  async suggestBatchFixes(contentItems, issues) {
    this.logger.info('Suggesting batch fixes', { 
      contentCount: contentItems.length,
      issueCount: Object.values(issues).flat().length
    });
    
    // Group issues by type
    const issuesByType = {};
    for (const [contentId, contentIssues] of Object.entries(issues)) {
      for (const issue of contentIssues) {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push({
          ...issue,
          content_id: contentId
        });
      }
    }
    
    // Generate suggestions for each issue type
    const suggestions = {};
    for (const [type, typeIssues] of Object.entries(issuesByType)) {
      suggestions[type] = await this._generateBatchFixSuggestions(type, typeIssues);
    }
    
    // Generate overall summary
    const summaryPrompt = `
I need to fix brand consistency issues across ${contentItems.length} content items. 
The issues can be grouped into these categories:

${Object.entries(issuesByType).map(([type, issues]) => 
  `- ${type}: ${issues.length} issues`
).join('\n')}

Write a brief summary (150 words max) that outlines an approach for efficiently addressing these issues.
Focus on maintaining brand voice while correcting inconsistencies.
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
      this.logger.error('Error generating batch fix summary:', error);
      summary = `Found ${Object.values(issues).flat().length} consistency issues across ${contentItems.length} content items. Consider applying batch fixes to address common issues.`;
    }
    
    return {
      content_count: contentItems.length,
      issue_count: Object.values(issues).flat().length,
      suggestions_by_type: suggestions,
      summary
    };
  }

  /**
   * Prioritize issues for fixing
   * @private
   */
  _prioritizeIssues(issues) {
    // Sort issues based on priority
    return issues.sort((a, b) => {
      // Priority issues first
      const aIsPriority = this.priorityIssues.includes(a.type);
      const bIsPriority = this.priorityIssues.includes(b.type);
      
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      
      // Then by severity
      return (b.severity || 1) - (a.severity || 1);
    });
  }

  /**
   * Apply terminology fixes to content
   * @private
   */
  _applyTerminologyFixes(content, issues) {
    const fixDetails = [];
    
    // Process each terminology issue
    for (const issue of issues) {
      if (!issue.term || !issue.preferred) continue;
      
      const originalValue = this._getNestedPropertyValue(content, issue.path);
      
      if (typeof originalValue === 'string') {
        // Replace all occurrences of incorrect term with preferred term
        const fixedValue = originalValue.replace(
          new RegExp(this._escapeRegExp(issue.term), 'g'), 
          issue.preferred
        );
        
        // Update content with fixed value
        if (originalValue !== fixedValue) {
          this._setNestedPropertyValue(content, issue.path, fixedValue);
          
          fixDetails.push({
            type: 'terminology',
            path: issue.path,
            original: issue.term,
            fixed: issue.preferred,
            explanation: issue.explanation || `Changed "${issue.term}" to "${issue.preferred}" for consistent terminology`
          });
        }
      }
    }
    
    return fixDetails;
  }

  /**
   * Apply tone fixes to content
   * @private
   */
  async _applyToneFixes(content, issues) {
    const fixDetails = [];
    
    // Group tone issues by content field
    const issuesByPath = {};
    for (const issue of issues) {
      if (!issue.path) continue;
      
      if (!issuesByPath[issue.path]) {
        issuesByPath[issue.path] = [];
      }
      
      issuesByPath[issue.path].push(issue);
    }
    
    // Fix each field with tone issues
    for (const [path, pathIssues] of Object.entries(issuesByPath)) {
      const originalValue = this._getNestedPropertyValue(content, path);
      
      if (typeof originalValue === 'string') {
        // Generate prompt for AI to fix tone
        const toneAttributes = pathIssues
          .map(issue => issue.expected)
          .filter(Boolean)
          .join(', ');
        
        const fixPrompt = `
Fix the following text to align with our brand tone which should be ${toneAttributes}:

"${originalValue}"

Maintain the original meaning but adjust the tone to be more ${toneAttributes}.
Return only the corrected text without explanations or formatting.
`;
        
        try {
          const fixedValue = await this.aiProvider.generateText({
            provider: 'anthropic',
            model: 'claude-2',
            messages: [
              { role: 'user', content: fixPrompt }
            ],
            temperature: 0.3,
            max_tokens: Math.max(originalValue.length * 1.5, 1000)
          });
          
          // Update content with fixed value
          if (originalValue !== fixedValue) {
            this._setNestedPropertyValue(content, path, fixedValue);
            
            fixDetails.push({
              type: 'tone',
              path: path,
              original: originalValue,
              fixed: fixedValue,
              explanation: `Adjusted tone to be more ${toneAttributes}`
            });
          }
        } catch (error) {
          this.logger.error('Error fixing tone:', error);
        }
      }
    }
    
    return fixDetails;
  }

  /**
   * Apply messaging fixes to content
   * @private
   */
  async _applyMessagingFixes(content, issues) {
    const fixDetails = [];
    
    // Group messaging issues by content field
    const issuesByPath = {};
    for (const issue of issues) {
      if (!issue.path) continue;
      
      if (!issuesByPath[issue.path]) {
        issuesByPath[issue.path] = [];
      }
      
      issuesByPath[issue.path].push(issue);
    }
    
    // Fix each field with messaging issues
    for (const [path, pathIssues] of Object.entries(issuesByPath)) {
      const originalValue = this._getNestedPropertyValue(content, path);
      
      if (typeof originalValue === 'string') {
        // Collect messaging requirements
        const messagingRequirements = pathIssues
          .map(issue => issue.requirement)
          .filter(Boolean)
          .join('\n- ');
        
        const fixPrompt = `
Revise the following content to align with our brand messaging requirements:

CONTENT: "${originalValue}"

MESSAGING REQUIREMENTS:
- ${messagingRequirements}

Improve the content to meet these requirements while preserving the original meaning.
Return only the corrected text without explanations or formatting.
`;
        
        try {
          const fixedValue = await this.aiProvider.generateText({
            provider: 'anthropic',
            model: 'claude-2',
            messages: [
              { role: 'user', content: fixPrompt }
            ],
            temperature: 0.3,
            max_tokens: Math.max(originalValue.length * 1.5, 1000)
          });
          
          // Update content with fixed value
          if (originalValue !== fixedValue) {
            this._setNestedPropertyValue(content, path, fixedValue);
            
            fixDetails.push({
              type: 'messaging',
              path: path,
              original: originalValue,
              fixed: fixedValue,
              explanation: `Aligned messaging with brand requirements`
            });
          }
        } catch (error) {
          this.logger.error('Error fixing messaging:', error);
        }
      }
    }
    
    return fixDetails;
  }

  /**
   * Generate summary of fixes
   * @private
   */
  async _generateFixSummary(fixDetails) {
    if (fixDetails.length === 0) {
      return "No changes were made to the content.";
    }
    
    // Count fixes by type
    const fixesByType = {};
    for (const fix of fixDetails) {
      fixesByType[fix.type] = (fixesByType[fix.type] || 0) + 1;
    }
    
    // Create summary of fixes
    const summaryText = `Made ${fixDetails.length} fixes: ` + 
      Object.entries(fixesByType)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
    
    // If explanations are enabled, generate detailed summary
    if (this.explanationsEnabled && fixDetails.length > 0) {
      const summaryPrompt = `
I made the following fixes to improve brand consistency:

${fixDetails.map(fix => `- ${fix.explanation}`).join('\n')}

Write a brief summary (100 words max) explaining the importance of these fixes for brand consistency.
`;
      
      try {
        const aiResponse = await this.aiProvider.generateText({
          provider: 'anthropic',
          model: 'claude-2',
          messages: [
            { role: 'user', content: summaryPrompt }
          ],
          temperature: 0.3,
          max_tokens: 150
        });
        
        return aiResponse.trim();
      } catch (error) {
        this.logger.error('Error generating fix summary:', error);
        return summaryText;
      }
    }
    
    return summaryText;
  }

  /**
   * Track fix history in database
   * @private
   */
  async _trackFixHistory(contentId, fixDetails) {
    try {
      await this.storage.collections.consistency_fixes.insertOne({
        content_id: this.storage.ObjectId(contentId),
        fixed_at: new Date(),
        fix_count: fixDetails.length,
        fixes: fixDetails.map(fix => ({
          type: fix.type,
          path: fix.path,
          explanation: fix.explanation
        }))
      });
    } catch (error) {
      this.logger.error('Error tracking fix history:', error);
    }
  }

  /**
   * Generate batch fix suggestions for an issue type
   * @private
   */
  async _generateBatchFixSuggestions(type, issues) {
    // Group similar issues
    const groupedIssues = {};
    
    for (const issue of issues) {
      // Create a key for grouping
      let groupKey;
      
      if (type === 'terminology') {
        groupKey = `${issue.term}|${issue.preferred}`;
      } else if (type === 'tone') {
        groupKey = issue.expected || 'general_tone';
      } else if (type === 'messaging') {
        groupKey = issue.requirement || 'general_messaging';
      } else {
        groupKey = 'other';
      }
      
      if (!groupedIssues[groupKey]) {
        groupedIssues[groupKey] = {
          issues: [],
          sample: issue
        };
      }
      
      groupedIssues[groupKey].issues.push(issue);
    }
    
    // Generate suggestions for each group
    const suggestions = [];
    
    for (const [groupKey, group] of Object.entries(groupedIssues)) {
      let suggestion;
      
      if (type === 'terminology') {
        const [term, preferred] = groupKey.split('|');
        suggestion = {
          type: 'terminology',
          description: `Replace "${term}" with "${preferred}" (${group.issues.length} occurrences)`,
          find: term,
          replace: preferred,
          occurrence_count: group.issues.length
        };
      } else if (type === 'tone') {
        suggestion = {
          type: 'tone',
          description: `Fix tone to be more ${group.sample.expected || 'on-brand'} (${group.issues.length} occurrences)`,
          tone_attribute: group.sample.expected,
          occurrence_count: group.issues.length,
          example: group.sample.path ? `Path: ${group.sample.path}` : undefined
        };
      } else if (type === 'messaging') {
        suggestion = {
          type: 'messaging',
          description: `Align messaging with "${group.sample.requirement || 'brand guidelines'}" (${group.issues.length} occurrences)`,
          requirement: group.sample.requirement,
          occurrence_count: group.issues.length,
          example: group.sample.path ? `Path: ${group.sample.path}` : undefined
        };
      }
      
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
    
    return suggestions;
  }

  /**
   * Get nested property value from object
   * @private
   */
  _getNestedPropertyValue(obj, path) {
    if (!path) return obj;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
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

  /**
   * Escape regular expression special characters
   * @private
   */
  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = ConsistencyFixer;