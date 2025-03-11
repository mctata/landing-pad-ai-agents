/**
 * Logger Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides a unified logging interface for the entire application.
 * It handles:
 * - Log level filtering
 * - Console and file output
 * - Contextual logging (module-specific)
 * - Structured log format
 */

const winston = require('winston');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create agent logs directory if it doesn't exist
const agentLogsDir = path.join(logsDir, 'agents');
if (!fs.existsSync(agentLogsDir)) {
  fs.mkdirSync(agentLogsDir, { recursive: true });
}

// Configure Winston format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Configure console format (more readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, context, ...meta }) => {
    return `${timestamp} ${level} [${context || 'app'}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

// Get log level from environment
const logLevel = process.env.LOG_LEVEL || 'info';

// Create base logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'landing-pad-ai-agents' },
  transports: [
    // Write to all logs with level `info` and below to `combined.log`
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
    
    // Write all logs error (and below) to `error.log`
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    
    // Also log to console in development
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })
  ]
});

/**
 * Create a contextual logger
 * @param {string} context - Logger context (e.g., 'agent:strategy')
 * @returns {Object} - Contextual logger
 */
function createLogger(context) {
  // For agent loggers, also write to agent-specific files
  if (context.startsWith('agent:')) {
    const agentName = context.split(':')[1];
    logger.add(new winston.transports.File({ 
      filename: path.join(agentLogsDir, `${agentName}.log`) 
    }));
  }
  
  // Create child logger with context
  return logger.child({ context });
}

// Export logger and factory function
module.exports = {
  logger,
  createLogger
};
