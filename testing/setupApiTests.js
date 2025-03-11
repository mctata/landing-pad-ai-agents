/**
 * API Test Setup
 * 
 * This module handles setting up and tearing down the environment for API tests.
 */

const supertest = require('supertest');
const { createServer } = require('http');
const express = require('express');
const testDatabase = require('./setupTestDatabase');
const jwt = require('jsonwebtoken');

/**
 * Setup the API test environment
 * @param {Express} app - Express application
 * @returns {Object} Test utilities
 */
async function setupApiTest(app) {
  // Connect to test database
  await testDatabase.connect();
  
  // Create HTTP server
  const server = createServer(app);
  
  // Start server on random port
  await new Promise((resolve) => {
    server.listen(0, () => {
      console.log(`Test server started on port ${server.address().port}`);
      resolve();
    });
  });
  
  // Create supertest client
  const request = supertest(server);
  
  /**
   * Generate authentication token for test requests
   * @param {Object} user - User properties
   * @returns {string} JWT token
   */
  function getAuthToken(user = {}) {
    const defaultUser = {
      userId: 'test-user',
      roles: ['user'],
      email: 'test@example.com'
    };
    
    const payload = { ...defaultUser, ...user };
    
    return jwt.sign(payload, process.env.JWT_SECRET || 'test-jwt-secret', { 
      expiresIn: '1h' 
    });
  }
  
  /**
   * Create an authenticated request
   * @param {Object} user - User properties for token
   * @returns {Object} Supertest request with auth header
   */
  function authRequest(user = {}) {
    const token = getAuthToken(user);
    return request.set('Authorization', `Bearer ${token}`);
  }
  
  /**
   * Create an admin authenticated request
   * @returns {Object} Supertest request with admin auth header
   */
  function adminRequest() {
    return authRequest({ roles: ['admin'] });
  }
  
  /**
   * Close the test environment
   */
  async function closeApiTest() {
    // Close the server
    await new Promise((resolve) => {
      server.close(() => {
        console.log('Test server closed');
        resolve();
      });
    });
    
    // Close database connection
    await testDatabase.closeDatabase();
  }
  
  return {
    request,
    authRequest,
    adminRequest,
    getAuthToken,
    closeApiTest,
    clearDatabase: testDatabase.clearDatabase.bind(testDatabase)
  };
}

module.exports = { setupApiTest };