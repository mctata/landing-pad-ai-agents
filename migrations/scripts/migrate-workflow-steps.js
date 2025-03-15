/**
 * Migrate Workflow Steps from JSON to Relational Model
 * 
 * This script migrates workflow steps from the old JSON array format
 * to the new relational model using the WorkflowStep table.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const DatabaseService = require('../../src/common/services/databaseService');
const models = require('../../src/models');
const logger = require('../../src/common/services/logger').createLogger('workflow-migration');

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'agents_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
};

// Main migration function
async function migrateWorkflowSteps() {
  const db = new DatabaseService(pgConfig);
  
  try {
    logger.info('Starting workflow steps migration...');
    
    // Connect to database
    await db.connect();
    
    // Get all workflows that have steps in JSON format
    const workflows = await db.models.Workflow.findAll({
      where: {
        steps: {
          [Sequelize.Op.not]: null
        }
      }
    });
    
    logger.info(`Found ${workflows.length} workflows with steps to migrate`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Migrate each workflow's steps
    for (const workflow of workflows) {
      try {
        logger.info(`Migrating steps for workflow ${workflow.workflowId} (${workflow.name})`);
        
        const success = await db.migrateWorkflowSteps(workflow.workflowId);
        
        if (success) {
          logger.info(`Successfully migrated steps for workflow ${workflow.workflowId}`);
          successCount++;
        } else {
          logger.warn(`No steps to migrate for workflow ${workflow.workflowId}`);
          failureCount++;
        }
      } catch (error) {
        logger.error(`Error migrating steps for workflow ${workflow.workflowId}:`, error);
        failureCount++;
      }
    }
    
    logger.info(`Migration completed: ${successCount} successful, ${failureCount} failed`);
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await db.disconnect();
  }
}

// Run the migration
if (require.main === module) {
  migrateWorkflowSteps()
    .then(() => {
      logger.info('Workflow steps migration completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Workflow steps migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateWorkflowSteps;