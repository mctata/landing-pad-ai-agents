/**
 * Migrate Content Versions from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-content-versions');

/**
 * Migrate Content Versions collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateContentVersions(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting content versions migration');
    
    // Get MongoDB collection
    const contentCollection = mongodb.collection('contents');
    const versionCollection = mongodb.collection('content_versions');
    
    let documents = [];
    
    // Check if content_versions collection exists
    if (versionCollection) {
      // If collection exists, get all documents
      documents = await versionCollection.find({}).toArray();
      logger.info(`Found ${documents.length} content versions in MongoDB`);
    } else {
      logger.info('No content_versions collection found in MongoDB');
      
      // If collection doesn't exist, content versions might be embedded in content documents
      // Extract versions from content documents if they exist
      const contentDocs = await contentCollection.find({
        $or: [
          { versions: { $exists: true, $ne: [] } },
          { versionHistory: { $exists: true, $ne: [] } }
        ]
      }).toArray();
      
      logger.info(`Found ${contentDocs.length} content documents with version history`);
      
      // Extract versions
      for (const doc of contentDocs) {
        const contentId = doc.contentId || transformId(doc);
        const versionArray = doc.versions || doc.versionHistory || [];
        
        if (Array.isArray(versionArray) && versionArray.length > 0) {
          // Handle different version formats
          versionArray.forEach((version, index) => {
            // For embedded versions, create a synthetic version document
            const versionDoc = {
              contentId,
              version: index + 1,
              data: typeof version === 'object' ? version : { content: version },
              createdAt: doc.createdAt,
              createdBy: doc.createdBy || 'system'
            };
            
            documents.push(versionDoc);
          });
        }
      }
      
      logger.info(`Extracted ${documents.length} versions from content documents`);
    }
    
    result.docsRead = documents.length;
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        contentId: 'content_id',
        version: 'version',
        data: 'data',
        changeSummary: 'change_summary',
        createdBy: 'created_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          version_id: generateId(),
          created_by: 'system',
          version: 1,
          data: {}
        },
        // Define transforms for specific fields
        transforms: {
          // Ensure version is a number
          version: (version) => typeof version === 'number' ? version : 1,
          // Ensure data is an object
          data: (data, doc) => {
            if (data === null || data === undefined) {
              // If no data, create from the document itself
              const result = { ...doc };
              delete result._id;
              delete result.contentId;
              delete result.version;
              delete result.changeSummary;
              delete result.createdBy;
              delete result.createdAt;
              return result;
            }
            return data;
          },
          changeSummary: (summary) => summary || null
        },
        // Don't include updated_at since versions are immutable
        includeCreatedUpdated: false
      }
    ));
    
    if (verbose && records.length > 0) {
      logger.debug(`Sample content version record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'content_versions', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} content versions to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating content versions:', error);
    throw error;
  }
}

module.exports = migrateContentVersions;