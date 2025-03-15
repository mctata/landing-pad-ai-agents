'use strict';

// Simple serverless function to check system health

exports.handler = (_event, _context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'ok',
      message: 'System is up and running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    })
  };
};