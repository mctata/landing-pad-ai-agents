/**
 * Security Middleware
 * Enhanced security measures for API endpoints
 * Includes CSRF protection, rate limiting, input sanitization, and API key validation
 */

const { randomBytes } = require('crypto');
const csrf = require('csurf');
const xss = require('xss-clean');
// We're using PostgreSQL, but keeping the express-mongo-sanitize package for input sanitization
// as it can help with general SQL injection prevention by removing $ and . characters
const mongoSanitize = require('express-mongo-sanitize');
const { rateLimit } = require('express-rate-limit');
// Use crypto for generating request IDs instead of nanoid (which is an ESM module)
const crypto = require('crypto');
const generateRequestId = () => crypto.randomBytes(8).toString('hex');
const performance = require('perf_hooks').performance;

/**
 * Generate and configure CSRF protection middleware
 * @returns {Function} CSRF protection middleware
 */
exports.csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

/**
 * Set CSRF token cookie and attach to response
 */
exports.setCsrfToken = (req, res, next) => {
  // Skip in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
    return next();
  }
  
  res.cookie('XSRF-TOKEN', req.csrfToken(), {
    httpOnly: false, // Accessible to JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
  
  next();
};

/**
 * Configure content security policy headers
 */
exports.contentSecurityPolicy = (req, res, next) => {
  // Skip in development if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSP === 'true') {
    return next();
  }
  
  // Set CSP headers - adjust based on your application's needs
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.openai.com https://api.anthropic.com;"
  );
  
  next();
};

/**
 * Configure advanced rate limiting for general API access
 * @returns {Function} Rate limiting middleware
 */
exports.advancedRateLimit = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000, // 15 minutes by default
  max: process.env.RATE_LIMIT_MAX || 100, // Max 100 requests per window by default
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many requests, please try again later.',
      code: 'rate_limit_exceeded'
    }
  },
  // Add dynamic skip based on IP address or user role if needed
  skip: (req) => {
    // Example: Skip rate limiting for certain IPs or authenticated admins
    const trustIps = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
    if (trustIps.includes(req.ip)) return true;
    
    // Skip for admin users if user is attached to request
    if (req.user && req.user.roles && req.user.roles.includes('admin')) return true;
    
    return false;
  }
});

/**
 * Authentication rate limiting - more strict limits for authentication endpoints
 * to prevent brute force attacks
 * @returns {Function} Authentication-specific rate limiting middleware
 */
exports.authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 requests per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts, please try again later.',
      code: 'auth_rate_limit_exceeded'
    }
  },
  // Don't skip successful requests - all auth attempts count
  skipSuccessfulRequests: false
});

/**
 * Content generation rate limiting - specialized limits for AI content generation
 * to prevent abuse and control costs
 * @returns {Function} Content generation rate limiting middleware
 */
exports.contentGenerationRateLimit = rateLimit({
  windowMs: process.env.CONTENT_GEN_RATE_LIMIT_WINDOW || 60 * 60 * 1000, // 1 hour by default
  max: process.env.CONTENT_GEN_RATE_LIMIT_MAX || 30, // Max 30 generations per hour by default
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'AI content generation rate limit exceeded. Please try again later.',
      code: 'content_generation_rate_limit_exceeded'
    }
  },
  // Rate limit by user ID or IP
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
  },
  // Skip for specific roles or API keys
  skip: (req) => {
    // Skip for admin users
    if (req.user && req.user.roles && req.user.roles.includes('admin')) return true;
    
    // Skip for API keys with unlimited generation privileges
    if (req.apiKeyInfo && req.apiKeyInfo.scopes.includes('unlimited_generation')) return true;
    
    return false;
  }
});

/**
 * Admin operation rate limiting - restrict admin operations frequency
 * @returns {Function} Admin rate limiting middleware
 */
exports.adminRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Max 100 admin operations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Admin operation rate limit exceeded. Please try again later.',
      code: 'admin_rate_limit_exceeded'
    }
  }
});

/**
 * Input sanitization to prevent NoSQL injection
 */
exports.sanitizeInputs = mongoSanitize();

/**
 * XSS prevention - sanitize inputs to prevent XSS attacks
 */
exports.preventXss = xss();

/**
 * Generate secure random API key
 * @returns {string} Random API key
 */
exports.generateApiKey = () => {
  return randomBytes(32).toString('hex');
};

/**
 * Validate API key
 * @param {Object} options - Options for API key validation
 * @returns {Function} API key validation middleware
 */
exports.validateApiKey = (options = {}) => {
  return async (req, res, next) => {
    // Skip in development if explicitly disabled
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_API_KEY === 'true') {
      return next();
    }
    
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: {
          message: 'API key required',
          code: 'api_key_required'
        }
      });
    }
    
    try {
      // Validate API key against database
      const db = req.app.locals.agentContainer.storage;
      const keyRecord = await db.models.ApiKey.findOne({ 
        where: { key: apiKey, active: true } 
      });
      
      if (!keyRecord) {
        return res.status(401).json({
          error: {
            message: 'Invalid API key',
            code: 'invalid_api_key'
          }
        });
      }
      
      // Check if key has required permissions if specified
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        const hasRequiredScopes = options.requiredScopes.every(scope => 
          keyRecord.scopes.includes(scope)
        );
        
        if (!hasRequiredScopes) {
          return res.status(403).json({
            error: {
              message: 'API key does not have required permissions',
              code: 'insufficient_permissions'
            }
          });
        }
      }
      
      // Update last used timestamp
      await db.models.ApiKey.updateLastUsed(keyRecord.keyId);
      
      // Attach API key info to request
      req.apiKeyInfo = {
        id: keyRecord.keyId,
        owner: keyRecord.userId,
        scopes: keyRecord.scopes
      };
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Performance monitoring middleware
 * Tracks API endpoint performance and attaches metrics to requests
 */
exports.performanceMonitoring = (req, res, next) => {
  // Skip if performance monitoring is disabled
  if (process.env.DISABLE_PERFORMANCE_MONITORING === 'true') {
    return next();
  }
  
  // Generate unique request ID if not already present
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);
  
  // Initialize performance tracking
  req.performanceMetrics = {
    requestId: req.requestId,
    startTime: performance.now(),
    endTime: null,
    duration: null,
    route: req.originalUrl,
    method: req.method,
    userId: req.user?.id || 'anonymous',
    apiKeyId: req.apiKeyInfo?.id,
    completed: false
  };
  
  // Track response metrics when the response is sent
  const originalEnd = res.end;
  res.end = function(...args) {
    // Calculate performance metrics
    req.performanceMetrics.endTime = performance.now();
    req.performanceMetrics.duration = req.performanceMetrics.endTime - req.performanceMetrics.startTime;
    req.performanceMetrics.statusCode = res.statusCode;
    req.performanceMetrics.completed = true;
    
    // Add metrics to response headers
    res.setHeader('X-Response-Time', `${req.performanceMetrics.duration.toFixed(2)}ms`);
    
    // Log performance metrics for high-latency requests only (to avoid flooding logs)
    const highLatency = 500; // 500ms threshold
    if (req.performanceMetrics.duration > highLatency && req.app.locals.agentContainer) {
      req.app.locals.agentContainer.logger.warn('High latency request', {
        performanceMetrics: req.performanceMetrics,
        threshold: highLatency
      });
    }
    
    // Send metrics to monitoring system if one is configured
    if (req.app.locals.agentContainer && 
        req.app.locals.agentContainer.services && 
        req.app.locals.agentContainer.services.monitoring) {
      req.app.locals.agentContainer.services.monitoring.recordMetric('api_request', req.performanceMetrics);
    }
    
    // Call the original end method
    return originalEnd.apply(this, args);
  };
  
  next();
};

/**
 * Add security headers to all responses
 */
exports.securityHeaders = (req, res, next) => {
  // Add strict security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS - Only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};