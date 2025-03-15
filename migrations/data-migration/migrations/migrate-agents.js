/**
 * Migrate Agents from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-agents');

/**
 * Migrate Agents collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateAgents(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting agents migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('agents');
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} agents in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        name: 'name',
        description: 'description',
        status: 'status',
        type: 'type',
        modules: 'modules',
        configuration: 'configuration',
        metrics: 'metrics',
        createdBy: 'created_by',
        updatedBy: 'updated_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          agent_id: '', // Will be filled below
          created_by: 'system',
          updated_by: null,
          status: 'active'
        },
        // Define transforms for specific fields
        transforms: {
          modules: (modules) => Array.isArray(modules) ? modules : [],
          metrics: (metrics) => metrics || {},
          configuration: (config) => config || {}
        }
      }
    ));
    
    // Generate agent_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing agentId if available, otherwise generate
      const doc = documents[index];
      record.agent_id = doc.agentId || transformId(doc) || generateId();
    });
    
    if (verbose) {
      logger.debug(`Sample agent record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'agents', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} agents to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating agents:', error);
    throw error;
  }
}

module.exports = migrateAgents;