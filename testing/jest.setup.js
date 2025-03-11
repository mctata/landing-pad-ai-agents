/**
 * Jest Global Setup
 * This file runs before each test file.
 */

// Set up environment variables for testing
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/landing_pad_ai_agents_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

// Extended Jest matchers for MongoDB
expect.extend({
  toBeObjectId(received) {
    const stringObjectId = String(received);
    // MongoDB ObjectId is a 24 character hex string
    const pass = /^[0-9a-fA-F]{24}$/.test(stringObjectId);
    
    if (pass) {
      return {
        message: () => `expected ${stringObjectId} not to be a valid ObjectId`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${stringObjectId} to be a valid ObjectId`,
        pass: false
      };
    }
  }
});

// Global setup
beforeAll(async () => {
  console.log('\nRunning tests in environment:', process.env.NODE_ENV);
  global.testStartTime = Date.now();
});

// Global teardown
afterAll(async () => {
  const testDuration = Date.now() - global.testStartTime;
  console.log(`\nTests completed in ${testDuration}ms`);
});

// Set timeout for all tests to 10 seconds
jest.setTimeout(10000);