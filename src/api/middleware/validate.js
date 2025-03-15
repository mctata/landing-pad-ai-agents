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
    const { error, value } = schema.validate(req[source], { 
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown keys from the validated data
      allowUnknown: false // Don't allow unknown keys in the input data
    });
    
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

/**
 * Validate parameters and body
 * @param {Object} paramsSchema - Joi schema for request parameters
 * @param {Object} bodySchema - Joi schema for request body
 * @returns {Function} - Combined validation middleware
 */
const validateParamsAndBody = (paramsSchema, bodySchema) => {
  return (req, res, next) => {
    // First validate params
    const paramsResult = paramsSchema.validate(req.params, { abortEarly: false });
    
    if (paramsResult.error) {
      const errorMessage = paramsResult.error.details.map(detail => detail.message).join(', ');
      
      return res.status(400).json({
        error: {
          message: 'Path parameter validation failed',
          details: errorMessage,
          code: 'validation_error'
        }
      });
    }
    
    // Then validate body
    const bodyResult = bodySchema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true
    });
    
    if (bodyResult.error) {
      const errorMessage = bodyResult.error.details.map(detail => detail.message).join(', ');
      
      return res.status(400).json({
        error: {
          message: 'Request body validation failed',
          details: errorMessage,
          code: 'validation_error'
        }
      });
    }
    
    // Update with validated data
    req.params = paramsResult.value;
    req.body = bodyResult.value;
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
  changes: Joi.string(),
  feedback: Joi.string(),
  userId: Joi.string()
}).or('changes', 'feedback'));

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

/**
 * Integration schemas
 */

// CMS integrations
exports.publishToCms = validateParamsAndBody(
  // Params schema
  Joi.object({
    platform: Joi.string().valid('contentful', 'wordpress', 'shopify').required()
  }),
  // Body schema
  Joi.object({
    contentId: Joi.string(),
    content: Joi.object({
      title: Joi.string().required(),
      content: Joi.alternatives().try(
        Joi.string(),
        Joi.object({
          body: Joi.string().required(),
          format: Joi.string().valid('html', 'markdown', 'plain').default('html')
        })
      ).required(),
      meta_description: Joi.string(),
      keywords: Joi.array().items(Joi.string()),
      type: Joi.string().valid('blog', 'article', 'page', 'product', 'landing_page').required(),
      categories: Joi.array().items(Joi.string()),
      featured_image: Joi.object({
        url: Joi.string().uri(),
        alt: Joi.string(),
        id: Joi.string()
      }),
      seo: Joi.object({
        title: Joi.string(),
        description: Joi.string(),
        keywords: Joi.array().items(Joi.string())
      })
    }),
    publish: Joi.boolean().default(true),
    options: Joi.object()
  })
);

exports.updateOnCms = validateParamsAndBody(
  // Params schema
  Joi.object({
    platform: Joi.string().valid('contentful', 'wordpress', 'shopify').required(),
    externalId: Joi.string().required()
  }),
  // Body schema
  Joi.object({
    title: Joi.string(),
    content: Joi.alternatives().try(
      Joi.string(),
      Joi.object({
        body: Joi.string().required(),
        format: Joi.string().valid('html', 'markdown', 'plain').default('html')
      })
    ),
    meta_description: Joi.string(),
    keywords: Joi.array().items(Joi.string()),
    categories: Joi.array().items(Joi.string()),
    featured_image: Joi.object({
      url: Joi.string().uri(),
      alt: Joi.string(),
      id: Joi.string()
    }),
    seo: Joi.object({
      title: Joi.string(),
      description: Joi.string(),
      keywords: Joi.array().items(Joi.string())
    }),
    publish: Joi.boolean().default(true),
    options: Joi.object()
  })
);

exports.importFromCms = validateParamsAndBody(
  // Params schema
  Joi.object({
    platform: Joi.string().valid('contentful', 'wordpress', 'shopify').required()
  }),
  // Body schema
  Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    contentType: Joi.string(),
    filter: Joi.object(),
    since: Joi.date().iso(),
    options: Joi.object()
  })
);

// Social media integrations
exports.postToSocial = validateParamsAndBody(
  // Params schema
  Joi.object({
    platform: Joi.string().valid('twitter', 'facebook', 'linkedin', 'instagram', 'bluesky').required()
  }),
  // Body schema
  Joi.object({
    contentId: Joi.string(),
    content: Joi.object({
      text: Joi.string().required(),
      media: Joi.array().items(
        Joi.object({
          type: Joi.string().valid('image', 'video').required(),
          url: Joi.string().uri().required(),
          alt: Joi.string()
        })
      ),
      link: Joi.string().uri()
    }),
    isThread: Joi.boolean().default(false),
    threadItems: Joi.array().items(
      Joi.object({
        text: Joi.string().required(),
        media: Joi.array().items(
          Joi.object({
            type: Joi.string().valid('image', 'video').required(),
            url: Joi.string().uri().required(),
            alt: Joi.string()
          })
        )
      })
    ).when('isThread', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    options: Joi.object()
  })
);

// Analytics integrations
exports.getPageAnalytics = validate(
  Joi.object({
    url: Joi.string().uri().required(),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
    metrics: Joi.array().items(Joi.string()),
    dimensions: Joi.array().items(Joi.string())
  }),
  'query'
);

exports.getTopContent = validate(
  Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(10),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
    metrics: Joi.array().items(Joi.string()).default(['pageviews']),
    contentType: Joi.string()
  }),
  'query'
);

exports.getSiteMetrics = validate(
  Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')),
    metrics: Joi.array().items(Joi.string()).default(['pageviews', 'users', 'bounceRate', 'avgSessionDuration']),
    dimensions: Joi.array().items(Joi.string())
  }),
  'query'
);