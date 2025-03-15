/**
 * Migrate Briefs from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-briefs');

/**
 * Migrate Briefs collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateBriefs(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting briefs migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('briefs');
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} briefs in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        title: 'title',
        description: 'description',
        details: 'details',
        status: 'status',
        contentType: 'content_type',
        dueDate: 'due_date',
        assignedTo: 'assigned_to',
        createdBy: 'created_by',
        updatedBy: 'updated_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          brief_id: '', // Will be filled below
          created_by: 'system',
          updated_by: null,
          status: 'draft',
          details: {}
        },
        // Define transforms for specific fields
        transforms: {
          dueDate: (date) => date ? new Date(date) : null,
          contentType: (type) => type || 'other',
          details: (details) => details || {}
        }
      }
    ));
    
    // Generate brief_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing briefId if available, otherwise generate
      const doc = documents[index];
      record.brief_id = doc.briefId || transformId(doc) || generateId();
    });
    
    if (verbose) {
      logger.debug(`Sample brief record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'briefs', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} briefs to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating briefs:', error);
    throw error;
  }
}

module.exports = migrateBriefs;