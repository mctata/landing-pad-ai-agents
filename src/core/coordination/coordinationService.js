// src/core/coordination/coordinationService.js
const { getInstance: getMessageBus } = require('../messaging/messageBus');
const { createMessage } = require('../messaging/messageSchemas');
const StateManager = require('./stateManager');
const WorkflowRegistry = require('./workflowRegistry');
const logger = require('../utils/logger');

class CoordinationService {
  constructor() {
    this.messageBus = null;
    this.stateManager = new StateManager();
    this.workflowRegistry = new WorkflowRegistry();
    this.activeWorkflows = new Map();
    this.subscriptions = [];
  }

  async init() {
    // Connect to the message bus
    this.messageBus = await getMessageBus();
    
    // Register default workflows
    this.registerDefaultWorkflows();
    
    // Subscribe to workflow events
    await this.subscribeToEvents();
    
    logger.info('Agent Coordination Service initialized');
    return this;
  }

  registerDefaultWorkflows() {
    // Content Creation Workflow
    this.workflowRegistry.registerWorkflow('content-creation', {
      name: 'Content Creation Workflow',
      description: 'End-to-end content creation workflow from strategy to publication',
      initialState: 'strategy-planning',
      states: {
        'strategy-planning': {
          agent: 'content-strategy',
          transitions: {
            success: 'content-creation',
            failure: 'workflow-failed'
          }
        },
        'content-creation': {
          agent: 'content-creation',
          transitions: {
            success: 'content-management',
            failure: 'workflow-failed',
            review: 'content-review'
          }
        },
        'content-review': {
          agent: 'content-management',
          transitions: {
            approved: 'content-management',
            rejected: 'content-creation'
          }
        },
        'content-management': {
          agent: 'content-management',
          transitions: {
            success: 'content-optimization',
            failure: 'workflow-failed'
          }
        },
        'content-optimization': {
          agent: 'optimisation',
          transitions: {
            success: 'brand-consistency-check',
            failure: 'workflow-failed'
          }
        },
        'brand-consistency-check': {
          agent: 'brand-consistency',
          transitions: {
            consistent: 'workflow-completed',
            inconsistent: 'content-revision'
          }
        },
        'content-revision': {
          agent: 'content-creation',
          transitions: {
            success: 'brand-consistency-check',
            failure: 'workflow-failed'
          }
        },
        'workflow-completed': {
          final: true
        },
        'workflow-failed': {
          final: true
        }
      }
    });
    
    // Content Update Workflow
    this.workflowRegistry.registerWorkflow('content-update', {
      name: 'Content Update Workflow',
      description: 'Workflow for updating existing content',
      initialState: 'content-update',
      states: {
        'content-update': {
          agent: 'content-creation',
          transitions: {
            success: 'content-management',
            failure: 'workflow-failed'
          }
        },
        'content-management': {
          agent: 'content-management',
          transitions: {
            success: 'content-optimization',
            failure: 'workflow-failed'
          }
        },
        'content-optimization': {
          agent: 'optimisation',
          transitions: {
            success: 'brand-consistency-check',
            failure: 'workflow-failed'
          }
        },
        'brand-consistency-check': {
          agent: 'brand-consistency',
          transitions: {
            consistent: 'workflow-completed',
            inconsistent: 'content-revision'
          }
        },
        'content-revision': {
          agent: 'content-creation',
          transitions: {
            success: 'brand-consistency-check',
            failure: 'workflow-failed'
          }
        },
        'workflow-completed': {
          final: true
        },
        'workflow-failed': {
          final: true
        }
      }
    });
    
    // Content Optimization Workflow
    this.workflowRegistry.registerWorkflow('content-optimization', {
      name: 'Content Optimization Workflow',
      description: 'Workflow for optimizing existing content',
      initialState: 'content-optimization',
      states: {
        'content-optimization': {
          agent: 'optimisation',
          transitions: {
            success: 'brand-consistency-check',
            failure: 'workflow-failed'
          }
        },
        'brand-consistency-check': {
          agent: 'brand-consistency',
          transitions: {
            consistent: 'workflow-completed',
            inconsistent: 'content-revision'
          }
        },
        'content-revision': {
          agent: 'content-creation',
          transitions: {
            success: 'brand-consistency-check',
            failure: 'workflow-failed'
          }
        },
        'workflow-completed': {
          final: true
        },
        'workflow-failed': {
          final: true
        }
      }
    });
  }

  async subscribeToEvents() {
    // Subscribe to workflow events
    const sub1 = await this.messageBus.subscribeToEvent('workflow.started', this.handleWorkflowStarted.bind(this));
    const sub2 = await this.messageBus.subscribeToEvent('workflow.completed', this.handleWorkflowCompleted.bind(this));
    const sub3 = await this.messageBus.subscribeToEvent('workflow.failed', this.handleWorkflowFailed.bind(this));
    const sub4 = await this.messageBus.subscribeToEvent('workflow.state-changed', this.handleWorkflowStateChanged.bind(this));
    
    // Subscribe to agent task events
    const sub5 = await this.messageBus.subscribeToEvent('agent.task-completed', this.handleAgentTaskCompleted.bind(this));
    const sub6 = await this.messageBus.subscribeToEvent('agent.task-failed', this.handleAgentTaskFailed.bind(this));
    
    this.subscriptions.push(sub1, sub2, sub3, sub4, sub5, sub6);
  }

  async startWorkflow(workflowType, data = {}, metadata = {}) {
    try {
      // Get workflow definition
      const workflow = this.workflowRegistry.getWorkflow(workflowType);
      
      if (!workflow) {
        throw new Error(`Workflow type '${workflowType}' not found`);
      }
      
      // Generate workflow ID
      const workflowId = this.generateId();
      
      // Create workflow instance
      const workflowInstance = {
        id: workflowId,
        type: workflowType,
        data,
        currentState: workflow.initialState,
        history: [],
        startTime: new Date(),
        updatedTime: new Date(),
        status: 'active'
      };
      
      // Save workflow instance
      this.activeWorkflows.set(workflowId, workflowInstance);
      
      // Save initial state in state manager
      await this.stateManager.saveWorkflowState(workflowId, workflow.initialState, data);
      
      // Publish workflow started event
      const eventData = {
        workflowId,
        workflowType,
        contentId: data.contentId || null,
        startedBy: metadata.userId || 'system',
        startedAt: new Date().toISOString()
      };
      
      await this.messageBus.publishEvent('workflow.started', createMessage('events', 'workflow.started', eventData, metadata).data);
      
      // Start the first state
      await this.transitionToState(workflowId, workflow.initialState);
      
      return {
        workflowId,
        status: 'started',
        initialState: workflow.initialState
      };
    } catch (error) {
      logger.error('Failed to start workflow', error);
      throw error;
    }
  }

  async transitionToState(workflowId, state) {
    try {
      const workflowInstance = this.activeWorkflows.get(workflowId);
      
      if (!workflowInstance) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      const workflow = this.workflowRegistry.getWorkflow(workflowInstance.type);
      const stateDefinition = workflow.states[state];
      
      if (!stateDefinition) {
        throw new Error(`State ${state} not defined in workflow ${workflowInstance.type}`);
      }
      
      // Record state transition in history
      workflowInstance.history.push({
        fromState: workflowInstance.currentState,
        toState: state,
        timestamp: new Date()
      });
      
      // Update workflow instance
      workflowInstance.currentState = state;
      workflowInstance.updatedTime = new Date();
      
      // Check if this is a final state
      if (stateDefinition.final) {
        if (state === 'workflow-completed') {
          workflowInstance.status = 'completed';
          
          // Publish workflow completed event
          const eventData = {
            workflowId,
            workflowType: workflowInstance.type,
            contentId: workflowInstance.data.contentId || null,
            completedAt: new Date().toISOString(),
            duration: (new Date() - workflowInstance.startTime) / 1000 // duration in seconds
          };
          
          await this.messageBus.publishEvent('workflow.completed', createMessage('events', 'workflow.completed', eventData).data);
          
          // Remove from active workflows
          this.activeWorkflows.delete(workflowId);
        } else if (state === 'workflow-failed') {
          workflowInstance.status = 'failed';
          
          // Leave in active workflows for investigation
        }
        
        logger.info(`Workflow ${workflowId} reached final state: ${state}`);
        return;
      }
      
      // If not a final state, dispatch task to the appropriate agent
      if (stateDefinition.agent) {
        // Get current workflow data
        const stateData = await this.stateManager.getWorkflowState(workflowId);
        
        // Create command for the agent
        const command = `${stateDefinition.agent}.execute-task`;
        const commandData = {
          taskType: state,
          workflowId,
          workflowType: workflowInstance.type,
          data: stateData
        };
        
        // Publish command to the agent
        await this.messageBus.publishCommand(command, createMessage('commands', command, commandData).data);
        
        logger.info(`Dispatched task to agent ${stateDefinition.agent} for workflow ${workflowId} in state ${state}`);
      }
    } catch (error) {
      logger.error(`Failed to transition workflow ${workflowId} to state ${state}`, error);
      
      // Handle the error by transitioning to workflow-failed state if not already there
      if (state !== 'workflow-failed') {
        try {
          await this.transitionWorkflow(workflowId, 'failure', { error: error.message });
        } catch (transitionError) {
          logger.error('Failed to transition workflow to failed state', transitionError);
        }
      }
      
      throw error;
    }
  }

  async transitionWorkflow(workflowId, transitionType, data = {}) {
    try {
      const workflowInstance = this.activeWorkflows.get(workflowId);
      
      if (!workflowInstance) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      const workflow = this.workflowRegistry.getWorkflow(workflowInstance.type);
      const currentState = workflowInstance.currentState;
      const stateDefinition = workflow.states[currentState];
      
      if (!stateDefinition) {
        throw new Error(`Current state ${currentState} not defined in workflow ${workflowInstance.type}`);
      }
      
      const nextState = stateDefinition.transitions && stateDefinition.transitions[transitionType];
      
      if (!nextState) {
        throw new Error(`Transition ${transitionType} not defined for state ${currentState} in workflow ${workflowInstance.type}`);
      }
      
      // Update workflow data in state manager
      await this.stateManager.updateWorkflowState(workflowId, data);
      
      // Publish state change event
      const eventData = {
        workflowId,
        workflowType: workflowInstance.type,
        fromState: currentState,
        toState: nextState,
        transitionType,
        timestamp: new Date().toISOString()
      };
      
      await this.messageBus.publishEvent('workflow.state-changed', createMessage('events', 'workflow.state-changed', eventData).data);
      
      // Transition to the next state
      await this.transitionToState(workflowId, nextState);
      
      return {
        workflowId,
        fromState: currentState,
        toState: nextState,
        transitionType
      };
    } catch (error) {
      logger.error(`Failed to transition workflow ${workflowId} with transition type ${transitionType}`, error);
      throw error;
    }
  }
  
  // Event handlers
  async handleWorkflowStarted(data) {
    logger.info(`Workflow started: ${data.workflowId} (${data.workflowType})`);
  }
  
  async handleWorkflowCompleted(data) {
    logger.info(`Workflow completed: ${data.workflowId} (${data.workflowType})`);
  }
  
  async handleWorkflowFailed(data) {
    logger.error(`Workflow failed: ${data.workflowId} (${data.workflowType}) - ${data.error} at stage ${data.stage}`);
  }
  
  async handleWorkflowStateChanged(data) {
    logger.info(`Workflow state changed: ${data.workflowId} - ${data.fromState} -> ${data.toState} (${data.transitionType})`);
  }
  
  async handleAgentTaskCompleted(data) {
    try {
      const { workflowId, result, transitionType = 'success' } = data;
      
      // Update workflow state with the task result
      await this.stateManager.updateWorkflowState(workflowId, result);
      
      // Transition the workflow using the provided transition type
      await this.transitionWorkflow(workflowId, transitionType, result);
    } catch (error) {
      logger.error(`Failed to handle agent task completion for workflow ${data.workflowId}`, error);
    }
  }
  
  async handleAgentTaskFailed(data) {
    try {
      const { workflowId, error } = data;
      
      // Transition the workflow to the failure state
      await this.transitionWorkflow(workflowId, 'failure', { error });
    } catch (err) {
      logger.error(`Failed to handle agent task failure for workflow ${data.workflowId}`, err);
    }
  }
  
  async getWorkflowStatus(workflowId) {
    const workflowInstance = this.activeWorkflows.get(workflowId);
    
    if (!workflowInstance) {
      // Check if it's in the state manager
      try {
        const exists = await this.stateManager.workflowExists(workflowId);
        
        if (!exists) {
          return {
            exists: false,
            status: 'unknown'
          };
        }
        
        // Workflow exists in state manager but not in active workflows, so it's completed or failed
        const state = await this.stateManager.getWorkflowState(workflowId);
        
        return {
          exists: true,
          status: 'archived',
          currentState: state._state || 'unknown',
          data: state
        };
      } catch (error) {
        logger.error(`Failed to get workflow status for ${workflowId}`, error);
        throw error;
      }
    }
    
    return {
      exists: true,
      status: workflowInstance.status,
      currentState: workflowInstance.currentState,
      startTime: workflowInstance.startTime,
      updatedTime: workflowInstance.updatedTime,
      type: workflowInstance.type,
      history: workflowInstance.history
    };
  }
  
  async listActiveWorkflows() {
    const workflows = [];
    
    for (const [id, workflow] of this.activeWorkflows.entries()) {
      workflows.push({
        id,
        type: workflow.type,
        status: workflow.status,
        currentState: workflow.currentState,
        startTime: workflow.startTime,
        updatedTime: workflow.updatedTime
      });
    }
    
    return workflows;
  }
  
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  async shutdown() {
    // Unsubscribe from all events
    for (const subscription of this.subscriptions) {
      await subscription.unsubscribe();
    }
    
    logger.info('Agent Coordination Service shut down');
  }
}

// Singleton instance
let coordinationServiceInstance = null;

module.exports = {
  getInstance: async () => {
    if (!coordinationServiceInstance) {
      coordinationServiceInstance = new CoordinationService();
      await coordinationServiceInstance.init();
    }
    return coordinationServiceInstance;
  }
};
