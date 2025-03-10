/**
 * Authentication Middleware
 * Handles authentication and authorization for API endpoints
 */

const jwt = require('jsonwebtoken');

/**
 * Authenticate API requests using JWT
 */
exports.authenticate = (req, res, next) => {
  // Skip authentication for development or if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
    return next();
  }
  
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: {
        message: 'Authentication required',
        code: 'auth_required'
      }
    });
  }
  
  try {
    // Verify token
    const user = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request
    req.user = user;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Authentication token expired',
          code: 'token_expired'
        }
      });
    }
    
    return res.status(401).json({
      error: {
        message: 'Invalid authentication token',
        code: 'invalid_token'
      }
    });
  }
};

/**
 * Check for admin role
 */
exports.requireAdmin = (req, res, next) => {
  // Skip role check for development or if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
    return next();
  }
  
  if (!req.user) {
    return res.status(401).json({
      error: {
        message: 'Authentication required',
        code: 'auth_required'
      }
    });
  }
  
  if (!req.user.roles || !req.user.roles.includes('admin')) {
    return res.status(403).json({
      error: {
        message: 'Administrator privileges required',
        code: 'admin_required'
      }
    });
  }
  
  next();
};

/**
 * Check for specific permission
 * @param {string} permission - Required permission
 */
exports.requirePermission = (permission) => {
  return (req, res, next) => {
    // Skip permission check for development or if explicitly disabled
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_AUTH === 'true') {
      return next();
    }
    
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'auth_required'
        }
      });
    }
    
    // Admin role has all permissions
    if (req.user.roles && req.user.roles.includes('admin')) {
      return next();
    }
    
    // Check for specific permission
    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: {
          message: `Permission '${permission}' required`,
          code: 'permission_required'
        }
      });
    }
    
    next();
  };
};