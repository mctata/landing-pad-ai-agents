/**
 * Migrate Users from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-users');

/**
 * Migrate Users collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateUsers(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting users migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('users');
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} users in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        email: 'email',
        password: 'password',
        firstName: 'first_name',
        lastName: 'last_name',
        roles: 'roles',
        status: 'status',
        lastLogin: 'last_login',
        preferences: 'preferences',
        securitySettings: 'security_settings',
        createdBy: 'created_by',
        updatedBy: 'updated_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          user_id: '', // Will be filled below
          created_by: 'system',
          updated_by: 'system',
          roles: ['user'],
          status: 'active'
        },
        // Define transforms for specific fields
        transforms: {
          roles: (roles) => Array.isArray(roles) ? roles : ['user']
        }
      }
    ));
    
    // Generate user_id for records that don't have one
    records.forEach((record) => {
      // If MongoDB document had userId, use it
      const userId = doc.userId || generateId();
      record.user_id = userId;
    });
    
    if (verbose) {
      logger.debug(`Sample user record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'users', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} users to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating users:', error);
    throw error;
  }
}

module.exports = migrateUsers;