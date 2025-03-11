/**
 * Agent Model
 * Schema for AI agents
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for module configuration
const ModuleConfigSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  enabled: {
    type: Boolean,
    default: true
  },
  config: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  lastError: {
    type: String
  },
  lastErrorTimestamp: {
    type: Date
  }
}, { _id: false });

// Main Agent Schema
const AgentSchema = new Schema({
  agentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error', 'maintenance'],
    default: 'active',
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'content_strategy', 
      'content_creation', 
      'content_management', 
      'optimisation', 
      'brand_consistency'
    ],
    index: true
  },
  modules: [ModuleConfigSchema],
  config: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  lastActivity: {
    type: Date
  },
  lastError: {
    type: String
  },
  lastErrorTimestamp: {
    type: Date
  },
  performance: {
    requestsProcessed: {
      type: Number,
      default: 0
    },
    successfulRequests: {
      type: Number,
      default: 0
    },
    failedRequests: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

/**
 * Update agent activity
 * Method to update the last activity timestamp
 */
AgentSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

/**
 * Record request
 * Method to record a request and update performance metrics
 */
AgentSchema.methods.recordRequest = function(successful, responseTime) {
  this.performance.requestsProcessed += 1;
  
  if (successful) {
    this.performance.successfulRequests += 1;
  } else {
    this.performance.failedRequests += 1;
  }
  
  // Update average response time with a weighted approach
  const totalRequests = this.performance.requestsProcessed;
  const currentAverage = this.performance.averageResponseTime || 0;
  
  if (totalRequests <= 1) {
    this.performance.averageResponseTime = responseTime;
  } else {
    this.performance.averageResponseTime = 
      ((currentAverage * (totalRequests - 1)) + responseTime) / totalRequests;
  }
  
  return this.save();
};

/**
 * Generate agentId
 * Static method to generate a unique agentId
 */
AgentSchema.statics.generateAgentId = function(type) {
  const agentTypePrefix = type ? type.substring(0, 3).toUpperCase() : 'AGT';
  const timestamp = new Date().getTime().toString(36);
  const randomChars = Math.random().toString(36).substring(2, 4);
  return `${agentTypePrefix}-${timestamp}${randomChars}`.toUpperCase();
};

const Agent = mongoose.model('Agent', AgentSchema);

module.exports = Agent;