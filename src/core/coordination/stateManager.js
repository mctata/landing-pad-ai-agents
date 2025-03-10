// src/core/coordination/stateManager.js
const { MongoClient } = require('mongodb');
const config = require('../../config');
const logger = require('../utils/logger');

class StateManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new MongoClient(config.database.url, config.database.options);
      await this.client.connect();
      
      this.db = this.client.db(config.database.name);
      this.collection = this.db.collection('workflow_states');
      
      // Create indexes for efficient lookups
      await this.collection.createIndex({ workflowId: 1 }, { unique: true });
      await this.collection.createIndex({ '_state': 1 });
      await this.collection.createIndex({ '_lastUpdated': 1 });
      
      this.isConnected = true;
      logger.info('StateManager connected to MongoDB');
      
      return this;
    } catch (error) {
      logger.error('Failed to connect StateManager to MongoDB', error);
      throw error;
    }
  }

  async saveWorkflowState(workflowId, state, data = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    try {
      const document = {
        workflowId,
        _state: state,
        _created: new Date(),
        _lastUpdated: new Date(),
        _history: [{
          state,
          timestamp: new Date(),
          data: JSON.parse(JSON.stringify(data)) // Deep clone to avoid reference issues
        }],
        ...data
      };
      
      const result = await this.collection.insertOne(document);
      
      logger.debug(`Saved initial state for workflow ${workflowId}: ${state}`);
      
      return result.insertedId;
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
      const currentDoc = await this.collection.findOne({ workflowId });
      
      if (!currentDoc) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // Determine the state to record
      const stateToRecord = newState || currentDoc._state;
      
      // Create update operation
      const update = {
        $set: {
          _lastUpdated: new Date(),
          ...data
        }
      };
      
      // If state is changing, update the _state field
      if (newState) {
        update.$set._state = newState;
      }
      
      // Add to history
      update.$push = {
        _history: {
          state: stateToRecord,
          timestamp: new Date(),
          data: JSON.parse(JSON.stringify(data)) // Deep clone
        }
      };
      
      // Execute update
      const result = await this.collection.updateOne(
        { workflowId },
        update
      );
      
      if (result.modifiedCount === 0) {
        throw new Error(`Failed to update workflow ${workflowId} state`);
      }
      
      logger.debug(`Updated state for workflow ${workflowId}${newState ? ` to ${newState}` : ''}`);
      
      return result.modifiedCount;
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
      const doc = await this.collection.findOne({ workflowId });
      
      if (!doc) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      return doc;
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
      const doc = await this.collection.findOne(
        { workflowId },
        { projection: { _history: 1 } }
      );
      
      if (!doc) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      return doc._history || [];
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
      const count = await this.collection.countDocuments({ workflowId }, { limit: 1 });
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
      const workflows = await this.collection.find(
        { _state: state },
        {
          projection: { workflowId: 1, _state: 1, _created: 1, _lastUpdated: 1 },
          limit,
          skip,
          sort: { _lastUpdated: -1 }
        }
      ).toArray();
      
      return workflows;
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
      
      const result = await this.collection.deleteMany({
        _created: { $lt: cutoffDate },
        _state: { $in: ['workflow-completed', 'workflow-failed'] }
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old workflow states`);
      
      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to clean up old workflows', error);
      throw error;
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      logger.info('StateManager disconnected from MongoDB');
    }
  }
}

module.exports = StateManager;
