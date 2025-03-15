/**
 * Migrate Brand Guidelines from MongoDB to PostgreSQL
 */

const { mapDocument, batchInsert, generateId, transformId } = require('../utils');
const logger = require('../../../src/common/services/logger').createLogger('migrate-brand-guidelines');

/**
 * Migrate Brand Guidelines collection
 * @param {Object} mongodb - MongoDB connection
 * @param {Object} sequelize - Sequelize connection
 * @param {Object} options - Migration options
 * @returns {Object} - Migration result statistics
 */
async function migrateBrandGuidelines(mongodb, sequelize, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const result = { docsRead: 0, recordsWritten: 0 };
  
  try {
    logger.info('Starting brand guidelines migration');
    
    // Get MongoDB collection
    const collection = mongodb.collection('brand_guidelines');
    const documents = await collection.find({}).toArray();
    result.docsRead = documents.length;
    
    logger.info(`Found ${documents.length} brand guidelines in MongoDB`);
    
    // Transform MongoDB documents to PostgreSQL records
    const records = documents.map((doc) => mapDocument(
      doc,
      {
        // Map MongoDB fields to PostgreSQL fields
        version: 'version',
        companyName: 'company_name',
        productNames: 'product_names',
        voice: 'voice',
        terminology: 'terminology',
        logoUsage: 'logo_usage',
        colorPalette: 'color_palette',
        typography: 'typography',
        lastUpdated: 'last_updated',
        createdBy: 'created_by',
        updatedBy: 'updated_by'
      },
      {
        // Define default values for missing fields
        defaultValues: {
          guideline_id: '', // Will be filled below
          created_by: 'system',
          updated_by: null,
          last_updated: new Date()
        },
        // Define transforms for specific fields
        transforms: {
          companyName: (name) => typeof name === 'string' ? { name, usageGuidelines: '' } : name,
          lastUpdated: (date) => date ? new Date(date) : new Date()
        }
      }
    ));
    
    // Generate guideline_id for records that don't have one
    records.forEach((record, index) => {
      // Use existing guidelineId if available, otherwise generate
      const doc = documents[index];
      record.guideline_id = doc.guidelineId || transformId(doc) || generateId();
    });
    
    if (verbose) {
      logger.debug(`Sample brand guideline record: ${JSON.stringify(records[0])}`);
    }
    
    // Insert records into PostgreSQL
    const recordsWritten = await batchInsert(sequelize, 'brand_guidelines', records, { dryRun });
    result.recordsWritten = recordsWritten;
    
    logger.info(`Migrated ${recordsWritten} brand guidelines to PostgreSQL`);
    return result;
    
  } catch (error) {
    logger.error('Error migrating brand guidelines:', error);
    throw error;
  }
}

module.exports = migrateBrandGuidelines;