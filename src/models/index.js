/**
 * Database Models Index
 * Exports all models for easy importing
 */

// Export all models
module.exports = {
  Content: require('./contentModel'),
  ContentVersion: require('./contentVersionModel'),
  Brief: require('./briefModel'),
  Metric: require('./metricModel'),
  BrandGuideline: require('./brandGuidelineModel'),
  User: require('./userModel'),
  Workflow: require('./workflowModel'),
  Agent: require('./agentModel'),
  Schedule: require('./scheduleModel'),
  Report: require('./reportModel'),
  ApiKey: require('./apiKeyModel')
};