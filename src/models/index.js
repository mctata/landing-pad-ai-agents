/**
 * Database Models Index
 * Exports all models for easy importing
 */

// Import all models
const User = require('./userModel');
const Content = require('./contentModel');
const ContentVersion = require('./contentVersionModel');
const Brief = require('./briefModel');
const Metric = require('./metricModel');
const BrandGuideline = require('./brandGuidelineModel');
const Workflow = require('./workflowModel');
const WorkflowStep = require('./workflowStepModel');
const Agent = require('./agentModel');
const Schedule = require('./scheduleModel');
const Report = require('./reportModel');
const ApiKey = require('./apiKeyModel');

// Export all models
module.exports = {
  User,
  Content,
  ContentVersion,
  Brief,
  Metric,
  BrandGuideline,
  Workflow,
  WorkflowStep,
  Agent,
  Schedule,
  Report,
  ApiKey
};