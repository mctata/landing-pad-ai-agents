// src/core/coordination/stateManager.js
// PostgreSQL implementation
const { Sequelize, DataTypes, Op } = require('sequelize');
const config = require('../../config');
const logger = require('../utils/logger');

class StateManager {
  constructor() {
    this.sequelize = null;
    this.WorkflowState = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Initialize Sequelize with the same database configuration
      // This assumes the sequelize is already configured in the app
      const dbConfig = config.database.postgres;
      this.sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
          host: dbConfig.host,
          port: dbConfig.port,
          dialect: 'postgres',
          logging: false,
        }
      );

      // Define the WorkflowState model
      this.WorkflowState = this.sequelize.define('workflow_state', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        workflowId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        _state: {
          type: DataTypes.STRING,
          allowNull: false
        },
        _created: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        _lastUpdated: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        _history: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: []
        },
        data: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        }
      });

      // Sync model to ensure table exists
      await this.WorkflowState.sync();
      
      // Create indexes for efficient lookups
      await this.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_workflow_state_state ON workflow_states (_state)'
      );
      await this.sequelize.query(
        'CREATE INDEX IF NOT EXISTS idx_workflow_state_lastUpdated ON workflow_states (_lastUpdated)'
      );
      
      this.isConnected = true;
      logger.info('StateManager connected to PostgreSQL');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect StateManager to PostgreSQL', error);
      throw error;
    }
  }

  async saveWorkflowState(workflowId, state, data = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const historyEntry = {
        state,
        timestamp: new Date(),
        data: JSON.parse(JSON.stringify(data)) // Deep clone to avoid reference issues
      };
      
      const result = await this.WorkflowState.create({
        workflowId,
        _state: state,
        _created: new Date(),
        _lastUpdated: new Date(),
        _history: [historyEntry],
        data: data
      });
      
      logger.debug(`Saved initial state for workflow ${workflowId}: ${state}`);
      
      return result.id;
    } catch (error) {
      logger.error(`Failed to save workflow state for ${workflowId}`, error);
      throw error;
    }
  }

  async updateWorkflowState(workflowId, data = {}, newState = null) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      // Get current workflow state document
      const currentState = await this.WorkflowState.findOne({
        where: { workflowId }
      });
      
      if (!currentState) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // Determine the state to record
      const stateToRecord = newState || currentState._state;
      
      // Create history entry
      const historyEntry = {
        state: stateToRecord,
        timestamp: new Date(),
        data: JSON.parse(JSON.stringify(data)) // Deep clone
      };
      
      // Update the workflow state
      const updateData = {
        _lastUpdated: new Date(),
        data: { ...currentState.data, ...data },
        _history: [...currentState._history, historyEntry]
      };
      
      // If state is changing, update the _state field
      if (newState) {
        updateData._state = newState;
      }
      
      // Execute update
      const [updated] = await this.WorkflowState.update(updateData, {
        where: { workflowId }
      });
      
      if (updated === 0) {
        throw new Error(`Failed to update workflow ${workflowId} state`);
      }
      
      logger.debug(`Updated state for workflow ${workflowId}${newState ? ` to ${newState}` : ''}`);
      
      return updated;
    } catch (error) {
      logger.error(`Failed to update workflow state for ${workflowId}`, error);
      throw error;
    }
  }

  async getWorkflowState(workflowId) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const state = await this.WorkflowState.findOne({
        where: { workflowId }
      });
      
      if (!state) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // Convert to plain object
      return state.get({ plain: true });
    } catch (error) {
      logger.error(`Failed to get workflow state for ${workflowId}`, error);
      throw error;
    }
  }

  async getWorkflowHistory(workflowId) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const state = await this.WorkflowState.findOne({
        where: { workflowId },
        attributes: ['_history']
      });
      
      if (!state) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      return state._history || [];
    } catch (error) {
      logger.error(`Failed to get workflow history for ${workflowId}`, error);
      throw error;
    }
  }

  async workflowExists(workflowId) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const count = await this.WorkflowState.count({
        where: { workflowId },
        limit: 1
      });
      
      return count > 0;
    } catch (error) {
      logger.error(`Failed to check if workflow ${workflowId} exists`, error);
      throw error;
    }
  }

  async findWorkflowsByState(state, limit = 100, skip = 0) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const workflows = await this.WorkflowState.findAll({
        where: { _state: state },
        attributes: ['workflowId', '_state', '_created', '_lastUpdated'],
        limit,
        offset: skip,
        order: [['_lastUpdated', 'DESC']]
      });
      
      // Convert to plain objects
      return workflows.map(wf => wf.get({ plain: true }));
    } catch (error) {
      logger.error(`Failed to find workflows by state ${state}`, error);
      throw error;
    }
  }

  async cleanupOldWorkflows(olderThanDays = 30) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const result = await this.WorkflowState.destroy({
        where: {
          _created: { [Op.lt]: cutoffDate },
          _state: { [Op.in]: ['workflow-completed', 'workflow-failed'] }
        }
      });
      
      logger.info(`Cleaned up ${result} old workflow states`);
      
      return result;
    } catch (error) {
      logger.error('Failed to clean up old workflows', error);
      throw error;
    }
  }

  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.isConnected = false;
      logger.info('StateManager disconnected from PostgreSQL');
    }
  }
}

module.exports = StateManager;
