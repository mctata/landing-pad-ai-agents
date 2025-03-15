/**
 * Migrate Contents from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-contents');

/**
 * Migrate Contents collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateContents(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting contents migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('contents');
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} contents in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        title: 'title',
        description: 'description',
        content: 'content',
        contentType: 'type',
        status: 'status',
        categories: 'categories',
        tags: 'tags',
        metadata: 'metadata',
        createdBy: 'created_by',
        updatedBy: 'updated_by',
        publishedAt: 'published_at',
        scheduledAt: 'scheduled_at',
        brief: 'brief_id'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          content_id: '', // Will be filled below
          created_by: 'system',
          updated_by: null,
          status: 'draft',
          type: 'other',
          categories: [],
          tags: [],
          metadata: {}
        },
        // Define transforms for specific fields
        transforms: {
          contentType: (type) => type || 'other',
          brief: (briefId) => briefId || null,
          categories: (categories) => Array.isArray(categories) ? categories : [],
          tags: (tags) => Array.isArray(tags) ? tags : [],
          publishedAt: (date) => date ? new Date(date) : null,
          scheduledAt: (date) => date ? new Date(date) : null,
          // Add analytics data from MongoDB to metadata in PostgreSQL
          metadata: (metadata, doc) => {
            const result = { ...metadata } || {};
            if (doc.analytics) {
              result.analytics = doc.analytics;
            }
            return result;
          }
        }
      }
    ));
    
    // Generate content_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing contentId if available, otherwise generate
      const doc = documents[index];
      record.content_id = doc.contentId || transformId(doc) || generateId();
    });
    
    if (verbose) {
      logger.debug(`Sample content record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'contents', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} contents to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating contents:', error);
    throw error;
  }
}

module.exports = migrateContents;