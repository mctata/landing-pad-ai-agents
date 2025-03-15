'use strict';

// This is a simple serverless function to proxy API requests 
// when deployed to Netlify

const express = require('express');
// Note: serverless-http package needs to be installed
// via npm install serverless-http
const app = express();

// Enable JSON body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'System is up and running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Example route for agents
app.get('/api/agents', (req, res) => {
  // Mock response - in a real app, you'd fetch from database
  res.json({
    agents: [
      { id: 'content-creation', name: 'Content Creation Agent', status: 'active' },
      { id: 'content-strategy', name: 'Content Strategy Agent', status: 'active' },
      { id: 'content-management', name: 'Content Management Agent', status: 'active' },
      { id: 'brand-consistency', name: 'Brand Consistency Agent', status: 'active' },
      { id: 'optimisation', name: 'Optimization Agent', status: 'active' }
    ]
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint ${req.method} ${req.path} does not exist`
  });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: 'Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Export handler for serverless
exports.handler = (event, _context) => {
  // This is a simple implementation without serverless-http
  // In a real implementation, you would use the serverless-http package
  const path = event.path.replace('/.netlify/functions/api', '/api');
  
  if (path === '/api/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'ok',
        message: 'System is up and running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      })
    };
  }
  
  if (path === '/api/agents') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agents: [
          { id: 'content-creation', name: 'Content Creation Agent', status: 'active' },
          { id: 'content-strategy', name: 'Content Strategy Agent', status: 'active' },
          { id: 'content-management', name: 'Content Management Agent', status: 'active' },
          { id: 'brand-consistency', name: 'Brand Consistency Agent', status: 'active' },
          { id: 'optimisation', name: 'Optimization Agent', status: 'active' }
        ]
      })
    };
  }
  
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'Not Found',
      message: `The requested endpoint ${event.httpMethod} ${path} does not exist`
    })
  };
};