/**
 * Unit tests for User Model
 */

const mongoose = require('mongoose');
const User = require('../../../src/models/userModel');
const bcrypt = require('bcrypt');

// Mock bcrypt for password comparisons
jest.mock('bcrypt', () => ({
  genSalt: jest.fn().mockResolvedValue('mocked-salt'),
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockImplementation((plainPassword, hashedPassword) => {
    // Simple mock that returns true if passwords match
    return Promise.resolve(plainPassword === 'correct-password');
  })
}));

describe('User Model', () => {
  beforeAll(async () => {
    // Create mongoose connection for testing
    await mongoose.connect(global.__MONGO_URI__ || 'mongodb://localhost:27017/test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear users collection before each test
    await mongoose.connection.collection('users').deleteMany({});
    // Clear all mock calls
    jest.clearAllMocks();
  });

  it('should generate a valid userId', () => {
    const userId = User.generateUserId();
    expect(userId).toBeDefined();
    expect(typeof userId).toBe('string');
    expect(userId).toMatch(/^USER-[A-Z0-9]+$/);
    expect(userId.length).toBeGreaterThan(10);
  });

  it('should create a new user document', async () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      roles: ['writer']
    };

    // Act
    const user = new User(userData);
    const savedUser = await user.save();

    // Assert
    expect(savedUser._id).toBeDefined();
    expect(savedUser.userId).toBe(userData.userId);
    expect(savedUser.firstName).toBe(userData.firstName);
    expect(savedUser.lastName).toBe(userData.lastName);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.roles).toEqual(['writer']);
    expect(savedUser.status).toBe('active'); // Default status
    expect(bcrypt.hash).toHaveBeenCalled(); // Password should be hashed
  });

  it('should hash the password before saving', async () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'plaintext-password',
      roles: ['writer']
    };

    // Act
    const user = new User(userData);
    await user.save();

    // Assert
    expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
    expect(bcrypt.hash).toHaveBeenCalledWith('plaintext-password', 'mocked-salt');
    expect(user.password).toBe('hashed-password');
  });

  it('should only hash password when modified', async () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'plaintext-password',
      roles: ['writer']
    };

    // Act - Create user (password will be hashed)
    const user = new User(userData);
    await user.save();
    
    // Clear mock calls
    bcrypt.genSalt.mockClear();
    bcrypt.hash.mockClear();
    
    // Update user without changing password
    user.firstName = 'Updated';
    await user.save();
    
    // Assert
    expect(bcrypt.genSalt).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('should compare passwords correctly', async () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'hashed-password', // Skip actual hashing for this test
      roles: ['writer']
    };
    
    const user = new User(userData);
    
    // Act - Test with correct password
    const correctResult = await user.comparePassword('correct-password');
    
    // Act - Test with incorrect password
    const incorrectResult = await user.comparePassword('wrong-password');
    
    // Assert
    expect(correctResult).toBe(true);
    expect(incorrectResult).toBe(false);
    expect(bcrypt.compare).toHaveBeenCalledTimes(2);
  });

  it('should have a virtual for fullName', async () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      password: 'password123'
    };
    
    // Act
    const user = new User(userData);
    
    // Assert
    expect(user.fullName).toBe('John Doe');
  });

  it('should exclude password when converting to JSON', () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'secret-password',
      roles: ['writer']
    };
    
    // Act
    const user = new User(userData);
    const jsonUser = user.toJSON();
    
    // Assert
    expect(jsonUser.password).toBeUndefined();
    expect(jsonUser.firstName).toBe('Test');
    expect(jsonUser.lastName).toBe('User');
    expect(jsonUser.fullName).toBe('Test User'); // Virtual should be included
  });

  it('should enforce unique email constraint', async () => {
    // Arrange
    const userData1 = {
      userId: User.generateUserId(),
      firstName: 'First',
      lastName: 'User',
      email: 'duplicate@example.com',
      password: 'password123'
    };
    
    const userData2 = {
      userId: User.generateUserId(),
      firstName: 'Second',
      lastName: 'User',
      email: 'duplicate@example.com', // Same email
      password: 'password456'
    };
    
    // Act
    const user1 = new User(userData1);
    await user1.save();
    
    const user2 = new User(userData2);
    
    // Assert
    await expect(user2.save()).rejects.toThrow();
  });

  it('should enforce required fields', async () => {
    // Arrange
    const userData = {
      // Missing userId
      // Missing firstName
      lastName: 'User',
      // Missing email
      // Missing password
    };
    
    // Act
    const user = new User(userData);
    
    // Assert
    await expect(user.save()).rejects.toThrow();
  });

  it('should enforce enum values for roles', async () => {
    // Arrange
    const userData = {
      userId: User.generateUserId(),
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      roles: ['invalid-role'] // Invalid role
    };
    
    // Act
    const user = new User(userData);
    
    // Assert
    await expect(user.save()).rejects.toThrow();
  });
});