#!/usr/bin/env node

/**
 * Migration CLI Commands for Landing Pad Digital AI Content Agents
 * 
 * This script provides a command-line interface for managing database migrations.
 * It supports checking migration status, applying migrations, reverting migrations,
 * and creating new migration files.
 */

require('dotenv').config();
const MigrationService = require('../common/services/migrationService');
const Logger = require('../common/services/logger');

// Create logger for CLI commands
const logger = new Logger('MigrationCLI');

// Initialize the migration service
const migrationService = new MigrationService();

/**
 * Print the usage information for the migration commands
 */
function printUsage() {
  console.log(`
Migration Commands for Landing Pad Digital AI Content Agents

Usage:
  node migration-commands.js <command> [options]

Commands:
  status                  Show status of all migrations
  up                      Apply all pending migrations
  down                    Revert the most recently applied migration
  create <name>           Create a new migration file
  help                    Show this help message

Examples:
  node migration-commands.js status
  node migration-commands.js up
  node migration-commands.js down
  node migration-commands.js create "add user roles"
  `);
}

/**
 * Process the command line arguments and execute the appropriate command
 */
async function processCommand() {
  try {
    // Get the command from the command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command || command === 'help') {
      printUsage();
      process.exit(0);
    }

    // Initialize the migration service
    await migrationService.initialize();

    // Execute the requested command
    switch (command) {
      case 'status':
        await showStatus();
        break;
      case 'up':
        await runMigrations();
        break;
      case 'down':
        await revertMigration();
        break;
      case 'create':
        await createMigration(args[1]);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }

    // Close the database connection
    await migrationService.close();
  } catch (error) {
    logger.error('Command execution failed', error);
    process.exit(1);
  }
}

/**
 * Show the status of all migrations
 */
async function showStatus() {
  try {
    const status = await migrationService.status();
    
    console.log('\nMigration Status:');
    console.log('=================\n');
    
    if (status.length === 0) {
      console.log('No migrations found.');
      return;
    }

    // Group migrations by status
    const applied = status.filter(m => m.appliedAt);
    const pending = status.filter(m => !m.appliedAt);
    
    // Display applied migrations
    if (applied.length > 0) {
      console.log('Applied Migrations:');
      applied.forEach(m => {
        console.log(`  ✅ ${m.fileName} (applied at: ${new Date(m.appliedAt).toLocaleString()})`);
      });
      console.log('');
    }
    
    // Display pending migrations
    if (pending.length > 0) {
      console.log('Pending Migrations:');
      pending.forEach(m => {
        console.log(`  ⏳ ${m.fileName}`);
      });
      console.log('');
    }
    
    // Summary
    console.log(`Total migrations: ${status.length} (${applied.length} applied, ${pending.length} pending)`);
  } catch (error) {
    logger.error('Failed to get migration status', error);
    throw error;
  }
}

/**
 * Apply all pending migrations
 */
async function runMigrations() {
  try {
    console.log('\nApplying migrations...\n');
    const migrated = await migrationService.up();
    
    if (migrated.length > 0) {
      console.log('\nSuccessfully applied the following migrations:');
      migrated.forEach(file => {
        console.log(`  ✅ ${file}`);
      });
      console.log(`\nTotal: ${migrated.length} migration(s) applied.`);
    } else {
      console.log('No migrations to apply. Database is up to date.');
    }
  } catch (error) {
    logger.error('Failed to apply migrations', error);
    throw error;
  }
}

/**
 * Revert the most recently applied migration
 */
async function revertMigration() {
  try {
    console.log('\nReverting the most recent migration...\n');
    const migratedDown = await migrationService.down();
    
    if (migratedDown) {
      console.log(`\nSuccessfully reverted migration: ✅ ${migratedDown}`);
    } else {
      console.log('No migrations to revert. No migrations have been applied yet.');
    }
  } catch (error) {
    logger.error('Failed to revert migration', error);
    throw error;
  }
}

/**
 * Create a new migration file
 * @param {String} name - The descriptive name for the migration
 */
async function createMigration(name) {
  try {
    if (!name) {
      console.error('Error: Migration name is required');
      console.log('Example: node migration-commands.js create "add user roles"');
      process.exit(1);
    }
    
    const filePath = migrationService.createMigration(name);
    console.log(`\nCreated new migration file: ${filePath}`);
  } catch (error) {
    logger.error('Failed to create migration file', error);
    throw error;
  }
}

// Run the command processor
processCommand();