# MongoDB to PostgreSQL Data Migration

This directory contains scripts to migrate data from MongoDB to PostgreSQL as part of the database migration project.

## Overview

The migration process reads data from MongoDB collections and writes it to PostgreSQL tables. It handles data transformation, relationship mapping, and ensures data integrity in the new relational database structure.

## Prerequisites

- Node.js v18 or later
- MongoDB database with existing data
- PostgreSQL database with schema already created
- Environment variables configured for both database connections

## Environment Configuration

Create or update your `.env` file with the following variables:

```
# MongoDB Connection
MONGODB_URI=mongodb://username:password@localhost:27017
MONGODB_DB_NAME=landing_pad_ai_agents

# PostgreSQL Connection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agents_db
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false
```

## Migration Scripts

The migration is organized into modules:

1. **migrate-data.js**: Main entry point that orchestrates the migration process
2. **utils.js**: Utility functions for data transformation and batch insertion
3. **migrations/**: Individual migration modules for each collection

## Migration Process

The migration follows this process:

1. Connect to both MongoDB and PostgreSQL databases
2. For each collection, in dependency order:
   - Read documents from MongoDB
   - Transform documents to match PostgreSQL schema
   - Insert records into PostgreSQL tables
3. Generate a summary report of migration results

## Running the Migration

Several npm scripts are available to run the migration:

### Dry Run

This will simulate the migration without writing to PostgreSQL:

```
npm run migrate:data:dry-run
```

### Full Migration

To run the complete migration:

```
npm run migrate:data
```

### Verbose Mode

For detailed logging:

```
npm run migrate:data:verbose
```

### Migrate Specific Collection

To migrate only a specific collection:

```
npm run migrate:data:collection users
```

Replace `users` with the collection name you want to migrate.

## Migration Order and Dependencies

Collections are migrated in the following order to maintain data integrity:

1. users
2. agents
3. brand_guidelines
4. briefs
5. contents
6. content_versions
7. workflows
8. api_keys
9. metrics

## Verifying Migration

After migration, verify the data in PostgreSQL:

1. Check record counts match between MongoDB and PostgreSQL
2. Verify relationships are maintained
3. Test application functionality with the new database

## Troubleshooting

If you encounter issues:

- Check error logs for specific failures
- Verify database connections and permissions
- Ensure MongoDB collections exist and have data
- Check PostgreSQL schema matches expected structure

## Rollback

If necessary, you can:

1. Delete migrated PostgreSQL data: `npm run migrate:reset`
2. Reapply schema: `npm run migrate:up`
3. Fix issues and retry migration