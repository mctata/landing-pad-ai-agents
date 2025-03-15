/**
 * PostgreSQL Optimization Script
 * This script implements PostgreSQL-specific optimizations after migration from MongoDB
 */

require('dotenv').config();
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configure logger
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Get environment
const env = process.env.NODE_ENV || 'development';
console.log(`Environment: ${env}`);

// Get database config path
const configPath = path.join(__dirname, '..', 'migrations', 'sequelize', 'config', 'config.js');
const config = require(configPath)[env];

// Initialize Sequelize
let sequelize;
try {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      port: config.port,
      dialect: config.dialect,
      logging: msg => logger.debug(msg),
      ...config
    }
  );
} catch (error) {
  logger.error('Failed to initialize Sequelize:', error);
  process.exit(1);
}

async function runMigration(migrationFile) {
  try {
    logger.info(`Running migration: ${migrationFile}`);
    const migrationPath = path.join(__dirname, '..', 'migrations', 'sequelize', 'migrations', migrationFile);
    
    // Import the migration
    const migration = require(migrationPath);
    
    // Execute the up function
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    
    logger.info(`Successfully executed migration: ${migrationFile}`);
    return true;
  } catch (error) {
    logger.error(`Migration failed: ${migrationFile}`, error);
    return false;
  }
}

async function runScript(scriptFile) {
  try {
    logger.info(`Running script: ${scriptFile}`);
    const scriptPath = path.join(__dirname, '..', 'migrations', 'scripts', scriptFile);
    
    // Execute the script
    const { stdout, stderr } = await execPromise(`node ${scriptPath}`);
    
    if (stderr) {
      logger.warn(`Script warnings: ${stderr}`);
    }
    
    logger.info(`Script output: ${stdout}`);
    logger.info(`Successfully executed script: ${scriptFile}`);
    return true;
  } catch (error) {
    logger.error(`Script execution failed: ${scriptFile}`, error);
    return false;
  }
}

async function analyzeTables() {
  try {
    logger.info('Analyzing database tables for query optimization');
    
    // Get all table names
    const tables = await sequelize.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'",
      { type: QueryTypes.SELECT }
    );
    
    // Run ANALYZE on each table
    for (const table of tables) {
      const tableName = table.tablename;
      logger.info(`Analyzing table: ${tableName}`);
      await sequelize.query(`ANALYZE ${tableName}`, { type: QueryTypes.RAW });
    }
    
    logger.info('Database analysis completed');
    return true;
  } catch (error) {
    logger.error('Database analysis failed:', error);
    return false;
  }
}

async function optimizeDatabase() {
  try {
    logger.info('=== PostgreSQL Optimization Started ===');
    
    // Step 1: Test database connection
    try {
      await sequelize.authenticate();
      logger.info('Database connection has been established successfully.');
    } catch (error) {
      logger.error('Unable to connect to the database:', error);
      return;
    }
    
    // Step 2: Create workflow steps table
    const workflowStepsMigration = await runMigration('20250316000000-create-workflow-steps.js');
    if (!workflowStepsMigration) {
      logger.warn('Workflow steps migration failed, but continuing...');
    }
    
    // Step 3: Add full-text search capabilities
    const searchMigration = await runMigration('20250316000001-add-content-search-trigger.js');
    if (!searchMigration) {
      logger.warn('Full-text search migration failed, but continuing...');
    }
    
    // Step 4: Add performance indexes
    const indexesMigration = await runMigration('20250316000002-add-performance-indexes.js');
    if (!indexesMigration) {
      logger.warn('Performance indexes migration failed, but continuing...');
    }
    
    // Step 5: Migrate workflow steps from JSON to relational model
    const workflowStepsScript = await runScript('migrate-workflow-steps.js');
    if (!workflowStepsScript) {
      logger.warn('Workflow steps migration script failed, but continuing...');
    }
    
    // Step 6: Analyze database for query optimization
    const analyzeResult = await analyzeTables();
    if (!analyzeResult) {
      logger.warn('Database analysis failed, but continuing...');
    }
    
    logger.info('=== PostgreSQL Optimization Completed ===');
  } catch (error) {
    logger.error('Database optimization failed:', error);
  } finally {
    if (sequelize) {
      await sequelize.close();
      logger.info('Database connection closed');
    }
  }
}

// Run the optimization
optimizeDatabase();