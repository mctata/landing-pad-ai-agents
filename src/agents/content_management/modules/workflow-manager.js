/**
 * Workflow Manager Module for Content Management Agent
 * Manages content workflows from creation to publication
 */

const BaseModule = require('../../../common/models/base-module');

class WorkflowManager extends BaseModule {
  constructor(config, storage, logger, messaging) {
    super(config, storage, logger);
    this.messaging = messaging;
    this.name = 'workflow_manager';
    this.workflowStages = [];
    this.autoProgressEnabled = false;
    this.reminderFrequency = 'daily';
  }

  async initialize() {
    await super.initialize();
    
    this.logger.info('Initializing workflow manager module');
    
    // Set configuration options
    if (this.config.settings) {
      this.workflowStages = this.config.settings.stages || [];
      this.autoProgressEnabled = this.config.settings.autoProgressEnabled || false;
      this.reminderFrequency = this.config.settings.reminderFrequency || 'daily';
    }
    
    // Create collection for workflows if it doesn't exist
    if (!this.storage.collections.content_workflows) {
      await this.storage.db.createCollection('content_workflows');
      this.storage.collections.content_workflows = this.storage.db.collection('content_workflows');
      
      // Create indexes
      await this.storage.collections.content_workflows.createIndex({ content_id: 1 });
      await this.storage.collections.content_workflows.createIndex({ current_stage: 1 });
      await this.storage.collections.content_workflows.createIndex({ updated_at: 1 });
      await this.storage.collections.content_workflows.createIndex({ deadline: 1 });
    }
    
    // Create collection for workflow transitions
    if (!this.storage.collections.workflow_transitions) {
      await this.storage.db.createCollection('workflow_transitions');
      this.storage.collections.workflow_transitions = this.storage.db.collection('workflow_transitions');
      
      // Create indexes
      await this.storage.collections.workflow_transitions.createIndex({ workflow_id: 1 });
      await this.storage.collections.workflow_transitions.createIndex({ timestamp: 1 });
    }
    
    // Set up default workflow stages if none exist
    if (this.workflowStages.length === 0) {
      this.workflowStages = ['draft', 'review', 'approved', 'scheduled', 'published'];
    }
    
    // Set up scheduled tasks
    this.reminderInterval = this._setupReminderSchedule();
    
    // Set up event handlers
    this._setupEventHandlers();
    
    this.logger.info('Workflow manager module initialized');
  }

  async start() {
    await super.start();
    
    // Initial check for stalled content
    await this._checkStalledContent();
    
    this.logger.info('Workflow manager module started');
  }

  async stop() {
    await super.stop();
    
    // Clear reminder interval
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
    
    this.logger.info('Workflow manager module stopped');
  }

  /**
   * Create new workflow for content
   * 
   * @param {string} contentId - Content ID
   * @param {Object} options - Workflow options
   * @returns {Object} Created workflow
   */
  async createWorkflow(contentId, options = {}) {
    this.logger.info('Creating new workflow', { contentId });
    
    // Check if content exists
    const contentItem = await this.storage.collections.content_items.findOne({
      _id: this.storage.ObjectId(contentId)
    });
    
    if (!contentItem) {
      throw new Error(`Content not found: ${contentId}`);
    }
    
    // Check if workflow already exists
    const existingWorkflow = await this.storage.collections.content_workflows.findOne({
      content_id: this.storage.ObjectId(contentId)
    });
    
    if (existingWorkflow) {
      throw new Error(`Workflow already exists for content: ${contentId}`);
    }
    
    // Set initial stage
    const initialStage = options.initialStage || this.workflowStages[0];
    
    if (!this.workflowStages.includes(initialStage)) {
      throw new Error(`Invalid workflow stage: ${initialStage}`);
    }
    
    // Create workflow
    const workflow = {
      content_id: this.storage.ObjectId(contentId),
      content_title: contentItem.title,
      content_type: contentItem.type,
      workflow_id: this._generateWorkflowId(),
      current_stage: initialStage,
      stage_history: [
        {
          stage: initialStage,
          timestamp: new Date(),
          user: options.user || 'system',
          notes: options.notes || 'Workflow created'
        }
      ],
      assignees: options.assignees || [],
      deadline: options.deadline ? new Date(options.deadline) : null,
      priority: options.priority || 'normal',
      metadata: options.metadata || {},
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Insert workflow
    await this.storage.collections.content_workflows.insertOne(workflow);
    
    // Log creation
    this._logTransition({
      workflow_id: workflow.workflow_id,
      content_id: contentId,
      from_stage: null,
      to_stage: initialStage,
      user: options.user || 'system',
      notes: options.notes || 'Workflow created',
      timestamp: new Date()
    });
    
    // Notify assignees
    if (workflow.assignees.length > 0 && this.messaging) {
      this._notifyAssignees(workflow, 'assigned', options.user || 'system');
    }
    
    return workflow;
  }

  /**
   * Update workflow stage
   * 
   * @param {string} workflowId - Workflow ID
   * @param {string} stage - New stage
   * @param {Object} options - Update options
   * @returns {Object} Updated workflow
   */
  async updateWorkflowStage(workflowId, stage, options = {}) {
    this.logger.info('Updating workflow stage', { workflowId, stage });
    
    // Check if stage is valid
    if (!this.workflowStages.includes(stage)) {
      throw new Error(`Invalid workflow stage: ${stage}`);
    }
    
    // Get workflow
    const workflow = await this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    // Skip if already in the requested stage
    if (workflow.current_stage === stage) {
      return workflow;
    }
    
    // Get previous stage for logging
    const previousStage = workflow.current_stage;
    
    // Update workflow
    await this.storage.collections.content_workflows.updateOne(
      { workflow_id: workflowId },
      {
        $set: {
          current_stage: stage,
          updated_at: new Date()
        },
        $push: {
          stage_history: {
            stage,
            timestamp: new Date(),
            user: options.user || 'system',
            notes: options.notes || `Stage updated to ${stage}`
          }
        }
      }
    );
    
    // Get updated workflow
    const updatedWorkflow = await this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
    
    // Log transition
    this._logTransition({
      workflow_id: workflowId,
      content_id: workflow.content_id.toString(),
      from_stage: previousStage,
      to_stage: stage,
      user: options.user || 'system',
      notes: options.notes || `Stage updated to ${stage}`,
      timestamp: new Date()
    });
    
    // If the 'published' stage is reached, update content status
    if (stage === 'published') {
      await this._handlePublishedContent(workflow.content_id.toString());
    }
    
    // Notify assignees
    if (updatedWorkflow.assignees.length > 0 && this.messaging) {
      this._notifyAssignees(updatedWorkflow, 'stage_changed', options.user || 'system', {
        from_stage: previousStage,
        to_stage: stage
      });
    }
    
    return updatedWorkflow;
  }

  /**
   * Update workflow assignees
   * 
   * @param {string} workflowId - Workflow ID
   * @param {Array} assignees - New assignees
   * @param {Object} options - Update options
   * @returns {Object} Updated workflow
   */
  async updateAssignees(workflowId, assignees, options = {}) {
    this.logger.info('Updating workflow assignees', { 
      workflowId,
      assigneeCount: assignees.length
    });
    
    // Get workflow
    const workflow = await this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    // Find new assignees
    const previousAssignees = workflow.assignees || [];
    const newAssignees = assignees.filter(a => !previousAssignees.includes(a));
    
    // Update workflow
    await this.storage.collections.content_workflows.updateOne(
      { workflow_id: workflowId },
      {
        $set: {
          assignees,
          updated_at: new Date()
        },
        $push: {
          stage_history: {
            stage: workflow.current_stage,
            timestamp: new Date(),
            user: options.user || 'system',
            notes: options.notes || `Assignees updated: ${assignees.join(', ')}`
          }
        }
      }
    );
    
    // Get updated workflow
    const updatedWorkflow = await this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
    
    // Notify new assignees
    if (newAssignees.length > 0 && this.messaging) {
      this._notifyAssignees(updatedWorkflow, 'assigned', options.user || 'system', {
        new_assignees: newAssignees
      });
    }
    
    return updatedWorkflow;
  }

  /**
   * Update workflow deadline
   * 
   * @param {string} workflowId - Workflow ID
   * @param {Date} deadline - New deadline
   * @param {Object} options - Update options
   * @returns {Object} Updated workflow
   */
  async updateDeadline(workflowId, deadline, options = {}) {
    this.logger.info('Updating workflow deadline', { 
      workflowId,
      deadline
    });
    
    // Get workflow
    const workflow = await this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    // Parse deadline
    const deadlineDate = deadline ? new Date(deadline) : null;
    
    // Update workflow
    await this.storage.collections.content_workflows.updateOne(
      { workflow_id: workflowId },
      {
        $set: {
          deadline: deadlineDate,
          updated_at: new Date()
        },
        $push: {
          stage_history: {
            stage: workflow.current_stage,
            timestamp: new Date(),
            user: options.user || 'system',
            notes: options.notes || `Deadline updated: ${deadlineDate ? deadlineDate.toISOString() : 'None'}`
          }
        }
      }
    );
    
    // Get updated workflow
    const updatedWorkflow = await this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
    
    // Notify assignees
    if (updatedWorkflow.assignees.length > 0 && this.messaging && deadlineDate) {
      this._notifyAssignees(updatedWorkflow, 'deadline_updated', options.user || 'system');
    }
    
    return updatedWorkflow;
  }

  /**
   * Get workflow for content
   * 
   * @param {string} contentId - Content ID
   * @returns {Object} Workflow or null if not found
   */
  async getWorkflowForContent(contentId) {
    return this.storage.collections.content_workflows.findOne({
      content_id: this.storage.ObjectId(contentId)
    });
  }

  /**
   * Get workflow by ID
   * 
   * @param {string} workflowId - Workflow ID
   * @returns {Object} Workflow or null if not found
   */
  async getWorkflow(workflowId) {
    return this.storage.collections.content_workflows.findOne({
      workflow_id: workflowId
    });
  }

  /**
   * Get workflows by stage
   * 
   * @param {string} stage - Workflow stage
   * @param {Object} options - Query options
   * @returns {Array} Workflows in the specified stage
   */
  async getWorkflowsByStage(stage, options = {}) {
    const query = { current_stage: stage };
    
    // Add additional filters
    if (options.contentType) {
      query.content_type = options.contentType;
    }
    
    if (options.assignee) {
      query.assignees = options.assignee;
    }
    
    // Build sort
    const sort = {};
    if (options.sortBy) {
      sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.updated_at = -1;
    }
    
    // Get workflows
    return this.storage.collections.content_workflows
      .find(query)
      .sort(sort)
      .limit(options.limit || 100)
      .toArray();
  }

  /**
   * Get content approaching deadline
   * 
   * @param {number} daysThreshold - Days threshold for approaching deadline
   * @returns {Array} Workflows approaching deadline
   */
  async getApproachingDeadlines(daysThreshold = 3) {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(now.getDate() + daysThreshold);
    
    return this.storage.collections.content_workflows
      .find({
        deadline: { 
          $gte: now,
          $lte: thresholdDate
        },
        current_stage: { $ne: 'published' }
      })
      .sort({ deadline: 1 })
      .toArray();
  }

  /**
   * Get overdue content
   * 
   * @returns {Array} Overdue workflows
   */
  async getOverdueContent() {
    const now = new Date();
    
    return this.storage.collections.content_workflows
      .find({
        deadline: { $lt: now },
        current_stage: { $ne: 'published' }
      })
      .sort({ deadline: 1 })
      .toArray();
  }

  /**
   * Get workflow transition history
   * 
   * @param {string} workflowId - Workflow ID
   * @param {Object} options - Query options
   * @returns {Array} Workflow transitions
   */
  async getWorkflowHistory(workflowId, options = {}) {
    return this.storage.collections.workflow_transitions
      .find({ workflow_id: workflowId })
      .sort({ timestamp: -1 })
      .limit(options.limit || 100)
      .toArray();
  }

  /**
   * Generate content workflow report
   * 
   * @param {Object} options - Report options
   * @returns {Object} Workflow report
   */
  async generateWorkflowReport(options = {}) {
    this.logger.info('Generating workflow report');
    
    // Get counts by stage
    const stageCounts = {};
    for (const stage of this.workflowStages) {
      const count = await this.storage.collections.content_workflows
        .countDocuments({ current_stage: stage });
      
      stageCounts[stage] = count;
    }
    
    // Get overdue content
    const overdueContent = await this.getOverdueContent();
    
    // Get content approaching deadline
    const approachingDeadlines = await this.getApproachingDeadlines(options.deadlineThreshold || 3);
    
    // Get average time in each stage
    const stageTimeStats = await this._calculateStageTimeStats();
    
    // Get bottleneck stage (stage with most content or longest average time)
    let bottleneckStage = Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .shift();
    
    if (bottleneckStage) {
      bottleneckStage = bottleneckStage[0];
    } else {
      bottleneckStage = null;
    }
    
    // Calculate efficiency
    const publishedCount = await this.storage.collections.workflow_transitions
      .countDocuments({ 
        to_stage: 'published',
        timestamp: { 
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      });
    
    const totalContentCount = await this.storage.collections.content_items.countDocuments();
    
    const efficiency = {
      content_published_30d: publishedCount,
      total_in_workflow: Object.values(stageCounts).reduce((sum, count) => sum + count, 0),
      publishing_efficiency: publishedCount > 0 && totalContentCount > 0 ? 
        (publishedCount / totalContentCount) * 100 : 0
    };
    
    return {
      generated_at: new Date(),
      stage_counts: stageCounts,
      overdue_count: overdueContent.length,
      approaching_deadline_count: approachingDeadlines.length,
      stage_time_stats: stageTimeStats,
      bottleneck_stage: bottleneckStage,
      efficiency,
      overdue_content: overdueContent.map(w => ({
        workflow_id: w.workflow_id,
        content_id: w.content_id,
        content_title: w.content_title,
        current_stage: w.current_stage,
        deadline: w.deadline,
        days_overdue: Math.ceil((new Date() - new Date(w.deadline)) / (1000 * 60 * 60 * 24))
      })),
      approaching_deadlines: approachingDeadlines.map(w => ({
        workflow_id: w.workflow_id,
        content_id: w.content_id,
        content_title: w.content_title,
        current_stage: w.current_stage,
        deadline: w.deadline,
        days_remaining: Math.ceil((new Date(w.deadline) - new Date()) / (1000 * 60 * 60 * 24))
      }))
    };
  }

  /**
   * Set up event handlers
   * @private
   */
  _setupEventHandlers() {
    // Handle content updated events
    if (this.messaging) {
      this.messaging.subscribe('content.updated', async (message) => {
        const { contentId } = message;
        
        // Get workflow for content
        const workflow = await this.getWorkflowForContent(contentId);
        
        // Auto-progress if enabled
        if (workflow && this.autoProgressEnabled) {
          await this._handleContentUpdated(workflow, contentId);
        }
      });
      
      // Handle content review events
      this.messaging.subscribe('content.reviewed', async (message) => {
        const { contentId, approved, reviewer, comments } = message;
        
        // Get workflow for content
        const workflow = await this.getWorkflowForContent(contentId);
        
        if (workflow) {
          await this._handleContentReviewed(workflow, approved, reviewer, comments);
        }
      });
    }
  }

  /**
   * Set up reminder schedule
   * @private
   */
  _setupReminderSchedule() {
    // Convert frequency to milliseconds
    const frequencies = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = frequencies[this.reminderFrequency] || frequencies.daily;
    
    // Set up interval
    return setInterval(() => {
      this._sendWorkflowReminders()
        .catch(error => this.logger.error('Error sending workflow reminders:', error));
    }, interval);
  }

  /**
   * Send workflow reminders
   * @private
   */
  async _sendWorkflowReminders() {
    this.logger.info('Sending workflow reminders');
    
    // Get approaching deadlines
    const approachingDeadlines = await this.getApproachingDeadlines();
    
    // Get overdue content
    const overdueContent = await this.getOverdueContent();
    
    // Send reminders
    if (approachingDeadlines.length > 0 || overdueContent.length > 0) {
      // Group by assignee
      const remindersByAssignee = {};
      
      // Add approaching deadlines
      for (const workflow of approachingDeadlines) {
        for (const assignee of workflow.assignees) {
          if (!remindersByAssignee[assignee]) {
            remindersByAssignee[assignee] = {
              approaching: [],
              overdue: []
            };
          }
          
          remindersByAssignee[assignee].approaching.push(workflow);
        }
      }
      
      // Add overdue content
      for (const workflow of overdueContent) {
        for (const assignee of workflow.assignees) {
          if (!remindersByAssignee[assignee]) {
            remindersByAssignee[assignee] = {
              approaching: [],
              overdue: []
            };
          }
          
          remindersByAssignee[assignee].overdue.push(workflow);
        }
      }
      
      // Send notifications
      for (const [assignee, reminders] of Object.entries(remindersByAssignee)) {
        if (this.messaging) {
          this.messaging.sendNotification(assignee, 'workflow_reminder', {
            approaching_deadlines: reminders.approaching,
            overdue_content: reminders.overdue
          });
        }
      }
    }
    
    // Check for stalled content
    await this._checkStalledContent();
  }

  /**
   * Check for stalled content
   * @private
   */
  async _checkStalledContent() {
    this.logger.info('Checking for stalled content');
    
    // Get workflows that haven't been updated in 7 days and aren't published
    const stalledThreshold = new Date();
    stalledThreshold.setDate(stalledThreshold.getDate() - 7);
    
    const stalledWorkflows = await this.storage.collections.content_workflows
      .find({
        updated_at: { $lt: stalledThreshold },
        current_stage: { $ne: 'published' }
      })
      .toArray();
    
    // Send notifications for stalled workflows
    for (const workflow of stalledWorkflows) {
      if (workflow.assignees.length > 0 && this.messaging) {
        this._notifyAssignees(workflow, 'workflow_stalled', 'system');
      }
    }
    
    this.logger.info('Stalled content check complete', {
      stalledCount: stalledWorkflows.length
    });
  }

  /**
   * Handle content updated event
   * @private
   */
  async _handleContentUpdated(workflow, contentId) {
    // Auto-progress logic based on current stage
    const currentStageIndex = this.workflowStages.indexOf(workflow.current_stage);
    
    // Can't progress if already at final stage
    if (currentStageIndex === this.workflowStages.length - 1) {
      return;
    }
    
    // Auto-progress based on specific stages
    switch (workflow.current_stage) {
      case 'draft':
        // Move to review stage when draft is updated
        await this.updateWorkflowStage(workflow.workflow_id, 'review', {
          user: 'system',
          notes: 'Automatically progressed to review stage after content update'
        });
        break;
        
      // Other stages might have specific auto-progress logic
      
      default:
        // No automatic progression for other stages
        break;
    }
  }

  /**
   * Handle content reviewed event
   * @private
   */
  async _handleContentReviewed(workflow, approved, reviewer, comments) {
    // If content is approved, move to next stage
    if (approved) {
      const currentStageIndex = this.workflowStages.indexOf(workflow.current_stage);
      
      // Can't progress if already at final stage
      if (currentStageIndex === this.workflowStages.length - 1) {
        return;
      }
      
      // Progress to next stage
      const nextStage = this.workflowStages[currentStageIndex + 1];
      
      await this.updateWorkflowStage(workflow.workflow_id, nextStage, {
        user: reviewer,
        notes: `Content approved and progressed to ${nextStage}. Review comments: ${comments || 'None'}`
      });
    } else {
      // If not approved, stay in current stage but update history
      await this.storage.collections.content_workflows.updateOne(
        { workflow_id: workflow.workflow_id },
        {
          $push: {
            stage_history: {
              stage: workflow.current_stage,
              timestamp: new Date(),
              user: reviewer,
              notes: `Content review - Not approved. Comments: ${comments || 'None'}`
            }
          },
          $set: {
            updated_at: new Date()
          }
        }
      );
      
      // Notify assignees
      if (workflow.assignees.length > 0 && this.messaging) {
        this._notifyAssignees(workflow, 'content_rejected', reviewer, {
          comments
        });
      }
    }
  }

  /**
   * Handle published content
   * @private
   */
  async _handlePublishedContent(contentId) {
    // Update content status to published
    await this.storage.collections.content_items.updateOne(
      { _id: this.storage.ObjectId(contentId) },
      {
        $set: {
          status: 'published',
          published_at: new Date()
        }
      }
    );
    
    // Notify about publication
    if (this.messaging) {
      this.messaging.publish('content.published', { contentId });
    }
  }

  /**
   * Notify workflow assignees
   * @private
   */
  _notifyAssignees(workflow, eventType, user, extraData = {}) {
    for (const assignee of workflow.assignees) {
      this.messaging.sendNotification(assignee, eventType, {
        workflow_id: workflow.workflow_id,
        content_id: workflow.content_id.toString(),
        content_title: workflow.content_title,
        stage: workflow.current_stage,
        updated_by: user,
        ...extraData
      });
    }
  }

  /**
   * Log workflow transition
   * @private
   */
  async _logTransition(transition) {
    try {
      await this.storage.collections.workflow_transitions.insertOne(transition);
    } catch (error) {
      this.logger.error('Error logging workflow transition:', error);
    }
  }

  /**
   * Calculate average time in each stage
   * @private
   */
  async _calculateStageTimeStats() {
    const stats = {};
    
    // Initialize stats for each stage
    for (const stage of this.workflowStages) {
      stats[stage] = {
        avg_time_in_stage: 0,
        median_time_in_stage: 0,
        count: 0
      };
    }
    
    // Get all transitions grouped by content
    const transitions = await this.storage.collections.workflow_transitions
      .find()
      .sort({ timestamp: 1 })
      .toArray();
    
    // Group transitions by workflow
    const transitionsByWorkflow = {};
    
    for (const transition of transitions) {
      if (!transitionsByWorkflow[transition.workflow_id]) {
        transitionsByWorkflow[transition.workflow_id] = [];
      }
      
      transitionsByWorkflow[transition.workflow_id].push(transition);
    }
    
    // Calculate time in each stage
    const stageTimesList = {};
    
    for (const workflowId in transitionsByWorkflow) {
      const workflow = transitionsByWorkflow[workflowId];
      
      // Sort transitions by timestamp
      workflow.sort((a, b) => a.timestamp - b.timestamp);
      
      // Calculate time in each stage
      for (let i = 0; i < workflow.length - 1; i++) {
        const current = workflow[i];
        const next = workflow[i + 1];
        
        if (current.to_stage) {
          const stage = current.to_stage;
          const timeInStage = next.timestamp - current.timestamp;
          
          // Initialize if needed
          if (!stageTimesList[stage]) {
            stageTimesList[stage] = [];
          }
          
          // Add time in milliseconds
          stageTimesList[stage].push(timeInStage);
        }
      }
    }
    
    // Calculate averages
    for (const stage in stageTimesList) {
      const times = stageTimesList[stage];
      
      if (times.length > 0) {
        // Calculate average (in hours)
        const avg = times.reduce((sum, time) => sum + time, 0) / times.length / (1000 * 60 * 60);
        
        // Calculate median (in hours)
        times.sort((a, b) => a - b);
        const median = times[Math.floor(times.length / 2)] / (1000 * 60 * 60);
        
        stats[stage] = {
          avg_time_in_stage: Math.round(avg * 10) / 10, // Round to 1 decimal place
          median_time_in_stage: Math.round(median * 10) / 10,
          count: times.length
        };
      }
    }
    
    return stats;
  }

  /**
   * Generate workflow ID
   * @private
   */
  _generateWorkflowId() {
    return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

module.exports = WorkflowManager;