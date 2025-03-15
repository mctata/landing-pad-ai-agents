/**
 * Migrate Metrics from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-metrics');

/**
 * Migrate Metrics collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateMetrics(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting metrics migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('metrics');
    
    // Check if collection exists
    if (!collection) {
      logger.info('No metrics collection found in MongoDB');
      
      // Try to extract metrics from content documents
      logger.info('Looking for embedded metrics in content documents');
      const contentCollection = mongodb.collection('contents');
      
      if (contentCollection) {
        const contentDocs = await contentCollection.find({
          'analytics': { $exists: true }
        }).toArray();
        
        logger.info(`Found ${contentDocs.length} content documents with analytics data`);
        
        // Create metrics records from content analytics
        const records = [];
        
        for (const doc of contentDocs) {
          if (doc.analytics) {
            const contentId = doc.contentId || transformId(doc);
            
            const metricRecord = {
              performance_id: generateId(),
              content_id: contentId,
              date_range: {
                start: doc.analytics.lastAnalyticsUpdate || doc.updatedAt || new Date(),
                end: doc.analytics.lastAnalyticsUpdate || doc.updatedAt || new Date()
              },
              metrics: doc.analytics,
              source: 'content_analytics',
              created_by: 'system',
              created_at: new Date(),
              updated_at: new Date()
            };
            
            records.push(metricRecord);
          }
        }
        
        if (records.length > 0) {
          if (verbose) {
            logger.debug(`Sample extracted metric record: ${JSON.stringify(records[0])}`);
          }
          
          // Insert records into PostgreSQL
          const recordsWritten = await batchInsert(sequelize, 'metrics', records, { dryRun });
          result.recordsWritten = recordsWritten;
          
          logger.info(`Migrated ${recordsWritten} metrics extracted from content analytics`);
        }
      }
      
      return result;
    }
    
    // Collection exists, so get all documents
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} metrics in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        contentId: 'content_id',
        dateRange: 'date_range',
        metrics: 'metrics',
        source: 'source',
        createdBy: 'created_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          performance_id: '', // Will be filled below
          created_by: 'system',
          source: 'analytics'
        },
        // Define transforms for specific fields
        transforms: {
          dateRange: (range) => {
            if (!range) {
              return {
                start: doc.createdAt || new Date(),
                end: doc.createdAt || new Date()
              };
            }
            // Ensure both start and end dates exist
            if (!range.start) range.start = doc.createdAt || new Date();
            if (!range.end) range.end = doc.createdAt || new Date();
            
            // Convert dates to Date objects if they're strings
            if (typeof range.start === 'string') range.start = new Date(range.start);
            if (typeof range.end === 'string') range.end = new Date(range.end);
            
            return range;
          },
          metrics: (metrics) => metrics || {}
        }
      }
    ));
    
    // Generate performance_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing performanceId if available, otherwise generate
      const doc = documents[index];
      record.performance_id = doc.performanceId || transformId(doc) || generateId();
    });
    
    if (verbose && records.length > 0) {
      logger.debug(`Sample metric record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'metrics', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} metrics to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating metrics:', error);
    throw error;
  }
}

module.exports = migrateMetrics;