/**
 * Authentication Middleware
 * Handles authentication and authorization for API endpoints
 * Enhanced with token refresh, account locking, and password validation
 */

const jwt = require('jsonwebtoken');
const User = require('../../models/userModel');

/**
 * Generate access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object containing access and refresh tokens
 */
exports.generateTokens = (user) => {
  // Generate access token
  const accessToken = jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      firstName: user.firstName,
      lastName: user.lastName
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );
  
  // Generate refresh token with longer expiration
  const refreshToken = jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      tokenType: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
  
  return { accessToken, refreshToken };
};

/**
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: {
        message: 'Refresh token is required',
        code: 'refresh_token_required'
      }
    });
  }
  
  try {
    // Verify refresh token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
    
    // Ensure it's actually a refresh token
    if (!decoded.tokenType || decoded.tokenType !== 'refresh') {
      return res.status(401).json({
        error: {
          message: 'Invalid refresh token',
          code: 'invalid_refresh_token'
        }
      });
    }
    
    // Get user from database
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'User not found',
          code: 'user_not_found'
        }
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: {
          message: 'Account is not active',
          code: 'account_inactive'
        }
      });
    }
    
    // Generate new tokens
    const tokens = exports.generateTokens(user);
    
    // Update user's last activity
    await user.updateActivity();
    
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: parseInt(process.env.JWT_EXPIRY) || 3600
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: {
          message: 'Refresh token expired, please log in again',
          code: 'refresh_token_expired'
        }
      });
    }
    
    return res.status(401).json({
      error: {
        message: 'Invalid refresh token',
        code: 'invalid_refresh_token'
      }
    });
  }
};

/**
 * Authenticate API requests using JWT
 */
exports.authenticate = async (req, res, next) => {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token has refresh type (which shouldn't be used for API access)
    if (decoded.tokenType === 'refresh') {
      return res.status(401).json({
        error: {
          message: 'Invalid token type for API access',
          code: 'invalid_token_type'
        }
      });
    }
    
    // Get user from database to verify account status
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'User not found',
          code: 'user_not_found'
        }
      });
    }
    
    // Check if user account is locked
    if (user.isLocked()) {
      return res.status(403).json({
        error: {
          message: 'Account is locked due to too many failed login attempts',
          code: 'account_locked'
        }
      });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        error: {
          message: 'Account is not active',
          code: 'account_inactive'
        }
      });
    }
    
    // Check if password was changed after token was issued
    const tokenIssuedAt = decoded.iat;
    if (user.changedPasswordAfter(tokenIssuedAt)) {
      return res.status(401).json({
        error: {
          message: 'Password has been changed, please log in again',
          code: 'password_changed'
        }
      });
    }
    
    // Check if token is near expiration and should be proactively refreshed
    // (e.g., if token has less than 5 minutes of validity left)
    const tokenExp = decoded.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = tokenExp - currentTime;
    const refreshThreshold = 300; // 5 minutes in seconds
    
    if (timeUntilExpiry < refreshThreshold) {
      // Generate new tokens if near expiration (attached to response headers)
      const tokens = exports.generateTokens(user);
      
      res.set('X-New-Access-Token', tokens.accessToken);
      res.set('X-New-Refresh-Token', tokens.refreshToken);
      res.set('Access-Control-Expose-Headers', 'X-New-Access-Token, X-New-Refresh-Token');
    }
    
    // Update user's last activity
    await user.updateActivity();
    
    // Attach user to request
    req.user = {
      id: user._id,
      userId: user.userId,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      firstName: user.firstName,
      lastName: user.lastName,
      organization: user.organization,
      requiresPasswordChange: user.requiresPasswordChange
    };
    
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

/**
 * Check if password change is required
 */
exports.checkPasswordChangeRequired = (req, res, next) => {
  // Skip check for development or if explicitly disabled
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
  
  if (req.user.requiresPasswordChange) {
    return res.status(403).json({
      error: {
        message: 'Password change required before proceeding',
        code: 'password_change_required'
      }
    });
  }
  
  next();
};

/**
 * Require 2FA for sensitive operations if enabled
 */
exports.require2FA = async (req, res, next) => {
  // Skip check for development or if explicitly disabled
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_2FA === 'true') {
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
  
  // Get full user object from database
  const user = await User.findById(req.user.id);
  
  if (!user) {
    return res.status(401).json({
      error: {
        message: 'User not found',
        code: 'user_not_found'
      }
    });
  }
  
  // If 2FA is enabled for the user, check for verification
  if (user.twoFactorEnabled) {
    const twoFactorVerified = req.session && req.session.twoFactorVerified;
    
    if (!twoFactorVerified) {
      return res.status(403).json({
        error: {
          message: 'Two-factor authentication required',
          code: 'two_factor_required'
        }
      });
    }
  }
  
  next();
};