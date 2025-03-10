// src/core/coordination/workflowRegistry.js
const logger = require('../utils/logger');

class WorkflowRegistry {
  constructor() {
    this.workflows = new Map();
  }

  /**
   * Register a new workflow definition
   * @param {string} type - Unique identifier for the workflow
   * @param {Object} definition - Workflow definition
   * @returns {boolean} - Success indicator
   */
  registerWorkflow(type, definition) {
    if (this.workflows.has(type)) {
      logger.warn(`Workflow type '${type}' already registered, overwriting`);
    }
    
    // Validate workflow definition
    this.validateWorkflowDefinition(type, definition);
    
    // Store the workflow
    this.workflows.set(type, {
      ...definition,
      registeredAt: new Date()
    });
    
    logger.info(`Registered workflow '${type}': ${definition.name}`);
    
    return true;
  }

  /**
   * Get a workflow definition by type
   * @param {string} type - Workflow type identifier
   * @returns {Object|null} - Workflow definition or null if not found
   */
  getWorkflow(type) {
    return this.workflows.get(type) || null;
  }

  /**
   * List all registered workflows
   * @returns {Array} - Array of workflow definitions with their types
   */
  listWorkflows() {
    const workflowList = [];
    
    for (const [type, definition] of this.workflows.entries()) {
      workflowList.push({
        type,
        name: definition.name,
        description: definition.description,
        registeredAt: definition.registeredAt
      });
    }
    
    return workflowList;
  }

  /**
   * Unregister a workflow
   * @param {string} type - Workflow type to unregister
   * @returns {boolean} - Success indicator
   */
  unregisterWorkflow(type) {
    if (!this.workflows.has(type)) {
      logger.warn(`Workflow type '${type}' not found for unregistration`);
      return false;
    }
    
    this.workflows.delete(type);
    logger.info(`Unregistered workflow '${type}'`);
    
    return true;
  }

  /**
   * Validate a workflow definition
   * @param {string} type - Workflow type
   * @param {Object} definition - Workflow definition to validate
   * @throws {Error} If validation fails
   */
  validateWorkflowDefinition(type, definition) {
    // Check required fields
    if (!definition.name) {
      throw new Error(`Workflow '${type}' is missing required 'name' field`);
    }
    
    if (!definition.initialState) {
      throw new Error(`Workflow '${type}' is missing required 'initialState' field`);
    }
    
    if (!definition.states || typeof definition.states !== 'object' || Object.keys(definition.states).length === 0) {
      throw new Error(`Workflow '${type}' must define at least one state`);
    }
    
    // Check that initialState is a defined state
    if (!definition.states[definition.initialState]) {
      throw new Error(`Workflow '${type}' initialState '${definition.initialState}' is not defined in states`);
    }
    
    // Check each state for validity
    for (const [stateName, stateConfig] of Object.entries(definition.states)) {
      // Final states don't need transitions or agents
      if (stateConfig.final) {
        continue;
      }
      
      // Non-final states need either transitions or a next state
      if (!stateConfig.transitions && !stateConfig.next) {
        throw new Error(`Non-final state '${stateName}' in workflow '${type}' must define transitions or next`);
      }
      
      // If transitions are defined, validate them
      if (stateConfig.transitions) {
        for (const [transitionName, nextState] of Object.entries(stateConfig.transitions)) {
          if (!definition.states[nextState]) {
            throw new Error(`Transition '${transitionName}' in state '${stateName}' points to undefined state '${nextState}'`);
          }
        }
      }
      
      // If next is defined, validate it
      if (stateConfig.next && !definition.states[stateConfig.next]) {
        throw new Error(`Next state '${stateConfig.next}' in state '${stateName}' is undefined`);
      }
      
      // Non-final states should have an agent defined
      if (!stateConfig.agent) {
        logger.warn(`State '${stateName}' in workflow '${type}' does not define an agent`);
      }
    }
    
    // Check for at least one final state
    const hasFinalState = Object.values(definition.states).some(state => state.final);
    
    if (!hasFinalState) {
      throw new Error(`Workflow '${type}' must define at least one final state`);
    }
    
    // Ensure there are no unreachable states
    this.checkForUnreachableStates(type, definition);
  }

  /**
   * Check for unreachable states in the workflow
   * @param {string} type - Workflow type
   * @param {Object} definition - Workflow definition to check
   * @throws {Error} If unreachable states are found
   */
  checkForUnreachableStates(type, definition) {
    const reachableStates = new Set([definition.initialState]);
    let previousSize = 0;
    
    // Keep checking until no new reachable states are found
    while (reachableStates.size > previousSize) {
      previousSize = reachableStates.size;
      
      for (const stateName of reachableStates) {
        const stateConfig = definition.states[stateName];
        
        // Skip final states
        if (stateConfig.final) {
          continue;
        }
        
        // Add states reachable via transitions
        if (stateConfig.transitions) {
          for (const nextState of Object.values(stateConfig.transitions)) {
            reachableStates.add(nextState);
          }
        }
        
        // Add state reachable via next
        if (stateConfig.next) {
          reachableStates.add(stateConfig.next);
        }
      }
    }
    
    // Check for unreachable states
    const allStates = Object.keys(definition.states);
    const unreachableStates = allStates.filter(state => !reachableStates.has(state));
    
    if (unreachableStates.length > 0) {
      logger.warn(`Workflow '${type}' has unreachable states: ${unreachableStates.join(', ')}`);
    }
  }
}

module.exports = WorkflowRegistry;
