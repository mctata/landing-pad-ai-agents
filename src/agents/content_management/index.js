/**
 * Content Management Agent
 * Organises, categorises, and tracks content across platforms
 */

const BaseAgent = require('../../common/models/base-agent');

class ContentManagementAgent extends BaseAgent {
  constructor(config) {
    // Pass name along with config to super
    super({...config, name: 'contentManagement'});
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
      'content_creation.content_approved',
      this.handleContentApprovedEvent.bind(this)
    );
    
    await this.messaging.subscribeToExchange(
      'agent_events', 
      'content_strategy.brief_created',
      this.handleBriefCreatedEvent.bind(this)
    );
  }
  
  /**
   * Track content item
   */
  async handleTrackContentCommand(command) {
    const { contentId, metadata } = command.payload;
    
    this.logger.info('Tracking content item', { contentId });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get content tracker module
    const contentTracker = this.modules.get('content_tracker');
    if (!contentTracker) {
      throw new Error('Content tracker module not available');
    }
    
    // Track content item
    const trackingResult = await contentTracker.trackContent(contentId, metadata);
    
    this.logger.info('Content tracked', { contentId, tracking_id: trackingResult.tracking_id });
    
    return trackingResult;
  }
  
  /**
   * Categorise content
   */
  async handleCategoriseContentCommand(command) {
    const { contentId, manualCategories = [] } = command.payload;
    
    this.logger.info('Categorising content', { contentId });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get content categoriser module
    const contentCategoriser = this.modules.get('content_categoriser');
    if (!contentCategoriser) {
      throw new Error('Content categoriser module not available');
    }
    
    // Categorise content
    const categories = await contentCategoriser.categorise(
      contentItem,
      manualCategories
    );
    
    // Update content item with categories
    await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          categories,
          categorised_at: new Date()
        }
      }
    );
    
    this.logger.info('Content categorised', { 
      contentId, 
      categoryCount: categories.length 
    });
    
    // Publish event about categorisation
    await this.publishEvent('content_categorised', {
      content_id: contentId,
      categories
    });
    
    return { categories };
  }
  
  /**
   * Schedule content for publishing
   */
  async handleScheduleContentCommand(command) {
    const { contentId, publishDate, platform, status = 'scheduled' } = command.payload;
    
    this.logger.info('Scheduling content', { contentId, publishDate, platform });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Check if content is approved
    if (contentItem.review_status !== 'approved') {
      throw new Error('Cannot schedule content that has not been approved');
    }
    
    // Get content scheduler module
    const contentScheduler = this.modules.get('content_scheduler');
    if (!contentScheduler) {
      throw new Error('Content scheduler module not available');
    }
    
    // Schedule content
    const schedulingResult = await contentScheduler.scheduleContent(
      contentId,
      new Date(publishDate),
      platform,
      status
    );
    
    this.logger.info('Content scheduled', { 
      contentId, 
      schedulingId: schedulingResult.scheduling_id 
    });
    
    // Publish event about scheduling
    await this.publishEvent('content_scheduled', {
      content_id: contentId,
      publish_date: publishDate,
      platform,
      scheduling_id: schedulingResult.scheduling_id
    });
    
    return schedulingResult;
  }
  
  /**
   * Update content workflow status
   */
  async handleUpdateWorkflowStatusCommand(command) {
    const { contentId, newStatus, notes } = command.payload;
    
    this.logger.info('Updating content workflow status', { contentId, newStatus });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne(
      { _id: this.storage.ObjectId(contentId) }
    );
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Get workflow manager module
    const workflowManager = this.modules.get('workflow_manager');
    if (!workflowManager) {
      throw new Error('Workflow manager module not available');
    }
    
    // Check if status transition is valid
    const isValidTransition = await workflowManager.isValidTransition(
      contentItem.status,
      newStatus
    );
    
    if (!isValidTransition) {
      throw new Error(`Invalid status transition from '${contentItem.status}' to '${newStatus}'`);
    }
    
    // Update content status
    await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      { 
        $set: { 
          status: newStatus,
          updated_at: new Date()
        },
        $push: {
          status_history: {
            from: contentItem.status,
            to: newStatus,
            changed_at: new Date(),
            notes: notes || ''
          }
        }
      }
    );
    
    this.logger.info('Content workflow status updated', { 
      contentId, 
      previousStatus: contentItem.status,
      newStatus 
    });
    
    // Publish event about status update
    await this.publishEvent('workflow_status_updated', {
      content_id: contentId,
      previous_status: contentItem.status,
      new_status: newStatus
    });
    
    return {
      content_id: contentId,
      status: newStatus
    };
  }
  
  /**
   * Check content freshness
   */
  async handleCheckContentFreshnessCommand(command) {
    const { contentIds, thresholdDays = 90 } = command.payload;
    
    this.logger.info('Checking content freshness', { 
      contentCount: contentIds ? contentIds.length : 'all',
      thresholdDays 
    });
    
    // Get content freshness checker module
    const freshnessChecker = this.modules.get('freshness_checker');
    if (!freshnessChecker) {
      throw new Error('Freshness checker module not available');
    }
    
    // Check content freshness
    const freshnessResults = await freshnessChecker.checkFreshness(
      contentIds, 
      thresholdDays
    );
    
    this.logger.info('Content freshness check completed', { 
      totalChecked: freshnessResults.total_checked,
      needsUpdate: freshnessResults.needs_update.length
    });
    
    // If there are items needing updates, publish event
    if (freshnessResults.needs_update.length > 0) {
      await this.publishEvent('content_needs_refresh', {
        content_ids: freshnessResults.needs_update.map(item => item.content_id),
        threshold_days: thresholdDays
      });
    }
    
    return freshnessResults;
  }
  
  /**
   * Generate content report
   */
  async handleGenerateReportCommand(command) {
    const { reportType, timeframe, filters = {} } = command.payload;
    
    this.logger.info('Generating content report', { reportType, timeframe });
    
    // Get reporting module
    const reportingModule = this.modules.get('reporting');
    if (!reportingModule) {
      throw new Error('Reporting module not available');
    }
    
    // Generate report
    const report = await reportingModule.generateReport(
      reportType,
      timeframe,
      filters
    );
    
    this.logger.info('Report generated', { 
      reportType, 
      reportId: report.report_id 
    });
    
    return report;
  }
  
  /**
   * Search content
   */
  async handleSearchContentCommand(command) {
    const { query, contentTypes = [], categories = [], limit = 20, skip = 0 } = command.payload;
    
    this.logger.info('Searching content', { query });
    
    // Get content search module
    const contentSearch = this.modules.get('content_search');
    if (!contentSearch) {
      throw new Error('Content search module not available');
    }
    
    // Search content
    const searchResults = await contentSearch.search(
      query,
      contentTypes,
      categories,
      limit,
      skip
    );
    
    this.logger.info('Content search completed', { 
      resultsCount: searchResults.total 
    });
    
    return searchResults;
  }
  
  /**
   * Handle content created event from Content Creation Agent
   */
  async handleContentCreatedEvent(event) {
    const { content_id, type, requires_review } = event.payload;
    
    this.logger.info('Received content created event', { 
      contentId: content_id, 
      type 
    });
    
    // Auto-categorise the content
    try {
      await this.handleCategoriseContentCommand({
        id: this._generateId(),
        type: 'categorise_content',
        payload: {
          contentId: content_id
        }
      });
    } catch (error) {
      this.logger.error('Error auto-categorising content:', error);
    }
    
    // Track the content
    try {
      await this.handleTrackContentCommand({
        id: this._generateId(),
        type: 'track_content',
        payload: {
          contentId: content_id,
          metadata: {
            source: 'internal',
            initial_tracking: true
          }
        }
      });
    } catch (error) {
      this.logger.error('Error tracking content:', error);
    }
    
    // Update workflow status
    try {
      await this.handleUpdateWorkflowStatusCommand({
        id: this._generateId(),
        type: 'update_workflow_status',
        payload: {
          contentId: content_id,
          newStatus: requires_review ? 'pending_review' : 'draft',
          notes: 'Automatically updated by Content Management Agent'
        }
      });
    } catch (error) {
      this.logger.error('Error updating workflow status:', error);
    }
  }
  
  /**
   * Handle content approved event from Content Creation Agent
   */
  async handleContentApprovedEvent(event) {
    const { content_id, ready_for_publishing } = event.payload;
    
    this.logger.info('Received content approved event', { 
      contentId: content_id,
      readyForPublishing: ready_for_publishing
    });
    
    if (ready_for_publishing) {
      // Update workflow status
      try {
        await this.handleUpdateWorkflowStatusCommand({
          id: this._generateId(),
          type: 'update_workflow_status',
          payload: {
            contentId: content_id,
            newStatus: 'ready_for_publishing',
            notes: 'Automatically marked as ready for publishing'
          }
        });
      } catch (error) {
        this.logger.error('Error updating workflow status:', error);
      }
      
      // Check if auto-scheduling is enabled
      if (this.config.auto_schedule_content) {
        try {
          // Get the content item
          const contentItem = await this.storage.collections.content_items.findOne(
            { _id: this.storage.ObjectId(content_id) }
          );
          
          if (!contentItem) {
            throw new Error(`Content not found: ${content_id}`);
          }
          
          // Get the scheduler module to determine best publishing time
          const scheduler = this.modules.get('content_scheduler');
          if (!scheduler) {
            throw new Error('Content scheduler module not available');
          }
          
          // Determine optimal publishing time
          const publishingSlot = await scheduler.findOptimalPublishingSlot(
            contentItem.type,
            contentItem.categories || []
          );
          
          // Schedule the content
          await this.handleScheduleContentCommand({
            id: this._generateId(),
            type: 'schedule_content',
            payload: {
              contentId: content_id,
              publishDate: publishingSlot.date,
              platform: publishingSlot.platform,
              status: 'scheduled'
            }
          });
        } catch (error) {
          this.logger.error('Error auto-scheduling content:', error);
        }
      }
    }
  }
  
  /**
   * Handle brief created event from Content Strategy Agent
   */
  async handleBriefCreatedEvent(event) {
    const { brief_id, type, topic } = event.payload;
    
    this.logger.info('Received brief created event', { 
      briefId: brief_id, 
      type, 
      topic 
    });
    
    // Track the brief in the content workflow
    try {
      // Get workflow manager module
      const workflowManager = this.modules.get('workflow_manager');
      if (!workflowManager) {
        throw new Error('Workflow manager module not available');
      }
      
      // Add brief to workflow
      await workflowManager.trackContentBrief(brief_id, type, topic);
      
      this.logger.info('Brief added to workflow tracking', { briefId: brief_id });
    } catch (error) {
      this.logger.error('Error tracking brief in workflow:', error);
    }
  }
}

module.exports = ContentManagementAgent;