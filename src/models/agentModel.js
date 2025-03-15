/**
 * Agent Model
 * Schema for AI agents
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Agent extends BaseModel {
  // Define model attributes
  static attributes = {
    agentId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'error', 'maintenance'),
      defaultValue: 'active'
    },
    type: {
      type: DataTypes.ENUM('content_strategy', 'content_creation', 'content_management', 'optimisation', 'brand_consistency'),
      allowNull: false
    },
    modules: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    config: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    lastActivity: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    lastErrorTimestamp: {
      type: DataTypes.DATE,
      allowNull: true
    },
    performance: {
      type: DataTypes.JSONB,
      defaultValue: {
        requestsProcessed: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0
      }
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true
    }
  };

  // Model options
  static options = {
    tableName: 'agents',
    timestamps: true,
    indexes: [
      {
        fields: ['agentId']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['lastActivity']
      }
    ]
  };

  /**
   * Update agent activity
   * Method to update the last activity timestamp
   */
  updateActivity() {
    this.lastActivity = new Date();
    return this.save();
  }

  /**
   * Record request
   * Method to record a request and update performance metrics
   * @param {boolean} successful - Whether the request was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  recordRequest(successful, responseTime) {
    const performance = { ...this.performance };
    
    performance.requestsProcessed += 1;
    
    if (successful) {
      performance.successfulRequests += 1;
    } else {
      performance.failedRequests += 1;
    }
    
    // Update average response time with a weighted approach
    const totalRequests = performance.requestsProcessed;
    const currentAverage = performance.averageResponseTime || 0;
    
    if (totalRequests <= 1) {
      performance.averageResponseTime = responseTime;
    } else {
      performance.averageResponseTime = 
        ((currentAverage * (totalRequests - 1)) + responseTime) / totalRequests;
    }
    
    this.performance = performance;
    return this.save();
  }

  /**
   * Generate a unique agent ID
   * @param {string} type - Agent type
   * @returns {string} - Unique agent ID
   */
  static generateAgentId(type) {
    const agentTypePrefix = type ? type.substring(0, 3).toUpperCase() : 'AGT';
    return this.generateUniqueId(agentTypePrefix);
  }

  /**
   * Define associations with other models
   * @param {Object} _models - All registered models
   */
  static associate(_models) {
    // Define associations if needed
  }
}

module.exports = Agent;