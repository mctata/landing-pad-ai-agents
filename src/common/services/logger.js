/**
 * Simple logger interface
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure log directory exists
const logPath = 'logs';
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create a simple logger with console and file transports
const logger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'database' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(info => {
          const { timestamp, level, message, service, ...rest } = info;
          const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
          return `${timestamp} [${service}] ${level}: ${message} ${meta}`;
        })
      )
    }),
    
    // File transports
    new winston.transports.File({ 
      filename: path.join(logPath, 'database.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Error file transport
    new winston.transports.File({ 
      filename: path.join(logPath, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

module.exports = logger;