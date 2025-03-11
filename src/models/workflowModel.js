/**
 * Workflow Model
 * Schema for content workflows
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for workflow step
const WorkflowStepSchema = new Schema({
  stepId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  agent: {
    type: String,
    required: true
  },
  module: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'skipped'],
    default: 'pending'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  duration: {
    type: Number
  },
  result: {
    type: Schema.Types.Mixed
  },
  error: {
    type: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  dependencies: {
    type: [String],
    default: []
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: false });

// Main Workflow Schema
const WorkflowSchema = new Schema({
  workflowId: {
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
  type: {
    type: String,
    required: true,
    enum: [
      'content_creation', 
      'content_optimization', 
      'brand_check', 
      'publication', 
      'reporting'
    ],
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  contentId: {
    type: String,
    index: true
  },
  briefId: {
    type: String,
    index: true
  },
  steps: [WorkflowStepSchema],
  currentStep: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  duration: {
    type: Number
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for content and workflow type
WorkflowSchema.index({ contentId: 1, type: 1 });

/**
 * Generate workflowId
 * Static method to generate a unique workflowId
 */
WorkflowSchema.statics.generateWorkflowId = function() {
  const timestamp = new Date().getTime().toString(36);
  const randomChars = Math.random().toString(36).substring(2, 5);
  return `WF-${timestamp}${randomChars}`.toUpperCase();
};

const Workflow = mongoose.model('Workflow', WorkflowSchema);

module.exports = Workflow;