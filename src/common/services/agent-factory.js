/**
 * Agent Factory Service
 * Creates and manages agent instances
 */

const path = require('path');
const fs = require('fs');
const LoggerService = require('./logger');
const MessagingService = require('./messaging');
const DatabaseService = require('./database');
const AIProviderService = require('./ai-provider');
const { loadConfig } = require('../utils/config-loader');

class AgentFactory {
  constructor() {
    this.agents = new Map();
    this.config = loadConfig('agents');
    this.logger = new LoggerService().getLogger('agent-factory');
    this.messaging = null;
    this.database = null;
    this.aiProvider = null;
  }

  async initialize() {
    this.logger.info('Initializing agent factory');
    
    // Initialize services
    this.database = new DatabaseService();
    await this.database.connect();
    
    this.messaging = new MessagingService();
    await this.messaging.connect();
    
    this.aiProvider = new AIProviderService();
    await this.aiProvider.initialize();
    
    this.logger.info('Agent factory initialized');
  }

  /**
   * Create an agent instance
   * @param {string} agentType - Type of agent to create
   * @returns {Object} Agent instance
   */
  async createAgent(agentType) {
    if (!this.config.agents[agentType]) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }
    
    // Check if agent already exists
    if (this.agents.has(agentType)) {
      this.logger.warn(`Agent ${agentType} already exists, returning existing instance`);
      return this.agents.get(agentType);
    }
    
    this.logger.info(`Creating agent: ${agentType}`);
    
    try {
      // Dynamically load agent class
      const agentPath = path.join('../../agents', agentType.replace(/-/g, '_'), 'index.js');
      const AgentClass = require(agentPath);
      
      // Create agent instance
      const agent = new AgentClass(
        this.config.agents[agentType],
        this.messaging,
        this.database.getCollections(),
        this.logger.getLogger(agentType),
        this.aiProvider
      );
      
      // Initialize and start agent
      await agent.initialize();
      
      // Store agent instance
      this.agents.set(agentType, agent);
      
      this.logger.info(`Agent created: ${agentType}`);
      return agent;
    } catch (error) {
      this.logger.error(`Failed to create agent ${agentType}:`, error);
      throw error;
    }
  }

  /**
   * Start all created agents
   */
  async startAllAgents() {
    this.logger.info('Starting all agents');
    
    const startPromises = [];
    for (const [agentType, agent] of this.agents.entries()) {
      this.logger.info(`Starting agent: ${agentType}`);
      startPromises.push(agent.start());
    }
    
    await Promise.all(startPromises);
    this.logger.info('All agents started');
  }

  /**
   * Stop all created agents
   */
  async stopAllAgents() {
    this.logger.info('Stopping all agents');
    
    const stopPromises = [];
    for (const [agentType, agent] of this.agents.entries()) {
      this.logger.info(`Stopping agent: ${agentType}`);
      stopPromises.push(agent.stop());
    }
    
    await Promise.all(stopPromises);
    this.logger.info('All agents stopped');
  }

  /**
   * Get list of available agent types
   * @returns {Array} List of available agent types
   */
  getAvailableAgentTypes() {
    return Object.keys(this.config.agents);
  }

  /**
   * Get agent by type
   * @param {string} agentType - Type of agent to get
   * @returns {Object} Agent instance or null if not found
   */
  getAgent(agentType) {
    return this.agents.get(agentType) || null;
  }
}

module.exports = new AgentFactory();