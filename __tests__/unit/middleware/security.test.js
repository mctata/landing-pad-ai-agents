/**
 * Unit tests for Security Middleware
 */

const {
  csrfProtection,
  setCsrfToken,
  contentSecurityPolicy,
  advancedRateLimit,
  sanitizeInputs,
  preventXss,
  generateApiKey,
  validateApiKey
} = require('../../../src/api/middleware/security');

// Mock required dependencies
jest.mock('csurf', () => jest.fn(() => jest.fn((req, res, next) => next())));
jest.mock('xss-clean', () => jest.fn(() => jest.fn((req, res, next) => next())));
jest.mock('express-mongo-sanitize', () => jest.fn(() => jest.fn((req, res, next) => next())));
jest.mock('express-rate-limit', () => ({
  rateLimit: jest.fn(() => jest.fn((req, res, next) => next()))
}));

describe('Security Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock request, response, and next function
    req = {
      headers: {},
      body: {},
      csrfToken: jest.fn().mockReturnValue('mocked-csrf-token'),
      ip: '127.0.0.1',
      app: {
        locals: {
          agentContainer: {
            storage: {
              models: {
                ApiKey: {
                  findOne: jest.fn()
                }
              }
            }
          }
        }
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      cookie: jest.fn()
    };
    
    next = jest.fn();

    // Set environment variables
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_WINDOW = '900000'; // 15 minutes
    process.env.RATE_LIMIT_MAX = '100';
    process.env.TRUSTED_IPS = '127.0.0.1,192.168.1.1';
  });

  describe('CSRF Protection', () => {
    it('should configure csurf middleware with secure options', () => {
      // Assert
      expect(csrfProtection).toBeDefined();
      
      // Verify csrf configuration from mock
      const csurfMock = require('csurf');
      expect(csurfMock).toHaveBeenCalledWith({
        cookie: {
          httpOnly: true,
          secure: true, // NODE_ENV is 'production'
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
      });
    });

    it('should set CSRF token cookie', () => {
      // Act
      setCsrfToken(req, res, next);
      
      // Assert
      expect(req.csrfToken).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('XSRF-TOKEN', 'mocked-csrf-token', {
        httpOnly: false,
        secure: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });
      expect(next).toHaveBeenCalled();
    });

    it('should skip CSRF protection in development if disabled', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      process.env.DISABLE_CSRF = 'true';
      
      // Act
      setCsrfToken(req, res, next);
      
      // Assert
      expect(req.csrfToken).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Content Security Policy', () => {
    it('should set CSP headers in production', () => {
      // Act
      contentSecurityPolicy(req, res, next);
      
      // Assert
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        expect.stringContaining("default-src 'self'")
      );
      expect(next).toHaveBeenCalled();
    });

    it('should skip CSP headers in development if disabled', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      process.env.DISABLE_CSP = 'true';
      
      // Act
      contentSecurityPolicy(req, res, next);
      
      // Assert
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    const { rateLimit } = require('express-rate-limit');

    it('should configure rate limiting with correct options', () => {
      // Assert
      expect(advancedRateLimit).toBeDefined();
      
      // Verify rate limit configuration
      expect(rateLimit).toHaveBeenCalledWith({
        windowMs: 900000, // 15 minutes
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: {
            message: 'Too many requests, please try again later.',
            code: 'rate_limit_exceeded'
          }
        },
        skip: expect.any(Function)
      });
    });

    it('should skip rate limiting for trusted IPs', () => {
      // Get the skip function from the rate limit config
      const skipFn = rateLimit.mock.calls[0][0].skip;
      
      // Test with trusted IP
      const result = skipFn({ ip: '127.0.0.1' });
      
      // Assert
      expect(result).toBe(true);
    });

    it('should skip rate limiting for admin users', () => {
      // Get the skip function from the rate limit config
      const skipFn = rateLimit.mock.calls[0][0].skip;
      
      // Test with admin user
      const result = skipFn({ 
        ip: '1.2.3.4', // Not in trusted IPs
        user: {
          roles: ['admin']
        }
      });
      
      // Assert
      expect(result).toBe(true);
    });

    it('should not skip rate limiting for regular users', () => {
      // Get the skip function from the rate limit config
      const skipFn = rateLimit.mock.calls[0][0].skip;
      
      // Test with regular user
      const result = skipFn({ 
        ip: '1.2.3.4', // Not in trusted IPs
        user: {
          roles: ['writer']
        }
      });
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Input Sanitization', () => {
    it('should configure mongo sanitize middleware', () => {
      // Assert
      expect(sanitizeInputs).toBeDefined();
      
      // Verify mongo sanitize configuration
      const mongoSanitize = require('express-mongo-sanitize');
      expect(mongoSanitize).toHaveBeenCalled();
    });
  });

  describe('XSS Prevention', () => {
    it('should configure XSS prevention middleware', () => {
      // Assert
      expect(preventXss).toBeDefined();
      
      // Verify XSS configuration
      const xss = require('xss-clean');
      expect(xss).toHaveBeenCalled();
    });
  });

  describe('API Key Management', () => {
    it('should generate a secure API key', () => {
      // Arrange
      const crypto = require('crypto');
      const mockRandomBytes = jest.spyOn(crypto, 'randomBytes')
        .mockImplementation(() => ({
          toString: () => 'mocked-api-key'
        }));
      
      // Act
      const apiKey = generateApiKey();
      
      // Assert
      expect(apiKey).toBe('mocked-api-key');
      expect(mockRandomBytes).toHaveBeenCalledWith(32);
      
      // Cleanup
      mockRandomBytes.mockRestore();
    });

    describe('validateApiKey middleware', () => {
      it('should pass validation with valid API key', async () => {
        // Arrange
        req.headers['x-api-key'] = 'valid-api-key';
        
        // Mock database response
        const mockKeyRecord = {
          _id: 'key-id',
          key: 'valid-api-key',
          owner: 'user-id',
          active: true,
          scopes: ['agents:read', 'content:read']
        };
        
        req.app.locals.agentContainer.storage.models.ApiKey.findOne.mockResolvedValue(mockKeyRecord);
        
        const middleware = validateApiKey();
        
        // Act
        await middleware(req, res, next);
        
        // Assert
        expect(req.app.locals.agentContainer.storage.models.ApiKey.findOne).toHaveBeenCalledWith({
          key: 'valid-api-key',
          active: true
        });
        expect(req.apiKeyInfo).toEqual({
          id: 'key-id',
          owner: 'user-id',
          scopes: ['agents:read', 'content:read']
        });
        expect(next).toHaveBeenCalled();
      });

      it('should reject when no API key is provided', async () => {
        // Arrange
        req.headers['x-api-key'] = undefined;
        
        const middleware = validateApiKey();
        
        // Act
        await middleware(req, res, next);
        
        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: {
            message: 'API key required',
            code: 'api_key_required'
          }
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject invalid API key', async () => {
        // Arrange
        req.headers['x-api-key'] = 'invalid-api-key';
        
        // Mock database response (key not found)
        req.app.locals.agentContainer.storage.models.ApiKey.findOne.mockResolvedValue(null);
        
        const middleware = validateApiKey();
        
        // Act
        await middleware(req, res, next);
        
        // Assert
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          error: {
            message: 'Invalid API key',
            code: 'invalid_api_key'
          }
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should reject when API key lacks required permissions', async () => {
        // Arrange
        req.headers['x-api-key'] = 'valid-api-key';
        
        // Mock database response
        const mockKeyRecord = {
          _id: 'key-id',
          key: 'valid-api-key',
          owner: 'user-id',
          active: true,
          scopes: ['agents:read'] // Missing content:write
        };
        
        req.app.locals.agentContainer.storage.models.ApiKey.findOne.mockResolvedValue(mockKeyRecord);
        
        const middleware = validateApiKey({ requiredScopes: ['content:write'] });
        
        // Act
        await middleware(req, res, next);
        
        // Assert
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
          error: {
            message: 'API key does not have required permissions',
            code: 'insufficient_permissions'
          }
        });
        expect(next).not.toHaveBeenCalled();
      });

      it('should skip API key validation in development if disabled', async () => {
        // Arrange
        process.env.NODE_ENV = 'development';
        process.env.DISABLE_API_KEY = 'true';
        
        req.headers['x-api-key'] = undefined;
        
        const middleware = validateApiKey();
        
        // Act
        await middleware(req, res, next);
        
        // Assert
        expect(req.app.locals.agentContainer.storage.models.ApiKey.findOne).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
        // Arrange
        req.headers['x-api-key'] = 'valid-api-key';
        
        // Mock database error
        const dbError = new Error('Database error');
        req.app.locals.agentContainer.storage.models.ApiKey.findOne.mockRejectedValue(dbError);
        
        const middleware = validateApiKey();
        
        // Act
        await middleware(req, res, next);
        
        // Assert
        expect(next).toHaveBeenCalledWith(dbError);
      });
    });
  });
});