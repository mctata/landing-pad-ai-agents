/**
 * Integration tests for Authentication API
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { setupApiTest } = require('../../../testing/setupApiTests');
const { authenticate, refreshToken, requireAdmin, requirePermission } = require('../../../src/api/middleware/auth');
const User = require('../../../src/models/userModel');

// Create a test Express app
const app = express();
app.use(express.json());

// Setup routes for testing
app.post('/api/auth/refresh', refreshToken);

app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

app.get('/api/protected', authenticate, (req, res) => {
  res.json({ 
    message: 'Protected endpoint', 
    user: req.user 
  });
});

app.get('/api/admin', authenticate, requireAdmin, (req, res) => {
  res.json({ 
    message: 'Admin endpoint', 
    user: req.user 
  });
});

app.get('/api/permission', authenticate, requirePermission('content:write'), (req, res) => {
  res.json({ 
    message: 'Permission-based endpoint', 
    user: req.user 
  });
});

describe('Authentication API', () => {
  let testUtils;
  let testUser;
  let adminUser;
  let accessToken;
  let refreshTokenString;

  beforeAll(async () => {
    // Setup test environment
    testUtils = await setupApiTest(app);

    // Setup environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_EXPIRY = '3600';
    process.env.JWT_REFRESH_EXPIRY = '86400';
  });

  afterAll(async () => {
    await testUtils.closeApiTest();
  });

  beforeEach(async () => {
    // Clear database before each test
    await testUtils.clearDatabase();

    // Create test users
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    
    // Regular user
    testUser = await User.create({
      userId: 'USER-TEST123',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: hashedPassword,
      roles: ['writer'],
      permissions: ['content:read', 'content:write'],
      status: 'active'
    });

    // Admin user
    adminUser = await User.create({
      userId: 'USER-ADMIN123',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: hashedPassword,
      roles: ['admin'],
      status: 'active'
    });

    // Generate tokens for test user
    accessToken = jwt.sign(
      {
        id: testUser._id,
        userId: testUser.userId,
        email: testUser.email,
        roles: testUser.roles,
        permissions: testUser.permissions
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    refreshTokenString = jwt.sign(
      {
        id: testUser._id,
        userId: testUser.userId,
        tokenType: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY }
    );
  });

  describe('Public vs Protected Endpoints', () => {
    it('should allow access to public endpoints without authentication', async () => {
      const response = await request(app)
        .get('/api/public');
        
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Public endpoint');
    });
    
    it('should deny access to protected endpoints without authentication', async () => {
      const response = await request(app)
        .get('/api/protected');
        
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('auth_required');
    });
    
    it('should allow access to protected endpoints with valid token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);
        
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Protected endpoint');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.userId).toBe('USER-TEST123');
    });

    it('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer invalid-token');
        
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should deny access to admin endpoints for non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${accessToken}`);
        
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('admin_required');
    });
    
    it('should allow access to admin endpoints for admin users', async () => {
      // Generate admin token
      const adminToken = jwt.sign(
        {
          id: adminUser._id,
          userId: adminUser.userId,
          email: adminUser.email,
          roles: adminUser.roles
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY }
      );
      
      const response = await request(app)
        .get('/api/admin')
        .set('Authorization', `Bearer ${adminToken}`);
        
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin endpoint');
    });
  });

  describe('Permission-Based Access Control', () => {
    it('should allow access when user has required permission', async () => {
      const response = await request(app)
        .get('/api/permission')
        .set('Authorization', `Bearer ${accessToken}`);
        
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Permission-based endpoint');
    });
    
    it('should deny access when user lacks required permission', async () => {
      // Create user with limited permissions
      const limitedUser = await User.create({
        userId: 'USER-LIMITED',
        firstName: 'Limited',
        lastName: 'User',
        email: 'limited@example.com',
        password: await bcrypt.hash('Password123!', 10),
        roles: ['viewer'],
        permissions: ['content:read'], // Missing 'content:write'
        status: 'active'
      });
      
      // Generate token for limited user
      const limitedToken = jwt.sign(
        {
          id: limitedUser._id,
          userId: limitedUser.userId,
          email: limitedUser.email,
          roles: limitedUser.roles,
          permissions: limitedUser.permissions
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY }
      );
      
      const response = await request(app)
        .get('/api/permission')
        .set('Authorization', `Bearer ${limitedToken}`);
        
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('permission_required');
    });
  });

  describe('Token Refresh', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: refreshTokenString });
        
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.expiresIn).toBeDefined();
      
      // Verify new access token is valid
      const newAccessToken = response.body.accessToken;
      const payload = jwt.verify(newAccessToken, process.env.JWT_SECRET);
      
      expect(payload.userId).toBe('USER-TEST123');
      expect(payload.id).toBe(testUser._id.toString());
    });
    
    it('should reject with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' });
        
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('invalid_refresh_token');
    });
    
    it('should reject when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});
        
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('refresh_token_required');
    });
  });

  describe('Account Status Checks', () => {
    it('should deny access when account is suspended', async () => {
      // Update user status to suspended
      await User.findByIdAndUpdate(testUser._id, { status: 'suspended' });
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);
        
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('account_inactive');
    });
    
    it('should deny access when account is locked', async () => {
      // Update user status and lock time
      const lockUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      await User.findByIdAndUpdate(testUser._id, { 
        status: 'locked',
        lockUntil,
        failedLoginAttempts: 5
      });
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);
        
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('account_locked');
    });
  });

  describe('Password Change Detection', () => {
    it('should deny access when password has been changed after token issuance', async () => {
      // Wait to ensure JWT iat is in the past
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Change user password
      const newPassword = 'NewPassword456!';
      testUser.password = newPassword;
      await testUser.save();
      
      const response = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);
        
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('password_changed');
    });
  });
});