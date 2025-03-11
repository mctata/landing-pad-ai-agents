/**
 * Migration Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides functionality to manage database schema migrations.
 * It uses migrate-mongo to execute migration scripts in a controlled manner.
 */

const path = require('path');
const { Database } = require('migrate-mongo');
const fs = require('fs');
const Logger = require('./logger');

class MigrationService {
  constructor(config = {}) {
    this.logger = new Logger('MigrationService');
    this.configFilePath = config.configFilePath || path.resolve(process.cwd(), 'migrations/migrate-mongo-config.js');
    this.migrationsDir = config.migrationsDir || path.resolve(process.cwd(), 'migrations/scripts');
    this.migrationConfig = null;
    this.database = null;
  }

  /**
   * Initialize the migration service
   */
  async initialize() {
    try {
      // Check if the config file exists
      if (!fs.existsSync(this.configFilePath)) {
        throw new Error(`Migration config file not found at ${this.configFilePath}`);
      }

      // Load the migration config
      this.migrationConfig = require(this.configFilePath);
      
      // Initialize the database connection
      this.database = await Database.connect(this.migrationConfig.mongodb);
      
      this.logger.info('Migration service initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize migration service', error);
      throw error;
    }
  }

  /**
   * Get the status of all migrations
   * @returns {Array} An array of migration objects with status information
   */
  async status() {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const { db } = this.database;
      const statusItems = await Database.status(db, this.migrationsDir);
      return statusItems;
    } catch (error) {
      this.logger.error('Failed to get migration status', error);
      throw error;
    }
  }

  /**
   * Get a list of all migration files
   * @returns {Array} An array of migration file names
   */
  async listMigrations() {
    try {
      const migrationFiles = fs.readdirSync(this.migrationsDir)
        .filter(file => file.endsWith('.js'))
        .sort();
      
      return migrationFiles;
    } catch (error) {
      this.logger.error('Failed to list migrations', error);
      throw error;
    }
  }

  /**
   * Apply all pending migrations
   * @returns {Array} An array of applied migration file names
   */
  async up() {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const { db } = this.database;
      const migrated = await Database.up(db, this.migrationsDir);
      
      if (migrated.length > 0) {
        this.logger.info(`Applied ${migrated.length} migrations: ${migrated.join(', ')}`);
      } else {
        this.logger.info('No migrations to apply');
      }
      
      return migrated;
    } catch (error) {
      this.logger.error('Migration up failed', error);
      throw error;
    }
  }

  /**
   * Revert the most recently applied migration
   * @returns {String} The name of the reverted migration file
   */
  async down() {
    try {
      if (!this.database) {
        await this.initialize();
      }

      const { db } = this.database;
      const migratedDown = await Database.down(db, this.migrationsDir);
      
      if (migratedDown) {
        this.logger.info(`Reverted migration: ${migratedDown}`);
      } else {
        this.logger.info('No migrations to revert');
      }
      
      return migratedDown;
    } catch (error) {
      this.logger.error('Migration down failed', error);
      throw error;
    }
  }

  /**
   * Create a new migration file
   * @param {String} name - The descriptive name for the migration
   * @returns {String} The path to the created migration file
   */
  createMigration(name) {
    try {
      // Generate a timestamp for the migration file name
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const fileName = `${timestamp}-${name.toLowerCase().replace(/\s+/g, '-')}.js`;
      const filePath = path.join(this.migrationsDir, fileName);
      
      // Create the migration file with a template
      const template = `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  async up(db, client) {
    // TODO: Implement the migration up
  },

  async down(db, client) {
    // TODO: Implement the migration down
  }
};`;

      fs.writeFileSync(filePath, template);
      this.logger.info(`Created migration file: ${fileName}`);
      
      return filePath;
    } catch (error) {
      this.logger.error('Failed to create migration file', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.database && this.database.client) {
      await this.database.client.close();
      this.logger.info('Database connection closed');
    }
  }

  /**
   * Get a singleton instance of the MigrationService
   * @param {Object} config - Configuration options
   * @returns {MigrationService} A singleton instance of MigrationService
   */
  static getInstance(config) {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService(config);
    }
    return MigrationService.instance;
  }
}

module.exports = MigrationService;