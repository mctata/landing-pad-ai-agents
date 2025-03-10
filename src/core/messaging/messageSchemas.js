// src/core/messaging/messageSchemas.js
const Joi = require('joi');
const logger = require('../utils/logger');

// Base metadata schema that all messages will have
const metadataSchema = Joi.object({
  timestamp: Joi.string().isoDate().required(),
  messageId: Joi.string().required(),
  correlationId: Joi.string().allow(null),
  source: Joi.string().required(),
  retryCount: Joi.number().integer().min(0).default(0),
  priority: Joi.number().integer().min(1).max(10).default(5),
  userId: Joi.string().allow(null),
  sessionId: Joi.string().allow(null)
}).unknown(true);

// Message schemas for different message types
const schemas = {
  // Command schemas
  commands: {
    'content.create': Joi.object({
      contentType: Joi.string().required(),
      title: Joi.string().required(),
      description: Joi.string().allow(''),
      tags: Joi.array().items(Joi.string()),
      targetAudience: Joi.string().allow(''),
      dueDate: Joi.string().isoDate().allow(null),
      priority: Joi.number().integer().min(1).max(10).default(5)
    }),
    
    'content.update': Joi.object({
      contentId: Joi.string().required(),
      changes: Joi.object().min(1).required()
    }),
    
    'content.publish': Joi.object({
      contentId: Joi.string().required(),
      channels: Joi.array().items(Joi.string()),
      scheduledTime: Joi.string().isoDate().allow(null)
    }),
    
    'content.delete': Joi.object({
      contentId: Joi.string().required(),
      reason: Joi.string().allow('')
    }),
    
    'content.optimize': Joi.object({
      contentId: Joi.string().required(),
      optimizationTypes: Joi.array().items(Joi.string().valid(
        'seo', 'readability', 'engagement', 'conversion'
      ))
    }),
    
    'content.check-brand-consistency': Joi.object({
      contentId: Joi.string().required(),
      strictMode: Joi.boolean().default(false)
    })
  },
  
  // Event schemas
  events: {
    'content.created': Joi.object({
      contentId: Joi.string().required(),
      contentType: Joi.string().required(),
      title: Joi.string().required(),
      createdBy: Joi.string().required(),
      createdAt: Joi.string().isoDate().required()
    }),
    
    'content.updated': Joi.object({
      contentId: Joi.string().required(),
      changedFields: Joi.array().items(Joi.string()),
      updatedBy: Joi.string().required(),
      updatedAt: Joi.string().isoDate().required()
    }),
    
    'content.published': Joi.object({
      contentId: Joi.string().required(),
      channels: Joi.array().items(Joi.string()),
      publishedBy: Joi.string().required(),
      publishedAt: Joi.string().isoDate().required()
    }),
    
    'content.deleted': Joi.object({
      contentId: Joi.string().required(),
      deletedBy: Joi.string().required(),
      deletedAt: Joi.string().isoDate().required()
    }),
    
    'content.optimized': Joi.object({
      contentId: Joi.string().required(),
      optimizationTypes: Joi.array().items(Joi.string()),
      improvementScore: Joi.number().min(0).max(100),
      completedAt: Joi.string().isoDate().required()
    }),
    
    'content.brand-checked': Joi.object({
      contentId: Joi.string().required(),
      consistent: Joi.boolean().required(),
      issues: Joi.array().items(Joi.object({
        type: Joi.string().required(),
        description: Joi.string().required(),
        severity: Joi.string().valid('low', 'medium', 'high').required()
      })),
      completedAt: Joi.string().isoDate().required()
    }),
    
    'workflow.started': Joi.object({
      workflowId: Joi.string().required(),
      workflowType: Joi.string().required(),
      contentId: Joi.string().allow(null),
      startedBy: Joi.string().required(),
      startedAt: Joi.string().isoDate().required()
    }),
    
    'workflow.completed': Joi.object({
      workflowId: Joi.string().required(),
      workflowType: Joi.string().required(),
      contentId: Joi.string().allow(null),
      completedAt: Joi.string().isoDate().required(),
      duration: Joi.number().min(0)
    }),
    
    'workflow.failed': Joi.object({
      workflowId: Joi.string().required(),
      workflowType: Joi.string().required(),
      contentId: Joi.string().allow(null),
      error: Joi.string().required(),
      failedAt: Joi.string().isoDate().required(),
      stage: Joi.string().required()
    })
  },
  
  // Query schemas
  queries: {
    'content.get': Joi.object({
      contentId: Joi.string().required(),
      includeHistory: Joi.boolean().default(false),
      includeMetadata: Joi.boolean().default(true)
    }),
    
    'content.search': Joi.object({
      query: Joi.string().allow(''),
      contentTypes: Joi.array().items(Joi.string()),
      tags: Joi.array().items(Joi.string()),
      status: Joi.string(),
      dateRange: Joi.object({
        from: Joi.string().isoDate(),
        to: Joi.string().isoDate()
      }),
      page: Joi.number().integer().min(1).default(1),
      pageSize: Joi.number().integer().min(1).max(100).default(20)
    }),
    
    'workflow.status': Joi.object({
      workflowId: Joi.string().required()
    }),
    
    'agent.status': Joi.object({
      agentId: Joi.string().required()
    })
  }
};

/**
 * Validates a message against its schema
 * @param {string} type - Message type (commands, events, queries)
 * @param {string} action - Specific message action
 * @param {Object} data - Message data to validate
 * @param {Object} metadata - Message metadata
 * @returns {Object} - Validation result with success flag and error if applicable
 */
function validateMessage(type, action, data, metadata) {
  // Get the schema for this message type and action
  const schema = schemas[type] && schemas[type][action];
  
  if (!schema) {
    return {
      success: false,
      error: `No schema defined for message type: ${type}.${action}`
    };
  }
  
  try {
    // Validate data against the schema
    const dataValidation = schema.validate(data, { abortEarly: false });
    
    // Validate metadata against the metadata schema
    const metadataValidation = metadataSchema.validate(metadata, { abortEarly: false });
    
    // Check if there are any validation errors
    if (dataValidation.error || metadataValidation.error) {
      const errors = [];
      
      if (dataValidation.error) {
        errors.push(`Data validation errors: ${dataValidation.error.message}`);
      }
      
      if (metadataValidation.error) {
        errors.push(`Metadata validation errors: ${metadataValidation.error.message}`);
      }
      
      return {
        success: false,
        error: errors.join('; ')
      };
    }
    
    // Return success with validated data
    return {
      success: true,
      data: dataValidation.value,
      metadata: metadataValidation.value
    };
  } catch (error) {
    logger.error(`Message validation error for ${type}.${action}`, error);
    return {
      success: false,
      error: `Validation error: ${error.message}`
    };
  }
}

/**
 * Creates a message with validated data and metadata
 */
function createMessage(type, action, data, metadata = {}) {
  // Add default metadata values
  const defaultMetadata = {
    timestamp: new Date().toISOString(),
    messageId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    source: 'system',
    retryCount: 0
  };
  
  const mergedMetadata = { ...defaultMetadata, ...metadata };
  
  // Validate the message
  const validationResult = validateMessage(type, action, data, mergedMetadata);
  
  if (!validationResult.success) {
    throw new Error(validationResult.error);
  }
  
  // Return the validated message
  return {
    data: validationResult.data,
    metadata: validationResult.metadata
  };
}

module.exports = {
  validateMessage,
  createMessage,
  schemas
};
