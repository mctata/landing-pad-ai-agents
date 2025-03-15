/**
 * MongoDB to PostgreSQL Data Migration
 * 
 * This script manages the migration of data from MongoDB to PostgreSQL.
 * It imports data from MongoDB collections and inserts it into the corresponding
 * PostgreSQL tables while maintaining relationships.
 * 
 * Usage: node migrate-data.js [--collection=name] [--verbose] [--dry-run]
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('../../src/common/services/logger').createLogger('data-migration');

// Import migration modules
const migrateUsers = require('./migrations/migrate-users');
const migrateAgents = require('./migrations/migrate-agents');
const migrateBrandGuidelines = require('./migrations/migrate-brand-guidelines');
const migrateBriefs = require('./migrations/migrate-briefs');
const migrateContents = require('./migrations/migrate-contents');
const migrateContentVersions = require('./migrations/migrate-content-versions');
const migrateWorkflows = require('./migrations/migrate-workflows');
const migrateApiKeys = require('./migrations/migrate-api-keys');
const migrateMetrics = require('./migrations/migrate-metrics');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg === '--verbose') acc.verbose = true;
  if (arg === '--dry-run') acc.dryRun = true;
  if (arg.startsWith('--collection=')) {
    acc.collection = arg.split('=')[1];
  }
  return acc;
}, { verbose: false, dryRun: false, collection: null });

// MongoDB connection configuration
const mongoConfig = {
  url: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  dbName: process.env.MONGODB_DB_NAME || 'landing_pad_ai_agents',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
};

// PostgreSQL connection configuration
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'agents_db',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  dialect: 'postgres',
  logging: args.verbose ? msg => logger.debug(msg) : false,
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

// Migration map - defines the order and dependencies for migration
const migrationMap = [
  { name: 'users', migrate: migrateUsers, dependencies: [] },
  { name: 'agents', migrate: migrateAgents, dependencies: ['users'] },
  { name: 'brand_guidelines', migrate: migrateBrandGuidelines, dependencies: ['users'] },
  { name: 'briefs', migrate: migrateBriefs, dependencies: ['users'] },
  { name: 'contents', migrate: migrateContents, dependencies: ['users', 'briefs'] },
  { name: 'content_versions', migrate: migrateContentVersions, dependencies: ['contents'] },
  { name: 'workflows', migrate: migrateWorkflows, dependencies: ['contents', 'briefs', 'users'] },
  { name: 'api_keys', migrate: migrateApiKeys, dependencies: ['users'] },
  { name: 'metrics', migrate: migrateMetrics, dependencies: ['contents'] }
];

// Main migration function
async function migrateData() {
  let mongoClient = null;
  let sequelize = null;
  let results = {};

  try {
    logger.info('Starting MongoDB to PostgreSQL data migration');
    if (args.dryRun) logger.info('DRY RUN: No actual data will be written to PostgreSQL');

    // Connect to MongoDB
    logger.info(`Connecting to MongoDB at ${mongoConfig.url}/${mongoConfig.dbName}`);
    mongoClient = new MongoClient(mongoConfig.url, mongoConfig.options);
    await mongoClient.connect();
    const mongodb = mongoClient.db(mongoConfig.dbName);
    logger.info('MongoDB connection established');

    // Connect to PostgreSQL
    logger.info(`Connecting to PostgreSQL at ${pgConfig.host}:${pgConfig.port}/${pgConfig.database}`);
    sequelize = new Sequelize(pgConfig);
    await sequelize.authenticate();
    logger.info('PostgreSQL connection established');

    // Verify collections in MongoDB
    const collections = await mongodb.listCollections().toArray();
    logger.info(`Found ${collections.length} collections in MongoDB: ${collections.map(c => c.name).join(', ')}`);

    // Create a status tracker for collections
    let migratedCollections = new Set();

    // If a specific collection is requested, only migrate that one
    if (args.collection) {
      const collection = migrationMap.find(m => m.name === args.collection);
      if (!collection) {
        throw new Error(`Collection '${args.collection}' not found in migration map`);
      }
      
      // Check if dependencies are already migrated
      const missingDeps = collection.dependencies.filter(d => !migratedCollections.has(d));
      if (missingDeps.length > 0) {
        logger.warn(`Collection '${collection.name}' depends on unmigrated collections: ${missingDeps.join(', ')}`);
        logger.warn('Attempting to migrate dependencies first');
        
        for (const depName of collection.dependencies) {
          const depCollection = migrationMap.find(m => m.name === depName);
          if (depCollection) {
            results[depName] = await migrateCollection(depCollection, mongodb, sequelize, args);
            if (results[depName].success) {
              migratedCollections.add(depName);
            }
          }
        }
      }
      
      // Migrate the requested collection
      results[collection.name] = await migrateCollection(collection, mongodb, sequelize, args);
      if (results[collection.name].success) {
        migratedCollections.add(collection.name);
      }
    } else {
      // Migrate all collections in the defined order
      for (const collection of migrationMap) {
        results[collection.name] = await migrateCollection(collection, mongodb, sequelize, args);
        if (results[collection.name].success) {
          migratedCollections.add(collection.name);
        }
      }
    }

    // Generate summary report
    let totalDocuments = 0;
    let totalRecords = 0;

    logger.info('----- Migration Results -----');
    for (const [name, result] of Object.entries(results)) {
      const status = result.success ? 'SUCCESS' : 'FAILED';
      logger.info(`${name}: ${status} - ${result.docsRead} docs read, ${result.recordsWritten} records written`);
      
      if (result.errors && result.errors.length > 0) {
        logger.error(`Errors in ${name}:`);
        result.errors.forEach(err => logger.error(`  - ${err}`));
      }
      
      totalDocuments += result.docsRead;
      totalRecords += result.recordsWritten;
    }
    
    logger.info(`------------------------`);
    logger.info(`Total: ${totalDocuments} documents read, ${totalRecords} records written`);
    logger.info('Migration completed');

  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    if (mongoClient) {
      logger.info('Closing MongoDB connection');
      await mongoClient.close();
    }
    
    if (sequelize) {
      logger.info('Closing PostgreSQL connection');
      await sequelize.close();
    }
  }
}

// Function to migrate a specific collection
async function migrateCollection(collection, mongodb, sequelize, options) {
  const result = {
    name: collection.name,
    docsRead: 0,
    recordsWritten: 0,
    success: false,
    errors: []
  };
  
  try {
    logger.info(`Migrating collection: ${collection.name}`);
    
    // Run the migration function
    const migrationResult = await collection.migrate(mongodb, sequelize, options);
    
    result.docsRead = migrationResult.docsRead;
    result.recordsWritten = migrationResult.recordsWritten;
    result.success = true;
    
    logger.info(`Completed migration of ${collection.name}: ${result.docsRead} docs read, ${result.recordsWritten} records written`);
    return result;
  } catch (error) {
    logger.error(`Error migrating ${collection.name}:`, error);
    result.errors.push(error.message);
    return result;
  }
}

// Run the migration
if (require.main === module) {
  migrateData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed with error:', error);
      process.exit(1);
    });
}

module.exports = migrateData;