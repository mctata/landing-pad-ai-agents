/**
 * Logger utility for Landing Pad AI Agents
 * 
 * This is a simple wrapper around a logging implementation.
 * In a real application, this would use a more robust logging solution.
 */

// Simple logger implementation for development
const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] ${message}`, meta);
  },
  
  error: (message, error = null, meta = {}) => {
    console.error(`[ERROR] ${message}`, error, meta);
  },
  
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${message}`, meta);
  },
  
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, meta);
    }
  }
};

module.exports = logger;