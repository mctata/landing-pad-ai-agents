/**
 * Security Middleware
 * Enhanced security measures for API endpoints
 */

const { randomBytes } = require('crypto');
const csrf = require('csurf');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const { rateLimit } = require('express-rate-limit');

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
 * Configure advanced rate limiting
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
      const keyRecord = await db.models.ApiKey.findOne({ key: apiKey, active: true });
      
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
      
      // Attach API key info to request
      req.apiKeyInfo = {
        id: keyRecord._id,
        owner: keyRecord.owner,
        scopes: keyRecord.scopes
      };
      
      next();
    } catch (error) {
      next(error);
    }
  };
};