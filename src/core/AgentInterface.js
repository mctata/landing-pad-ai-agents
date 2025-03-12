/**
 * Agent Interface
 * Provides a unified interface for interacting with all agents
 */

const { v4: uuidv4 } = require('uuid');
const LoggerService = require('../common/services/logger');
const agentFactory = require('../common/services/agent-factory');
const { getInstance: getCoordinationService } = require('./coordination/coordinationService');

class AgentInterface {
  constructor() {
    this.logger = new LoggerService().getLogger('agent-interface');
    this.coordinationService = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing Agent Interface');

    // Initialize agent factory
    await agentFactory.initialize();

    // Initialize coordination service
    this.coordinationService = await getCoordinationService();

    this.initialized = true;
    this.logger.info('Agent Interface initialized');
  }

  /**
   * Send a command to a specific agent
   * @param {string} agentType - Type of agent to send command to
   * @param {string} commandType - Type of command to send
   * @param {Object} payload - Command payload
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Command result
   */
  async sendCommand(agentType, commandType, payload = {}, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info(`Sending command to agent: ${agentType}.${commandType}`);

    try {
      // Get or create agent instance
      const agent = await agentFactory.createAgent(agentType);

      // Create command
      const command = {
        id: metadata.commandId || uuidv4(),
        type: commandType,
        payload,
        timestamp: new Date().toISOString(),
        metadata
      };

      // Execute command
      const result = await agent.handleCommand(command);

      this.logger.info(`Command completed: ${agentType}.${commandType}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sending command ${commandType} to agent ${agentType}:`, error);
      throw error;
    }
  }

  /**
   * Start a workflow
   * @param {string} workflowType - Type of workflow to start
   * @param {Object} data - Initial workflow data
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Workflow information
   */
  async startWorkflow(workflowType, data = {}, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.info(`Starting workflow: ${workflowType}`);

    try {
      const result = await this.coordinationService.startWorkflow(workflowType, data, metadata);
      return result;
    } catch (error) {
      this.logger.error(`Error starting workflow ${workflowType}:`, error);
      throw error;
    }
  }

  /**
   * Get workflow status
   * @param {string} workflowId - ID of workflow to check
   * @returns {Promise<Object>} Workflow status
   */
  async getWorkflowStatus(workflowId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.coordinationService.getWorkflowStatus(workflowId);
    } catch (error) {
      this.logger.error(`Error getting workflow status for ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * List active workflows
   * @returns {Promise<Array>} List of active workflows
   */
  async listActiveWorkflows() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.coordinationService.listActiveWorkflows();
    } catch (error) {
      this.logger.error('Error listing active workflows:', error);
      throw error;
    }
  }

  /**
   * List available agent types
   * @returns {Array} List of available agent types
   */
  getAvailableAgentTypes() {
    return agentFactory.getAvailableAgentTypes();
  }

  /**
   * List available workflows
   * @returns {Array} List of available workflow types
   */
  async getAvailableWorkflows() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return this.coordinationService.workflowRegistry.listWorkflows();
    } catch (error) {
      this.logger.error('Error listing available workflows:', error);
      throw error;
    }
  }

  /**
   * Generate content using the content creation agent
   * @param {Object} brief - Content brief
   * @returns {Promise<Object>} Generated content
   */
  async generateContent(brief) {
    return this.sendCommand('content_creation', 'generate_content', { 
      overrides: brief 
    });
  }

  /**
   * Create content with a full workflow
   * @param {Object} brief - Content brief
   * @returns {Promise<Object>} Workflow information
   */
  async createContentWithWorkflow(brief) {
    return this.startWorkflow('content-creation', {
      brief,
      contentType: brief.type || 'blog'
    });
  }

  /**
   * Optimize existing content
   * @param {string} contentId - ID of content to optimize
   * @param {Array} optimizationGoals - Optimization goals (e.g., ['seo', 'readability'])
   * @returns {Promise<Object>} Optimization result
   */
  async optimizeContent(contentId, optimizationGoals = ['seo']) {
    return this.startWorkflow('content-optimization', {
      contentId,
      optimizationGoals
    });
  }

  /**
   * Check content for brand consistency
   * @param {string} contentId - ID of content to check
   * @returns {Promise<Object>} Consistency check result
   */
  async checkBrandConsistency(contentId) {
    return this.sendCommand('brand_consistency', 'check_content', {
      contentId
    });
  }

  /**
   * Generate social media content from existing content
   * @param {string} contentId - ID of source content
   * @param {Array} platforms - Target platforms
   * @returns {Promise<Object>} Generated social media content
   */
  async generateSocialFromContent(contentId, platforms = ['linkedin', 'twitter']) {
    return this.sendCommand('content_creation', 'generate_social', {
      contentId,
      platforms
    });
  }

  /**
   * Generate SEO recommendations for content
   * @param {string} contentId - ID of content to analyze
   * @returns {Promise<Object>} SEO recommendations
   */
  async generateSeoRecommendations(contentId) {
    return this.sendCommand('optimisation', 'generate_seo_recommendations', {
      contentId
    });
  }

  /**
   * Create a content brief
   * @param {Object} briefData - Brief data
   * @returns {Promise<Object>} Created brief
   */
  async createContentBrief(briefData) {
    return this.sendCommand('content_strategy', 'create_brief', briefData);
  }

  /**
   * Shutdown the agent interface
   */
  async shutdown() {
    if (this.initialized) {
      this.logger.info('Shutting down Agent Interface');
      await agentFactory.stopAllAgents();
      await this.coordinationService.shutdown();
      this.initialized = false;
      this.logger.info('Agent Interface shut down');
    }
  }
}

// Singleton instance
const instance = new AgentInterface();

module.exports = instance;