/**
 * Migrate Workflows from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-workflows');

/**
 * Migrate Workflows collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateWorkflows(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting workflows migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('workflows');
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} workflows in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        name: 'name',
        description: 'description',
        type: 'type',
        status: 'status',
        priority: 'priority',
        contentId: 'content_id',
        briefId: 'brief_id',
        steps: 'steps',
        currentStep: 'current_step',
        metadata: 'metadata',
        createdBy: 'created_by',
        updatedBy: 'updated_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          workflow_id: '', // Will be filled below
          created_by: 'system',
          updated_by: null,
          status: 'pending',
          priority: 1,
          current_step: 0,
          steps: [],
          metadata: {}
        },
        // Define transforms for specific fields
        transforms: {
          steps: (steps) => Array.isArray(steps) ? steps : [],
          currentStep: (step) => typeof step === 'number' ? step : 0,
          priority: (priority) => typeof priority === 'number' ? priority : 1,
          metadata: (metadata) => metadata || {}
        }
      }
    ));
    
    // Generate workflow_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing workflowId if available, otherwise generate
      const doc = documents[index];
      record.workflow_id = doc.workflowId || transformId(doc) || generateId();
    });
    
    if (verbose) {
      logger.debug(`Sample workflow record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'workflows', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} workflows to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating workflows:', error);
    throw error;
  }
}

module.exports = migrateWorkflows;