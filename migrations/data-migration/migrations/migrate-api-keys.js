/**
 * Migrate API Keys from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-api-keys');

/**
 * Migrate API Keys collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateApiKeys(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting API keys migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('api_keys');
    
    // Check if collection exists
    if (!collection) {
      logger.info('No api_keys collection found in MongoDB');
      return { docsRead: 0, recordsWritten: 0 };
    }
    
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} API keys in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        userId: 'user_id',
        key: 'key',
        name: 'name',
        permissions: 'permissions',
        expiresAt: 'expires_at',
        lastUsed: 'last_used',
        status: 'status',
        createdBy: 'created_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          key_id: '', // Will be filled below
          created_by: 'system',
          status: 'active',
          permissions: ['read']
        },
        // Define transforms for specific fields
        transforms: {
          permissions: (perms) => Array.isArray(perms) ? perms : ['read'],
          expiresAt: (date) => date ? new Date(date) : null,
          lastUsed: (date) => date ? new Date(date) : null
        }
      }
    ));
    
    // Generate key_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing keyId if available, otherwise generate
      const doc = documents[index];
      record.key_id = doc.keyId || transformId(doc) || generateId();
    });
    
    if (verbose && records.length > 0) {
      // Don't log the full key for security
      const sampleRecord = { ...records[0] };
      if (sampleRecord.key) {
        sampleRecord.key = sampleRecord.key.substring(0, 6) + '...';
      }
      logger.debug(`Sample API key record: ${JSON.stringify(sampleRecord)}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'api_keys', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} API keys to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating API keys:', error);
    throw error;
  }
}

module.exports = migrateApiKeys;