/**
 * Migration Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides functionality to manage database schema migrations.
 * It uses sequelize-cli to execute migration scripts in a controlled manner.
 */

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const Logger = require('./logger');

class MigrationService {
  constructor(config = {}) {
    this.logger = Logger.createLogger('MigrationService');
    this.configFilePath = config.configFilePath || path.resolve(process.cwd(), 'migrations/sequelize/config/config.js');
    this.migrationsDir = config.migrationsDir || path.resolve(process.cwd(), 'migrations/sequelize/migrations');
    this.seedersDir = config.seedersDir || path.resolve(process.cwd(), 'migrations/sequelize/seeders');
    this.migrationConfig = null;
    this.sequelize = null;
    this.umzug = null;
    this.umzugSeeder = null;
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
      const env = process.env.NODE_ENV || 'development';
      const dbConfig = this.migrationConfig[env];
      
      // Initialize Sequelize instance
      this.sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
          host: dbConfig.host,
          port: dbConfig.port,
          dialect: dbConfig.dialect,
          logging: msg => this.logger.debug(msg),
          dialectOptions: dbConfig.dialectOptions
        }
      );
      
      // Test connection
      await this.sequelize.authenticate();
      
      // Initialize Umzug for migrations
      this.umzug = new Umzug({
        migrations: {
          glob: path.join(this.migrationsDir, '*.js'),
          resolve: ({ name, path, context }) => {
            const migration = require(path);
            return {
              name,
              up: async () => migration.up(context.queryInterface, context.sequelize),
              down: async () => migration.down(context.queryInterface, context.sequelize)
            };
          }
        },
        context: {
          sequelize: this.sequelize,
          queryInterface: this.sequelize.getQueryInterface()
        },
        storage: new SequelizeStorage({ sequelize: this.sequelize }),
        logger: this.logger
      });
      
      // Initialize Umzug for seeders
      this.umzugSeeder = new Umzug({
        migrations: {
          glob: path.join(this.seedersDir, '*.js'),
          resolve: ({ name, path, context }) => {
            const seeder = require(path);
            return {
              name,
              up: async () => seeder.up(context.queryInterface, context.sequelize),
              down: async () => seeder.down(context.queryInterface, context.sequelize)
            };
          }
        },
        context: {
          sequelize: this.sequelize,
          queryInterface: this.sequelize.getQueryInterface()
        },
        storage: new SequelizeStorage({ 
          sequelize: this.sequelize,
          tableName: 'sequelize_seeders'
        }),
        logger: this.logger
      });
      
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
      if (!this.umzug) {
        await this.initialize();
      }

      const pending = await this.umzug.pending();
      const executed = await this.umzug.executed();
      
      const pendingMigrations = pending.map(m => ({
        name: m.name,
        status: 'pending'
      }));
      
      const executedMigrations = executed.map(m => ({
        name: m.name,
        status: 'executed',
        executedAt: m.executedAt
      }));
      
      return [...executedMigrations, ...pendingMigrations];
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
      if (!this.umzug) {
        await this.initialize();
      }

      const migrations = await this.umzug.up();
      const migratedNames = migrations.map(m => m.name);
      
      if (migratedNames.length > 0) {
        this.logger.info(`Applied ${migratedNames.length} migrations: ${migratedNames.join(', ')}`);
      } else {
        this.logger.info('No migrations to apply');
      }
      
      return migratedNames;
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
      if (!this.umzug) {
        await this.initialize();
      }

      const migrations = await this.umzug.down();
      if (migrations.length > 0) {
        const migratedDown = migrations[0].name;
        this.logger.info(`Reverted migration: ${migratedDown}`);
        return migratedDown;
      } else {
        this.logger.info('No migrations to revert');
        return null;
      }
    } catch (error) {
      this.logger.error('Migration down failed', error);
      throw error;
    }
  }

  /**
   * Apply all pending seeders
   * @returns {Array} An array of applied seeder file names
   */
  async seed() {
    try {
      if (!this.umzugSeeder) {
        await this.initialize();
      }

      const seeders = await this.umzugSeeder.up();
      const seederNames = seeders.map(s => s.name);
      
      if (seederNames.length > 0) {
        this.logger.info(`Applied ${seederNames.length} seeders: ${seederNames.join(', ')}`);
      } else {
        this.logger.info('No seeders to apply');
      }
      
      return seederNames;
    } catch (error) {
      this.logger.error('Seeding failed', error);
      throw error;
    }
  }

  /**
   * Revert all seeders
   * @returns {Array} The names of the reverted seeders
   */
  async unseed() {
    try {
      if (!this.umzugSeeder) {
        await this.initialize();
      }

      const seeders = await this.umzugSeeder.down({ to: 0 });
      const seederNames = seeders.map(s => s.name);
      
      if (seederNames.length > 0) {
        this.logger.info(`Reverted ${seederNames.length} seeders: ${seederNames.join(', ')}`);
      } else {
        this.logger.info('No seeders to revert');
      }
      
      return seederNames;
    } catch (error) {
      this.logger.error('Unseeding failed', error);
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
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
      const fileName = `${timestamp}-${name.toLowerCase().replace(/\s+/g, '-')}.js`;
      const filePath = path.join(this.migrationsDir, fileName);
      
      // Create the migration file with a template
      const template = `'use strict';

/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // TODO: Implement the migration up
  },

  async down(queryInterface, Sequelize) {
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
   * Create a new seeder file
   * @param {String} name - The descriptive name for the seeder
   * @returns {String} The path to the created seeder file
   */
  createSeeder(name) {
    try {
      // Generate a timestamp for the seeder file name
      const timestamp = new Date().toISOString().replace(/[-T:\.Z]/g, '').substring(0, 14);
      const fileName = `${timestamp}-${name.toLowerCase().replace(/\s+/g, '-')}.js`;
      const filePath = path.join(this.seedersDir, fileName);
      
      // Create the seeder file with a template
      const template = `'use strict';

/**
 * Seeder: ${name}
 * Created: ${new Date().toISOString()}
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // TODO: Implement the seeder up
  },

  async down(queryInterface, Sequelize) {
    // TODO: Implement the seeder down
  }
};`;

      fs.writeFileSync(filePath, template);
      this.logger.info(`Created seeder file: ${fileName}`);
      
      return filePath;
    } catch (error) {
      this.logger.error('Failed to create seeder file', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
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