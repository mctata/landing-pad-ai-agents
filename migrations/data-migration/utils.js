/**
 * Migration Utilities
 * 
 * Common utility functions for MongoDB to PostgreSQL data migration
 */

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 24);
const logger = require('../../src/common/services/logger').createLogger('data-migration');

/**
 * Generate a new ID (similar to MongoDB ObjectId but as string)
 * @returns {string} - Generated ID
 */
function generateId() {
  return nanoid();
}

/**
 * Transform MongoDB document ID
 * If the MongoDB _id is an ObjectId, convert to string
 * Otherwise, use the original value
 * @param {Object} doc - MongoDB document
 * @returns {string} - String ID
 */
function transformId(doc) {
  if (!doc || !doc._id) return null;
  
  // If _id is ObjectId, convert to string
  if (doc._id.toString) {
    return doc._id.toString();
  }
  
  // Otherwise return as is (if already string)
  return doc._id;
}

/**
 * Map MongoDB document to PostgreSQL schema
 * @param {Object} doc - MongoDB document
 * @param {Object} fieldMap - Mapping of MongoDB field names to PostgreSQL field names
 * @param {Object} options - Additional options for mapping
 * @returns {Object} - Mapped record
 */
function mapDocument(doc, fieldMap, options = {}) {
  const { 
    defaultValues = {},
    transforms = {},
    includeCreatedUpdated = true,
    idField = null
  } = options;
  
  const result = { ...defaultValues };
  
  // Set ID field if specified
  if (idField) {
    const idValue = transformId(doc);
    if (idValue) {
      result[idField] = idValue;
    }
  }
  
  // Map fields according to the field map
  for (const [mongoField, pgField] of Object.entries(fieldMap)) {
    // Skip fields that don't exist in the MongoDB document
    if (!(mongoField in doc)) continue;
    
    // Apply transform if defined, otherwise use value directly
    if (transforms[mongoField]) {
      result[pgField] = transforms[mongoField](doc[mongoField], doc);
    } else {
      result[pgField] = doc[mongoField];
    }
  }
  
  // Add created/updated timestamps if requested
  if (includeCreatedUpdated) {
    if (doc.createdAt) {
      result.created_at = new Date(doc.createdAt);
    } else {
      result.created_at = new Date();
    }
    
    if (doc.updatedAt) {
      result.updated_at = new Date(doc.updatedAt);
    } else {
      result.updated_at = new Date();
    }
  }
  
  return result;
}

/**
 * Batch insert records into PostgreSQL
 * @param {Object} sequelize - Sequelize instance
 * @param {string} tableName - Table name
 * @param {Array} records - Records to insert
 * @param {Object} options - Insertion options
 * @returns {Promise<number>} - Number of records inserted
 */
async function batchInsert(sequelize, tableName, records, options = {}) {
  const { 
    batchSize = 100,
    dryRun = false,
    transaction = null
  } = options;
  
  if (records.length === 0) {
    return 0;
  }
  
  let insertedCount = 0;
  
  // Split records into batches
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    // Log batch information
    logger.debug(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(records.length / batchSize)} (${batch.length} records) into ${tableName}`);
    
    if (dryRun) {
      logger.debug(`DRY RUN: Would insert ${batch.length} records into ${tableName}`);
      insertedCount += batch.length;
      continue;
    }
    
    try {
      // Insert records
      const insertQuery = `
        INSERT INTO "${tableName}" (${Object.keys(batch[0]).map(k => `"${k}"`).join(', ')})
        VALUES ${batch.map(record => `(${Object.values(record).map(formatValue).join(', ')})`).join(', ')}
      `;
      
      // Execute query with or without transaction
      if (transaction) {
        await sequelize.query(insertQuery, { transaction });
      } else {
        await sequelize.query(insertQuery);
      }
      
      insertedCount += batch.length;
    } catch (error) {
      logger.error(`Error inserting batch into ${tableName}:`, error);
      throw error;
    }
  }
  
  return insertedCount;
}

/**
 * Format a value for SQL insertion
 * @param {*} value - Value to format
 * @returns {string} - Formatted value
 */
function formatValue(value) {
  if (value === null) return 'NULL';
  if (value === undefined) return 'NULL';
  
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  
  if (typeof value === 'object') {
    // Handle arrays and objects - convert to JSON
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  
  // Handle strings
  return `'${value.toString().replace(/'/g, "''")}'`;
}

/**
 * Check if a value exists in a table
 * @param {Object} sequelize - Sequelize instance
 * @param {string} tableName - Table name
 * @param {string} column - Column to check
 * @param {*} value - Value to check
 * @returns {Promise<boolean>} - Whether the value exists
 */
async function valueExists(sequelize, tableName, column, value) {
  const [[result]] = await sequelize.query(
    `SELECT EXISTS(SELECT 1 FROM "${tableName}" WHERE "${column}" = $1) as "exists"`,
    { bind: [value] }
  );
  
  return result.exists;
}

/**
 * Get the maximum value from a column
 * @param {Object} sequelize - Sequelize instance
 * @param {string} tableName - Table name
 * @param {string} column - Column to get max from
 * @returns {Promise<number>} - Maximum value
 */
async function getMaxValue(sequelize, tableName, column) {
  const [[result]] = await sequelize.query(
    `SELECT MAX("${column}") as "max" FROM "${tableName}"`
  );
  
  return result.max || 0;
}

module.exports = {
  generateId,
  transformId,
  mapDocument,
  batchInsert,
  valueExists,
  getMaxValue
};