/**
 * Integration tests for the Database Service - User Operations
 */

const testDatabase = require('../../../testing/setupTestDatabase');
const { mockFactories } = require('../../../testing/testHelpers');
const DatabaseService = require('../../../src/common/services/databaseService');
const mongoose = require('mongoose');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

describe('DatabaseService User Operations', () => {
  let databaseService;

  // Connect to test database before all tests
  beforeAll(async () => {
    await testDatabase.connect();
    
    // Initialize database service with test config
    const config = {
      uri: global.__MONGO_URI__,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    };
    
    databaseService = new DatabaseService(config, mockLogger);
    await databaseService.connect();
  });

  // Clear database before each test
  beforeEach(async () => {
    await testDatabase.clearDatabase();
    jest.clearAllMocks();
  });

  // Disconnect from database after all tests
  afterAll(async () => {
    await databaseService.disconnect();
    await testDatabase.closeDatabase();
  });

  describe('User CRUD Operations', () => {
    it('should create user with generated ID', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
        role: 'editor'
      };
      
      // Act
      const user = await databaseService.createUser(userData);
      
      // Assert
      expect(user).toBeDefined();
      expect(user.userId).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.firstName).toBe('Test');
      expect(user.lastName).toBe('User');
      expect(user.role).toBe('editor');
      
      // Password should be hashed, not stored as plaintext
      expect(user.password).not.toBe('password123');
      
      // Verify user was saved
      const savedUser = await databaseService.getUser(user.userId);
      expect(savedUser).toBeDefined();
      expect(savedUser.userId).toBe(user.userId);
    });
    
    it('should create user with provided ID', async () => {
      // Arrange
      const userId = 'custom-user-id';
      const userData = {
        userId,
        email: 'custom@example.com',
        firstName: 'Custom',
        lastName: 'User',
        password: 'password123',
        role: 'admin'
      };
      
      // Act
      const user = await databaseService.createUser(userData);
      
      // Assert
      expect(user.userId).toBe(userId);
    });
    
    it('should retrieve user by ID', async () => {
      // Arrange
      const userData = {
        email: 'retrieve@example.com',
        firstName: 'Retrieve',
        lastName: 'Test',
        password: 'password123',
        role: 'user'
      };
      
      const created = await databaseService.createUser(userData);
      
      // Act
      const retrieved = await databaseService.getUser(created.userId);
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.userId).toBe(created.userId);
      expect(retrieved.email).toBe('retrieve@example.com');
      expect(retrieved.firstName).toBe('Retrieve');
      expect(retrieved.lastName).toBe('Test');
    });
    
    it('should retrieve user by email', async () => {
      // Arrange
      const userData = {
        email: 'email-test@example.com',
        firstName: 'Email',
        lastName: 'Lookup',
        password: 'password123'
      };
      
      await databaseService.createUser(userData);
      
      // Act
      const retrieved = await databaseService.getUserByEmail('email-test@example.com');
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.email).toBe('email-test@example.com');
      expect(retrieved.firstName).toBe('Email');
      expect(retrieved.lastName).toBe('Lookup');
    });
    
    it('should retrieve user by case-insensitive email', async () => {
      // Arrange
      const userData = {
        email: 'MIXED-case@Example.com',
        firstName: 'Case',
        lastName: 'Insensitive',
        password: 'password123'
      };
      
      await databaseService.createUser(userData);
      
      // Act - Use different case for lookup
      const retrieved = await databaseService.getUserByEmail('mixed-case@example.com');
      
      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.email.toLowerCase()).toBe('mixed-case@example.com');
    });
    
    it('should update user information', async () => {
      // Arrange
      const userData = {
        email: 'update@example.com',
        firstName: 'Before',
        lastName: 'Update',
        password: 'password123',
        role: 'user'
      };
      
      const user = await databaseService.createUser(userData);
      const updateData = {
        firstName: 'After',
        lastName: 'Updated',
        role: 'editor',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };
      
      // Act
      const updated = await databaseService.updateUser(user.userId, updateData);
      
      // Assert
      expect(updated).toBeDefined();
      expect(updated.userId).toBe(user.userId);
      expect(updated.email).toBe('update@example.com'); // Unchanged
      expect(updated.firstName).toBe('After');
      expect(updated.lastName).toBe('Updated');
      expect(updated.role).toBe('editor');
      expect(updated.preferences).toEqual({
        theme: 'dark',
        notifications: true
      });
    });
    
    it('should throw error when updating non-existent user', async () => {
      // Arrange
      const nonExistentId = 'non-existent-user-id';
      const updateData = {
        firstName: 'Will',
        lastName: 'Fail'
      };
      
      // Act & Assert
      await expect(databaseService.updateUser(nonExistentId, updateData))
        .rejects.toThrow(`User with ID ${nonExistentId} not found`);
    });
  });
  
  describe('User Password Management', () => {
    it('should hash password during user creation', async () => {
      // Arrange
      const userData = {
        email: 'password@example.com',
        firstName: 'Password',
        lastName: 'Test',
        password: 'plaintext123'
      };
      
      // Act
      const user = await databaseService.createUser(userData);
      
      // Assert
      expect(user.password).not.toBe('plaintext123');
      expect(user.password).toMatch(/^\$2[aby]?\$\d+\$/); // bcrypt hash pattern
    });
    
    it('should validate correct password', async () => {
      // Arrange
      const userData = {
        email: 'validate@example.com',
        firstName: 'Validate',
        lastName: 'Password',
        password: 'correct-password'
      };
      
      const user = await databaseService.createUser(userData);
      
      // Act
      const isValid = await databaseService.models.User.validatePassword(
        'correct-password', 
        user.password
      );
      
      // Assert
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect password', async () => {
      // Arrange
      const userData = {
        email: 'validate2@example.com',
        firstName: 'Validate',
        lastName: 'Password',
        password: 'correct-password'
      };
      
      const user = await databaseService.createUser(userData);
      
      // Act
      const isValid = await databaseService.models.User.validatePassword(
        'wrong-password', 
        user.password
      );
      
      // Assert
      expect(isValid).toBe(false);
    });
  });
});