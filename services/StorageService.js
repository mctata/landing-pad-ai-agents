/**
 * Storage Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides a unified interface for data storage and retrieval:
 * - PostgreSQL for structured data
 * - AWS S3 for content and assets
 * - Redis for caching
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Pool } = require('pg');
const Redis = require('redis');
const ConfigService = require('./ConfigService');
const logger = require('./LoggerService');
const { Readable } = require('stream');
const { promisify } = require('util');
const streamToBuffer = require('stream-to-buffer');
const streamToBufferPromise = promisify(streamToBuffer);

class StorageService {
  constructor() {
    this.config = ConfigService.getConfig('storage');
    this.logger = logger.createLogger('storage');
    this.s3Client = null;
    this.pgPool = null;
    this.redisClient = null;
    this.connected = false;
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Initialize the storage service
   */
  async initialize() {
    try {
      this.logger.info('Initializing storage service');
      
      // Initialize S3 client
      await this._initializeS3();
      
      // Initialize PostgreSQL connection
      await this._initializePostgreSQL();
      
      // Initialize Redis connection
      await this._initializeRedis();
      
      this.connected = true;
      this.logger.info('Storage service initialized');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize storage service: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Store data in a PostgreSQL table
   * @param {string} tableName - Table name
   * @param {Object} data - Data to store
   * @returns {Promise<Object>} - Stored document with ID
   */
  async storeData(tableName, data) {
    try {
      this.logger.info(`Storing data in table: ${tableName}`);
      
      // Add timestamps
      const document = {
        ...data,
        created_at: data.created_at || new Date(),
        updated_at: new Date()
      };
      
      // Extract column names and values
      const columns = Object.keys(document);
      const values = Object.values(document);
      
      // Build SQL query 
      // Note: This is vulnerable to SQL injection - in production code, use parameterized queries
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const query = `
        INSERT INTO ${tableName} (${columns.join(', ')}) 
        VALUES (${placeholders})
        RETURNING *
      `;
      
      // Execute query
      const result = await this.pgPool.query(query, values);
      const insertedRow = result.rows[0];
      
      this.logger.info(`Data stored in table ${tableName} with ID: ${insertedRow.id}`);
      
      return insertedRow;
    } catch (error) {
      this.logger.error(`Failed to store data in table ${tableName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Update data in a PostgreSQL table
   * @param {string} tableName - Table name
   * @param {Object} query - Query to find record
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} - Updated document
   */
  async updateData(tableName, query, data) {
    try {
      this.logger.info(`Updating data in table: ${tableName}`);
      
      // Add updatedAt timestamp
      const updateData = {
        ...data,
        updated_at: new Date()
      };
      
      // Build WHERE clause
      const whereConditions = [];
      const whereValues = [];
      let valueIndex = 1;
      
      for (const [key, value] of Object.entries(query)) {
        whereConditions.push(`${key} = $${valueIndex}`);
        whereValues.push(value);
        valueIndex++;
      }
      
      // Build SET clause
      const setClause = [];
      const updateValues = [];
      
      for (const [key, value] of Object.entries(updateData)) {
        setClause.push(`${key} = $${valueIndex}`);
        updateValues.push(value);
        valueIndex++;
      }
      
      // Build SQL query
      const sql = `
        UPDATE ${tableName}
        SET ${setClause.join(', ')}
        WHERE ${whereConditions.join(' AND ')}
        RETURNING *
      `;
      
      // Execute query
      const result = await this.pgPool.query(sql, [...whereValues, ...updateValues]);
      
      if (result.rows.length === 0) {
        throw new Error(`Record not found in table ${tableName}`);
      }
      
      this.logger.info(`Data updated in table ${tableName}`);
      
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to update data in table ${tableName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find data in a PostgreSQL table
   * @param {string} tableName - Table name
   * @param {Object} query - Query to find records
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Found records
   */
  async findData(tableName, query, options = {}) {
    try {
      this.logger.info(`Finding data in table: ${tableName}`);
      
      // Build WHERE clause
      const whereConditions = [];
      const values = [];
      let valueIndex = 1;
      
      for (const [key, value] of Object.entries(query)) {
        whereConditions.push(`${key} = $${valueIndex}`);
        values.push(value);
        valueIndex++;
      }
      
      // Build SQL query
      let sql = `SELECT * FROM ${tableName}`;
      
      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      // Add ORDER BY if specified
      if (options.sort) {
        const sortFields = [];
        for (const [field, direction] of Object.entries(options.sort)) {
          sortFields.push(`${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
        }
        sql += ` ORDER BY ${sortFields.join(', ')}`;
      }
      
      // Add LIMIT if specified
      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }
      
      // Add OFFSET if specified
      if (options.skip) {
        sql += ` OFFSET ${options.skip}`;
      }
      
      // Execute query
      const result = await this.pgPool.query(sql, values);
      
      this.logger.info(`Found ${result.rows.length} records in table ${tableName}`);
      
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to find data in table ${tableName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Find a single record in a PostgreSQL table
   * @param {string} tableName - Table name
   * @param {Object} query - Query to find record
   * @returns {Promise<Object>} - Found record
   */
  async findOne(tableName, query) {
    try {
      this.logger.info(`Finding one record in table: ${tableName}`);
      
      const results = await this.findData(tableName, query, { limit: 1 });
      
      if (results.length === 0) {
        this.logger.info(`Record not found in table ${tableName}`);
        return null;
      }
      
      this.logger.info(`Found record in table ${tableName}`);
      
      return results[0];
    } catch (error) {
      this.logger.error(`Failed to find record in table ${tableName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete data from a PostgreSQL table
   * @param {string} tableName - Table name
   * @param {Object} query - Query to find records to delete
   * @returns {Promise<number>} - Number of deleted records
   */
  async deleteData(tableName, query) {
    try {
      this.logger.info(`Deleting data from table: ${tableName}`);
      
      // Build WHERE clause
      const whereConditions = [];
      const values = [];
      let valueIndex = 1;
      
      for (const [key, value] of Object.entries(query)) {
        whereConditions.push(`${key} = $${valueIndex}`);
        values.push(value);
        valueIndex++;
      }
      
      // Build SQL query
      let sql = `DELETE FROM ${tableName}`;
      
      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      // Execute query
      const result = await this.pgPool.query(sql, values);
      
      this.logger.info(`Deleted ${result.rowCount} records from table ${tableName}`);
      
      return result.rowCount;
    } catch (error) {
      this.logger.error(`Failed to delete data from table ${tableName}: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Store file in AWS S3
   * @param {string} directory - Directory path in S3
   * @param {string} filename - File name
   * @param {string|Buffer} content - File content
   * @returns {Promise<string>} - S3 URL of the stored file
   */
  async storeFile(directory, filename, content) {
    try {
      this.logger.info(`Storing file: ${filename} in directory: ${directory}`);
      
      // Determine bucket based on environment
      const bucket = this.environment === 'production' 
        ? process.env.S3_BUCKET_PROD 
        : process.env.S3_BUCKET_DEV;
      
      // Construct S3 key
      const key = `${directory}/${filename}`;
      
      // Upload file to S3
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: this._getContentType(filename)
      });
      
      await this.s3Client.send(command);
      
      // Get S3 URL
      const s3Url = `https://${bucket}.s3.${this.config.s3.region}.amazonaws.com/${key}`;
      
      this.logger.info(`File stored in S3: ${s3Url}`);
      
      return s3Url;
    } catch (error) {
      this.logger.error(`Failed to store file in S3: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Read file from AWS S3
   * @param {string} directory - Directory path in S3
   * @param {string} filename - File name
   * @returns {Promise<Buffer>} - File content
   */
  async readFile(directory, filename) {
    try {
      this.logger.info(`Reading file: ${filename} from directory: ${directory}`);
      
      // Determine bucket based on environment
      const bucket = this.environment === 'production' 
        ? process.env.S3_BUCKET_PROD 
        : process.env.S3_BUCKET_DEV;
      
      // Construct S3 key
      const key = `${directory}/${filename}`;
      
      // Get file from S3
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      
      const response = await this.s3Client.send(command);
      
      // Convert stream to buffer
      const buffer = await streamToBufferPromise(response.Body);
      
      this.logger.info(`File read from S3: ${key}`);
      
      return buffer;
    } catch (error) {
      this.logger.error(`Failed to read file from S3: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Delete file from AWS S3
   * @param {string} directory - Directory path in S3
   * @param {string} filename - File name
   * @returns {Promise<boolean>} - Success
   */
  async deleteFile(directory, filename) {
    try {
      this.logger.info(`Deleting file: ${filename} from directory: ${directory}`);
      
      // Determine bucket based on environment
      const bucket = this.environment === 'production' 
        ? process.env.S3_BUCKET_PROD 
        : process.env.S3_BUCKET_DEV;
      
      // Construct S3 key
      const key = `${directory}/${filename}`;
      
      // Delete file from S3
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      });
      
      await this.s3Client.send(command);
      
      this.logger.info(`File deleted from S3: ${key}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * List files in an S3 directory
   * @param {string} directory - Directory path in S3
   * @returns {Promise<Array>} - File names
   */
  async listFiles(directory) {
    try {
      this.logger.info(`Listing files in directory: ${directory}`);
      
      // Determine bucket based on environment
      const bucket = this.environment === 'production' 
        ? process.env.S3_BUCKET_PROD 
        : process.env.S3_BUCKET_DEV;
      
      // List objects in S3
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: directory,
        Delimiter: '/'
      });
      
      const response = await this.s3Client.send(command);
      
      // Extract file names
      const files = response.Contents
        ? response.Contents.map(obj => obj.Key.substring(directory.length + 1))
        : [];
      
      this.logger.info(`Found ${files.length} files in directory: ${directory}`);
      
      return files;
    } catch (error) {
      this.logger.error(`Failed to list files in directory: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Generate pre-signed URL for S3 file
   * @param {string} directory - Directory path in S3
   * @param {string} filename - File name
   * @param {number} expirationSeconds - Expiration time in seconds
   * @returns {Promise<string>} - Pre-signed URL
   */
  async getSignedUrl(directory, filename, expirationSeconds = 3600) {
    try {
      this.logger.info(`Generating signed URL for file: ${filename}`);
      
      // Determine bucket based on environment
      const bucket = this.environment === 'production' 
        ? process.env.S3_BUCKET_PROD 
        : process.env.S3_BUCKET_DEV;
      
      // Construct S3 key
      const key = `${directory}/${filename}`;
      
      // Generate signed URL
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });
      
      const url = await getSignedUrl(this.s3Client, command, { 
        expiresIn: expirationSeconds 
      });
      
      this.logger.info(`Generated signed URL for file: ${key}`);
      
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Store activity in the database
   * @param {Object} activity - Activity data
   * @returns {Promise<Object>} - Stored activity
   */
  async storeActivity(activity) {
    return await this.storeData('activities', activity);
  }

  /**
   * Get cached value from Redis
   * @param {string} key - Cache key
   * @returns {Promise<*>} - Cached value
   */
  async getCached(key) {
    try {
      const value = await this.redisClient.get(key);
      
      if (!value) {
        return null;
      }
      
      return JSON.parse(value);
    } catch (error) {
      this.logger.error(`Failed to get cached value: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Set cached value in Redis
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} - Success
   */
  async setCached(key, value, ttl = null) {
    try {
      const serializedValue = JSON.stringify(value);
      
      if (ttl) {
        await this.redisClient.set(key, serializedValue, {
          EX: ttl
        });
      } else {
        await this.redisClient.set(key, serializedValue);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to set cached value: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Delete cached value from Redis
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success
   */
  async deleteCached(key) {
    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete cached value: ${error.message}`, error);
      return false;
    }
  }

  /**
   * Shutdown the storage service
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down storage service');
      
      // Close PostgreSQL connection
      if (this.pgPool) {
        await this.pgPool.end();
      }
      
      // Close Redis connection
      if (this.redisClient) {
        await this.redisClient.quit();
      }
      
      this.connected = false;
      this.logger.info('Storage service shut down');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to shut down storage service: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Initialize S3 client
   * @private
   */
  async _initializeS3() {
    try {
      this.logger.info('Initializing S3 client');
      
      this.s3Client = new S3Client({
        region: this.config.s3.region || process.env.S3_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
        }
      });
      
      this.logger.info('S3 client initialized');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize S3 client: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection
   * @private
   */
  async _initializePostgreSQL() {
    try {
      this.logger.info('Initializing PostgreSQL connection');
      
      const connectionConfig = {
        user: this.config.postgres.username || process.env.DB_USER,
        password: this.config.postgres.password || process.env.DB_PASSWORD,
        host: this.config.postgres.host || process.env.DB_HOST,
        port: this.config.postgres.port || process.env.DB_PORT || 5432,
        database: this.config.postgres.database || process.env.DB_NAME,
        ssl: this.config.postgres.ssl ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000
      };
      
      this.pgPool = new Pool(connectionConfig);
      
      // Test the connection
      const client = await this.pgPool.connect();
      client.release();
      
      this.logger.info('PostgreSQL connection initialized');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize PostgreSQL connection: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   * @private
   */
  async _initializeRedis() {
    try {
      this.logger.info('Initializing Redis connection');
      
      // Determine Redis URL based on environment
      let redisUrl;
      if (this.environment === 'production') {
        redisUrl = process.env.REDIS_PROD_URL;
      } else if (this.environment === 'development') {
        redisUrl = process.env.REDIS_DEV_URL;
      } else {
        redisUrl = process.env.REDIS_LOCAL_URL || 'redis://localhost:6379';
      }
      
      this.redisClient = Redis.createClient({
        url: redisUrl
      });
      
      // Set up error handling
      this.redisClient.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
      });
      
      // Connect to Redis
      await this.redisClient.connect();
      
      this.logger.info('Redis connection initialized');
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize Redis connection: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Get content type for a file
   * @private
   * @param {string} filename - File name
   * @returns {string} - Content type
   */
  _getContentType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const contentTypes = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip': 'application/zip',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4'
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// Singleton instance
const instance = new StorageService();

module.exports = instance;