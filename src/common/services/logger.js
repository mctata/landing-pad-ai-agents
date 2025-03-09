/**
 * Logger Service
 * Provides structured logging using winston
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class LoggerService {
  constructor(config) {
    this.config = config;
    this.loggers = new Map();
    
    // Ensure log directory exists
    const logPath = config.log_path || 'logs';
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
    
    // Create default logger
    this.createLogger('system');
  }

  createLogger(name) {
    if (this.loggers.has(name)) {
      return this.loggers.get(name);
    }
    
    const logLevel = this.config.log_level || 'info';
    const logPath = this.config.log_path || 'logs';
    
    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
    
    // Create logger with console and file transports
    const logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      defaultMeta: { service: name },
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
          filename: path.join(logPath, `${name}.log`),
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
    
    this.loggers.set(name, logger);
    return logger;
  }

  getLogger(name = 'system') {
    if (!this.loggers.has(name)) {
      return this.createLogger(name);
    }
    return this.loggers.get(name);
  }
}

module.exports = LoggerService;