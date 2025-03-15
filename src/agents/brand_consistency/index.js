/**
 * Brand Consistency Agent
 * Maintains brand voice and messaging consistency across all content
 */

const BaseAgent = require('../../common/models/base-agent');

class BrandConsistencyAgent extends BaseAgent {
  constructor(config) {
    // Pass name along with config to super
    super({...config, name: 'brandConsistency'});
  }
  
  async initialize() {
    await super.initialize();
    
    // Subscribe to relevant events from other agents
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_creation.content_created',
      this.handleContentCreatedEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_creation.content_edited',
      this.handleContentEditedEvent.bind(this)
    );
  }
  
  /**
   * Review content for brand consistency
   */
  async handleReviewContentCommand(command) {
    const { contentId, checkLevel = 'normal' } = command.payload;
    
    this.logger.info('Reviewing content for brand consistency', { 
      contentId, 
      checkLevel 
    });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get brand consistency checker module
    const consistencyChecker = this.modules.get('consistency_checker');
    if (!consistencyChecker) {
      throw new Error('Consistency checker module not available');
    }
    
    // Load brand guidelines
    const brandGuidelines = await this._loadBrandGuidelines();
    
    // Check content against brand guidelines
    const reviewResult = await consistencyChecker.checkConsistency(
      contentItem,
      brandGuidelines,
      checkLevel
    );
    
    this.logger.info('Brand consistency review completed', { 
      contentId, 
      consistencyScore: reviewResult.score,
      issueCount: reviewResult.issues.length
    });
    
    // Determine review status based on score and issues
    let reviewStatus = 'approved';
    let reviewFeedback = 'Content aligns with brand guidelines.';
    
    if (reviewResult.score < 7) {
      reviewStatus = 'needs_revision';
      reviewFeedback = 'Content requires revision to align with brand guidelines.';
    } else if (reviewResult.issues.length > 0) {
      if (reviewResult.issues.some(issue => issue.severity === 'high')) {
        reviewStatus = 'needs_revision';
        reviewFeedback = 'Content has high-severity brand consistency issues.';
      } else if (reviewResult.autoCorrect) {
        reviewStatus = 'approved_with_changes';
        reviewFeedback = 'Content approved with minor automated corrections.';
      } else {
        reviewStatus = 'approved_with_notes';
        reviewFeedback = 'Content approved with brand consistency notes.';
      }
    }
    
    // Save review result
    const reviewRecord = {
      content_id: this.storage.ObjectId(contentId),
      review_date: new Date(),
      score: reviewResult.score,
      status: reviewStatus,
      issues: reviewResult.issues,
      feedback: reviewFeedback,
      reviewer: command.payload.userId || 'system'
    };
    
    const result = await this.storage.collections.brand_consistency_reviews.insertOne(reviewRecord);
    
    // Update content item with review status
    await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          brand_review_status: reviewStatus,
          brand_review_feedback: reviewFeedback,
          brand_reviewed_at: new Date()
        }
      }
    );
    
    // Publish event with review results
    await this.publishEvent('review_completed', {
      content_id: contentId,
      review_id: result.insertedId,
      status: reviewStatus,
      score: reviewResult.score,
      feedback: reviewFeedback,
      issues: reviewResult.issues
    });
    
    return {
      review_id: result.insertedId,
      status: reviewStatus,
      score: reviewResult.score,
      issues: reviewResult.issues,
      feedback: reviewFeedback
    };
  }
  
  /**
   * Fix brand consistency issues
   */
  async handleFixConsistencyIssuesCommand(command) {
    const { contentId, issues = [] } = command.payload;
    
    this.logger.info('Fixing brand consistency issues', { 
      contentId, 
      issueCount: issues.length 
    });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get consistency fixer module
    const consistencyFixer = this.modules.get('consistency_fixer');
    if (!consistencyFixer) {
      throw new Error('Consistency fixer module not available');
    }
    
    // Load brand guidelines
    const brandGuidelines = await this._loadBrandGuidelines();
    
    // Fix consistency issues
    const fixResult = await consistencyFixer.fixIssues(
      contentItem,
      issues,
      brandGuidelines
    );
    
    // Update content item with fixed content
    await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          content: fixResult.fixedContent,
          updated_at: new Date(),
          updated_by: command.payload.userId || 'system',
          brand_review_status: 'fixed',
          brand_fixed_at: new Date()
        },
        $push: {
          revision_history: {
            previous_content: contentItem.content,
            changed_at: new Date(),
            changed_by: command.payload.userId || 'system',
            reason: 'Brand consistency fixes'
          }
        }
      }
    );
    
    this.logger.info('Brand consistency issues fixed', { 
      contentId, 
      fixedIssueCount: fixResult.fixedIssues.length
    });
    
    // Publish event with fix results
    await this.publishEvent('issues_fixed', {
      content_id: contentId,
      fixed_issues: fixResult.fixedIssues,
      remaining_issues: fixResult.remainingIssues
    });
    
    return {
      fixed_content: fixResult.fixedContent,
      fixed_issues: fixResult.fixedIssues,
      remaining_issues: fixResult.remainingIssues
    };
  }
  
  /**
   * Update brand guidelines
   */
  async handleUpdateGuidelinesCommand(command) {
    const { type, content, updateBy } = command.payload;
    
    this.logger.info('Updating brand guidelines', { type });
    
    // Check if guidelines of this type already exist
    const existingGuidelines = await this.storage.collections.brand_guidelines.findOne({ type });
    
    if (existingGuidelines) {
      // Update existing guidelines
      await this.storage.collections.brand_guidelines.updateOne(
        { type },
        { 
          $set: { 
            content,
            updated_at: new Date(),
            updated_by: updateBy || 'system'
          },
          $push: {
            revision_history: {
              previous_content: existingGuidelines.content,
              changed_at: new Date(),
              changed_by: updateBy || 'system'
            }
          }
        }
      );
      
      this.logger.info('Brand guidelines updated', { type });
    } else {
      // Create new guidelines
      await this.storage.collections.brand_guidelines.insertOne({
        type,
        content,
        created_at: new Date(),
        created_by: updateBy || 'system',
        revision_history: []
      });
      
      this.logger.info('Brand guidelines created', { type });
    }
    
    // Publish event about guidelines update
    await this.publishEvent('guidelines_updated', {
      type,
      updated_by: updateBy || 'system'
    });
    
    return { type, status: 'success' };
  }
  
  /**
   * Check content against brand terminology
   */
  async handleCheckTerminologyCommand(command) {
    const { contentId, text } = command.payload;
    
    // Determine the content to check
    let contentToCheck = text;
    
    if (!contentToCheck && contentId) {
      // Check if content exists
      const contentItem = await this.storage.collections.content_items.findOne(
        { _id: this.storage.ObjectId(contentId) }
      );
      
      if (!contentItem) {
        throw new Error(`Content not found: ${contentId}`);
      }
      
      contentToCheck = this._extractContentText(contentItem);
    }
    
    if (!contentToCheck) {
      throw new Error('No content provided for terminology check');
    }
    
    // Get terminology checker module
    const terminologyChecker = this.modules.get('terminology_checker');
    if (!terminologyChecker) {
      throw new Error('Terminology checker module not available');
    }
    
    // Load brand terminology
    const brandTerminology = await this._loadBrandTerminology();
    
    // Check terminology
    const checkResult = await terminologyChecker.checkTerminology(
      contentToCheck,
      brandTerminology
    );
    
    this.logger.info('Terminology check completed', { 
      contentId: contentId || 'custom_text',
      issueCount: checkResult.issues.length
    });
    
    return checkResult;
  }
  
  /**
   * Generate brand-aligned content
   */
  async handleGenerateAlignedContentCommand(command) {
    const { contentType, topic, targetLength, tone = 'default' } = command.payload;
    
    this.logger.info('Generating brand-aligned content', { 
      contentType, 
      topic,
      targetLength
    });
    
    // Get content generator module
    const alignedGenerator = this.modules.get('aligned_generator');
    if (!alignedGenerator) {
      throw new Error('Aligned generator module not available');
    }
    
    // Load brand guidelines
    const brandGuidelines = await this._loadBrandGuidelines();
    const brandTerminology = await this._loadBrandTerminology();
    
    // Generate aligned content
    const generatedContent = await alignedGenerator.generate(
      contentType,
      topic,
      brandGuidelines,
      brandTerminology,
      targetLength,
      tone
    );
    
    this.logger.info('Brand-aligned content generated', { 
      contentType, 
      topic,
      contentLength: generatedContent.content.length
    });
    
    return generatedContent;
  }
  
  /**
   * Handle content created event from Content Creation Agent
   */
  async handleContentCreatedEvent(event) {
    const { content_id, requires_review } = event.payload;
    
    this.logger.info('Received content created event', { 
      contentId: content_id,
      requiresReview: requires_review
    });
    
    if (requires_review) {
      this.logger.info('Auto-reviewing content for brand consistency', { 
        contentId: content_id 
      });
      
      try {
        // Review content asynchronously
        setTimeout(async () => {
          try {
            await this.handleReviewContentCommand({
              id: this._generateId(),
              type: 'review_content',
              payload: {
                contentId: content_id,
                checkLevel: 'normal'
              }
            });
          } catch (error) {
            this.logger.error('Error auto-reviewing content:', error);
          }
        }, 1000); // Small delay to ensure content is fully processed
      } catch (error) {
        this.logger.error('Error setting up auto-review task:', error);
      }
    }
  }
  
  /**
   * Handle content edited event from Content Creation Agent
   */
  async handleContentEditedEvent(event) {
    const { content_id, requires_review } = event.payload;
    
    this.logger.info('Received content edited event', { 
      contentId: content_id,
      requiresReview: requires_review
    });
    
    if (requires_review) {
      this.logger.info('Auto-reviewing edited content for brand consistency', { 
        contentId: content_id 
      });
      
      try {
        // Review content asynchronously
        setTimeout(async () => {
          try {
            await this.handleReviewContentCommand({
              id: this._generateId(),
              type: 'review_content',
              payload: {
                contentId: content_id,
                checkLevel: 'normal'
              }
            });
          } catch (error) {
            this.logger.error('Error auto-reviewing edited content:', error);
          }
        }, 1000); // Small delay to ensure content is fully processed
      } catch (error) {
        this.logger.error('Error setting up auto-review task:', error);
      }
    }
  }
  
  /**
   * Load brand guidelines from the database
   * @private
   */
  async _loadBrandGuidelines() {
    // Load all guidelines
    const guidelineDocuments = await this.storage.collections.brand_guidelines.find().toArray();
    
    // Process into structured format
    const guidelines = {};
    
    for (const doc of guidelineDocuments) {
      guidelines[doc.type] = doc.content;
    }
    
    // Check if guidelines exist
    if (Object.keys(guidelines).length === 0) {
      // Create default guidelines
      const defaultGuidelines = {
        voice: 'Professional, informative, and helpful voice that positions Landing Pad Digital as an authority in website building.',
        tone: 'Confident but not arrogant. Friendly but not casual. Expert but accessible.',
        messaging: 'Focus on how Landing Pad Digital makes website building easier, faster, and more effective through AI technology.',
        values: 'Innovation, Simplicity, Reliability, Customer-centricity'
      };
      
      // Save default guidelines to database
      for (const [type, content] of Object.entries(defaultGuidelines)) {
        await this.storage.collections.brand_guidelines.insertOne({
          type,
          content,
          created_at: new Date(),
          created_by: 'system',
          revision_history: []
        });
      }
      
      return defaultGuidelines;
    }
    
    return guidelines;
  }
  
  /**
   * Load brand terminology from the database
   * @private
   */
  async _loadBrandTerminology() {
    // Load all terminology
    const terminology = await this.storage.collections.brand_terminology.find().toArray();
    
    // Check if terminology exists
    if (terminology.length === 0) {
      // Create default terminology
      const defaultTerminology = [
        {
          preferred: 'Landing Pad Digital',
          alternatives: ['Landing Pad', 'LPD'],
          usage_notes: 'Use full name "Landing Pad Digital" on first mention, can use "Landing Pad" in subsequent mentions.'
        },
        {
          preferred: 'AI Website Builder',
          alternatives: ['AI-powered website builder', 'AI website creator'],
          usage_notes: 'Always capitalize "AI" when referring to our website builder product.'
        },
        {
          preferred: 'website',
          alternatives: ['web site', 'Website', 'Web site'],
          usage_notes: 'Always use lowercase "website" as one word.'
        }
      ];
      
      // Save default terminology to database
      await this.storage.collections.brand_terminology.insertMany(defaultTerminology);
      
      return defaultTerminology;
    }
    
    return terminology;
  }
  
  /**
   * Extract plain text from content item
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
}

module.exports = BrandConsistencyAgent;