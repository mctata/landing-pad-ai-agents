/**
 * Validation Middleware
 * Validates API request data
 */

const Joi = require('joi');

/**
 * Validate request data against schema
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Request property to validate (body, query, params)
 * @returns {Function} Validation middleware
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source]);
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: errorMessage,
          code: 'validation_error'
        }
      });
    }
    
    // Replace request data with validated data
    req[source] = value;
    next();
  };
};

// Validation schemas

/**
 * Content Strategy Agent schemas
 */
exports.createBrief = validate(Joi.object({
  type: Joi.string().valid('blog', 'social', 'website', 'email', 'landing_page').required(),
  topic: Joi.string().required(),
  targetAudience: Joi.alternatives().try(
    Joi.string(),
    Joi.object()
  ),
  keywords: Joi.array().items(Joi.string()),
  userId: Joi.string()
}));

exports.generateCalendar = validate(Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  channels: Joi.array().items(Joi.string()).min(1).required(),
  numberOfItems: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.string()
}));

exports.analyzeAudience = validate(Joi.object({
  segment: Joi.string().required(),
  dataSource: Joi.string(),
  userId: Joi.string()
}));

/**
 * Content Creation Agent schemas
 */
exports.generateContent = validate(Joi.object({
  briefId: Joi.string().when('overrides', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  type: Joi.string().valid('blog', 'social', 'website', 'email', 'landing_page'),
  overrides: Joi.object({
    type: Joi.string().valid('blog', 'social', 'website', 'email', 'landing_page').required(),
    topic: Joi.string().required(),
    target_audience: Joi.alternatives().try(Joi.string(), Joi.object()),
    keywords: Joi.array().items(Joi.string())
  }),
  userId: Joi.string()
}));

exports.editContent = validate(Joi.object({
  contentId: Joi.string().required(),
  changes: Joi.string().when('feedback', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  feedback: Joi.string().when('changes', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  userId: Joi.string()
}));

exports.generateHeadlines = validate(Joi.object({
  topic: Joi.string().required(),
  count: Joi.number().integer().min(1).max(20).default(5),
  type: Joi.string().valid('blog', 'social', 'website', 'email', 'cta').default('blog'),
  targetAudience: Joi.string(),
  userId: Joi.string()
}));

/**
 * Content Management Agent schemas
 */
exports.categorizeContent = validate(Joi.object({
  contentId: Joi.string().required(),
  manualCategories: Joi.array().items(Joi.string()),
  userId: Joi.string()
}));

exports.scheduleContent = validate(Joi.object({
  contentId: Joi.string().required(),
  publishDate: Joi.date().iso().greater('now').required(),
  platform: Joi.string().required(),
  status: Joi.string().valid('scheduled', 'draft').default('scheduled'),
  userId: Joi.string()
}));

exports.checkFreshness = validate(Joi.object({
  contentIds: Joi.array().items(Joi.string()),
  thresholdDays: Joi.number().integer().min(1).default(90),
  userId: Joi.string()
}));

/**
 * Optimisation Agent schemas
 */
exports.analyzePerformance = validate(Joi.object({
  contentId: Joi.string(),
  metrics: Joi.object(),
  timeframe: Joi.string().valid('day', 'week', 'month', 'quarter', 'year').default('month'),
  userId: Joi.string()
}));

exports.generateSeoRecommendations = validate(Joi.object({
  contentId: Joi.string().required(),
  keywords: Joi.array().items(Joi.string()),
  userId: Joi.string()
}));

exports.generateAbTesting = validate(Joi.object({
  contentId: Joi.string().required(),
  elements: Joi.array().items(Joi.string()).default(['headline', 'cta', 'hero_image']),
  userId: Joi.string()
}));

/**
 * Brand Consistency Agent schemas
 */
exports.reviewContent = validate(Joi.object({
  contentId: Joi.string().required(),
  checkLevel: Joi.string().valid('basic', 'normal', 'strict').default('normal'),
  userId: Joi.string()
}));

exports.fixConsistencyIssues = validate(Joi.object({
  contentId: Joi.string().required(),
  issues: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    rule: Joi.string(),
    matches: Joi.array().items(Joi.string())
  })),
  userId: Joi.string()
}));

exports.updateGuidelines = validate(Joi.object({
  type: Joi.string().valid('voice', 'tone', 'messaging', 'values', 'terminology').required(),
  content: Joi.string().required(),
  updateBy: Joi.string()
}));

/**
 * Content schemas
 */
exports.createContent = validate(Joi.object({
  type: Joi.string().valid('blog', 'social', 'website', 'email', 'landing_page').required(),
  title: Joi.string().required(),
  content: Joi.alternatives().try(
    Joi.string(),
    Joi.object()
  ).required(),
  meta_description: Joi.string(),
  keywords: Joi.array().items(Joi.string()),
  categories: Joi.array().items(Joi.string()),
  status: Joi.string().valid('draft', 'pending_review', 'approved', 'published').default('draft'),
  userId: Joi.string()
}));

exports.updateContent = validate(Joi.object({
  title: Joi.string(),
  content: Joi.alternatives().try(
    Joi.string(),
    Joi.object()
  ),
  meta_description: Joi.string(),
  keywords: Joi.array().items(Joi.string()),
  categories: Joi.array().items(Joi.string()),
  status: Joi.string().valid('draft', 'pending_review', 'approved', 'published'),
  userId: Joi.string()
}));