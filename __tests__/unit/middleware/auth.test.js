/**
 * Unit tests for Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const { 
  authenticate, 
  generateTokens, 
  refreshToken, 
  requireAdmin, 
  requirePermission,
  checkPasswordChangeRequired,
  require2FA
} = require('../../../src/api/middleware/auth');
const User = require('../../../src/models/userModel');

// Mock User model
jest.mock('../../../src/models/userModel');

describe('Authentication Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock request, response, and next function
    req = {
      headers: {},
      session: {},
      user: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();

    // Set environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_EXPIRY = '3600';
    process.env.JWT_REFRESH_EXPIRY = '86400';
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', () => {
      // Arrange
      const user = {
        _id: 'user-id-123',
        userId: 'USER-123',
        email: 'test@example.com',
        roles: ['writer'],
        permissions: ['content:write'],
        firstName: 'Test',
        lastName: 'User'
      };
      
      // Mock jwt.sign
      jwt.sign = jest.fn()
        .mockReturnValueOnce('mocked-access-token')
        .mockReturnValueOnce('mocked-refresh-token');
      
      // Act
      const tokens = generateTokens(user);
      
      // Assert
      expect(tokens.accessToken).toBe('mocked-access-token');
      expect(tokens.refreshToken).toBe('mocked-refresh-token');
      
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      
      // Verify access token payload
      expect(jwt.sign).toHaveBeenNthCalledWith(
        1,
        {
          id: 'user-id-123',
          userId: 'USER-123',
          email: 'test@example.com',
          roles: ['writer'],
          permissions: ['content:write'],
          firstName: 'Test',
          lastName: 'User'
        },
        'test-jwt-secret',
        { expiresIn: '3600' }
      );
      
      // Verify refresh token payload
      expect(jwt.sign).toHaveBeenNthCalledWith(
        2,
        {
          id: 'user-id-123',
          userId: 'USER-123',
          tokenType: 'refresh'
        },
        'test-refresh-secret',
        { expiresIn: '86400' }
      );
    });
  });

  describe('authenticate', () => {
    it('should authenticate a valid token', async () => {
      // Arrange
      const decodedToken = {
        id: 'user-id-123',
        userId: 'USER-123',
        email: 'test@example.com',
        roles: ['writer'],
        iat: Math.floor(Date.now() / 1000) - 1000, // 1000 seconds ago
        exp: Math.floor(Date.now() / 1000) + 2000  // 2000 seconds in future
      };
      
      req.headers.authorization = 'Bearer valid-token';
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        userId: 'USER-123',
        email: 'test@example.com',
        roles: ['writer'],
        permissions: ['content:write'],
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        isLocked: jest.fn().mockReturnValue(false),
        changedPasswordAfter: jest.fn().mockReturnValue(false),
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
      expect(User.findById).toHaveBeenCalledWith('user-id-123');
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user-id-123');
      expect(req.user.userId).toBe('USER-123');
      expect(mockUser.updateActivity).toHaveBeenCalled();
    });

    it('should reject when no token is provided', async () => {
      // Arrange
      req.headers.authorization = undefined;
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication required',
          code: 'auth_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject an expired token', async () => {
      // Arrange
      req.headers.authorization = 'Bearer expired-token';
      
      // Mock jwt.verify to throw TokenExpiredError
      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication token expired',
          code: 'token_expired'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not found', async () => {
      // Arrange
      const decodedToken = {
        id: 'nonexistent-user-id',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 2000
      };
      
      req.headers.authorization = 'Bearer valid-token';
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById to return null (user not found)
      User.findById.mockResolvedValue(null);
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'User not found',
          code: 'user_not_found'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when account is locked', async () => {
      // Arrange
      const decodedToken = {
        id: 'user-id-123',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 2000
      };
      
      req.headers.authorization = 'Bearer valid-token';
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        status: 'active',
        isLocked: jest.fn().mockReturnValue(true),
        changedPasswordAfter: jest.fn().mockReturnValue(false),
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Account is locked due to too many failed login attempts',
          code: 'account_locked'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when account is inactive', async () => {
      // Arrange
      const decodedToken = {
        id: 'user-id-123',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 2000
      };
      
      req.headers.authorization = 'Bearer valid-token';
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        status: 'suspended',
        isLocked: jest.fn().mockReturnValue(false),
        changedPasswordAfter: jest.fn().mockReturnValue(false),
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Account is not active',
          code: 'account_inactive'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when password was changed after token issuance', async () => {
      // Arrange
      const decodedToken = {
        id: 'user-id-123',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 2000
      };
      
      req.headers.authorization = 'Bearer valid-token';
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        status: 'active',
        isLocked: jest.fn().mockReturnValue(false),
        changedPasswordAfter: jest.fn().mockReturnValue(true), // Password changed after token issued
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Password has been changed, please log in again',
          code: 'password_changed'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should refresh token when near expiration', async () => {
      // Arrange
      const currentTime = Math.floor(Date.now() / 1000);
      const decodedToken = {
        id: 'user-id-123',
        userId: 'USER-123',
        email: 'test@example.com',
        roles: ['writer'],
        iat: currentTime - 3000,
        exp: currentTime + 200 // Less than 5 minutes remaining
      };
      
      req.headers.authorization = 'Bearer almost-expired-token';
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        userId: 'USER-123',
        email: 'test@example.com',
        roles: ['writer'],
        permissions: ['content:write'],
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        isLocked: jest.fn().mockReturnValue(false),
        changedPasswordAfter: jest.fn().mockReturnValue(false),
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Create a mock function for generateTokens
      const mockGenerateTokens = jest.spyOn(require('../../../src/api/middleware/auth'), 'generateTokens')
        .mockReturnValue({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token'
        });
      
      // Act
      await authenticate(req, res, next);
      
      // Assert
      expect(res.set).toHaveBeenCalledWith('X-New-Access-Token', 'new-access-token');
      expect(res.set).toHaveBeenCalledWith('X-New-Refresh-Token', 'new-refresh-token');
      expect(res.set).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'X-New-Access-Token, X-New-Refresh-Token'
      );
      expect(next).toHaveBeenCalled();
      
      // Restore original function
      mockGenerateTokens.mockRestore();
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens with a valid refresh token', async () => {
      // Arrange
      req.body = { refreshToken: 'valid-refresh-token' };
      
      const decodedToken = {
        id: 'user-id-123',
        userId: 'USER-123',
        tokenType: 'refresh',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 86400
      };
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        userId: 'USER-123',
        email: 'test@example.com',
        roles: ['writer'],
        permissions: ['content:write'],
        firstName: 'Test',
        lastName: 'User',
        status: 'active',
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Create a mock function for generateTokens
      const mockGenerateTokens = jest.spyOn(require('../../../src/api/middleware/auth'), 'generateTokens')
        .mockReturnValue({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token'
        });
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(
        'valid-refresh-token',
        'test-refresh-secret'
      );
      expect(User.findById).toHaveBeenCalledWith('user-id-123');
      expect(res.json).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      });
      
      // Restore original function
      mockGenerateTokens.mockRestore();
    });

    it('should reject when no refresh token is provided', async () => {
      // Arrange
      req.body = {};
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Refresh token is required',
          code: 'refresh_token_required'
        }
      });
    });

    it('should reject an invalid refresh token', async () => {
      // Arrange
      req.body = { refreshToken: 'invalid-refresh-token' };
      
      // Mock jwt.verify to throw error
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid refresh token',
          code: 'invalid_refresh_token'
        }
      });
    });

    it('should reject when token is not a refresh token', async () => {
      // Arrange
      req.body = { refreshToken: 'access-token-not-refresh' };
      
      const decodedToken = {
        id: 'user-id-123',
        // Missing tokenType: 'refresh'
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 86400
      };
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid refresh token',
          code: 'invalid_refresh_token'
        }
      });
    });

    it('should reject when user is not found', async () => {
      // Arrange
      req.body = { refreshToken: 'valid-refresh-token' };
      
      const decodedToken = {
        id: 'nonexistent-user-id',
        tokenType: 'refresh',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 86400
      };
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById to return null
      User.findById.mockResolvedValue(null);
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'User not found',
          code: 'user_not_found'
        }
      });
    });

    it('should reject when account is not active', async () => {
      // Arrange
      req.body = { refreshToken: 'valid-refresh-token' };
      
      const decodedToken = {
        id: 'user-id-123',
        tokenType: 'refresh',
        iat: Math.floor(Date.now() / 1000) - 1000,
        exp: Math.floor(Date.now() / 1000) + 86400
      };
      
      // Mock jwt.verify
      jwt.verify = jest.fn().mockReturnValue(decodedToken);
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        status: 'suspended',
        updateActivity: jest.fn().mockResolvedValue(null)
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Account is not active',
          code: 'account_inactive'
        }
      });
    });

    it('should reject an expired refresh token', async () => {
      // Arrange
      req.body = { refreshToken: 'expired-refresh-token' };
      
      // Mock jwt.verify to throw TokenExpiredError
      jwt.verify = jest.fn().mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });
      
      // Act
      await refreshToken(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Refresh token expired, please log in again',
          code: 'refresh_token_expired'
        }
      });
    });
  });

  describe('requireAdmin', () => {
    it('should allow access to admin users', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        roles: ['admin']
      };
      
      // Act
      requireAdmin(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should reject when user is not an admin', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        roles: ['writer']
      };
      
      // Act
      requireAdmin(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Administrator privileges required',
          code: 'admin_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not authenticated', () => {
      // Arrange
      req.user = null;
      
      // Act
      requireAdmin(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication required',
          code: 'auth_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should allow access when user has required permission', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        roles: ['writer'],
        permissions: ['content:write', 'content:read']
      };
      
      const middleware = requirePermission('content:write');
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should allow access when user is admin (regardless of permissions)', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        roles: ['admin'],
        permissions: [] // No explicit permissions
      };
      
      const middleware = requirePermission('content:write');
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should reject when user lacks required permission', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        roles: ['writer'],
        permissions: ['content:read'] // Missing 'content:write'
      };
      
      const middleware = requirePermission('content:write');
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: `Permission 'content:write' required`,
          code: 'permission_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not authenticated', () => {
      // Arrange
      req.user = null;
      
      const middleware = requirePermission('content:write');
      
      // Act
      middleware(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication required',
          code: 'auth_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkPasswordChangeRequired', () => {
    it('should allow access when password change is not required', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        requiresPasswordChange: false
      };
      
      // Act
      checkPasswordChangeRequired(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should reject when password change is required', () => {
      // Arrange
      req.user = {
        id: 'user-id-123',
        requiresPasswordChange: true
      };
      
      // Act
      checkPasswordChangeRequired(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Password change required before proceeding',
          code: 'password_change_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not authenticated', () => {
      // Arrange
      req.user = null;
      
      // Act
      checkPasswordChangeRequired(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication required',
          code: 'auth_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('require2FA', () => {
    it('should allow access when 2FA is verified', async () => {
      // Arrange
      req.user = {
        id: 'user-id-123'
      };
      
      req.session = {
        twoFactorVerified: true
      };
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        twoFactorEnabled: true
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await require2FA(req, res, next);
      
      // Assert
      expect(User.findById).toHaveBeenCalledWith('user-id-123');
      expect(next).toHaveBeenCalled();
    });

    it('should allow access when 2FA is not enabled for user', async () => {
      // Arrange
      req.user = {
        id: 'user-id-123'
      };
      
      req.session = {}; // No 2FA verification
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        twoFactorEnabled: false // 2FA not enabled
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await require2FA(req, res, next);
      
      // Assert
      expect(User.findById).toHaveBeenCalledWith('user-id-123');
      expect(next).toHaveBeenCalled();
    });

    it('should reject when 2FA is required but not verified', async () => {
      // Arrange
      req.user = {
        id: 'user-id-123'
      };
      
      req.session = {}; // No 2FA verification
      
      // Mock User.findById
      const mockUser = {
        _id: 'user-id-123',
        twoFactorEnabled: true // 2FA enabled
      };
      
      User.findById.mockResolvedValue(mockUser);
      
      // Act
      await require2FA(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Two-factor authentication required',
          code: 'two_factor_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not found', async () => {
      // Arrange
      req.user = {
        id: 'nonexistent-user-id'
      };
      
      // Mock User.findById to return null
      User.findById.mockResolvedValue(null);
      
      // Act
      await require2FA(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'User not found',
          code: 'user_not_found'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject when user is not authenticated', async () => {
      // Arrange
      req.user = null;
      
      // Act
      await require2FA(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Authentication required',
          code: 'auth_required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});