# Database Migrations

This directory contains the database migration system for the Landing Pad AI Agents project.

## Directory Structure

- `migrate-mongo-config.js` - Configuration file for the migrate-mongo tool
- `scripts/` - Directory containing migration scripts
  - `20250311000000-initial-schema.js` - Initial schema migration
  - `20250311020000-add-content-analytics-fields.js` - Adds analytics fields to content model
  - (additional migration scripts will be added here)

## Quick Commands

- Check migration status: `npm run migrate:status`
- Apply pending migrations: `npm run migrate:up`
- Revert last migration: `npm run migrate:down`
- Create new migration: `npm run migrate:create "description-of-change"`

## Migration File Format

Each migration file follows this structure:

```javascript
module.exports = {
  async up(db, client) {
    // Code to apply the migration
  },

  async down(db, client) {
    // Code to revert the migration
  }
};
```

## Automatic Migrations

The database initialization script (`scripts/db-init.js`) automatically applies pending migrations when it runs. This ensures that the database schema is always up to date.

## Manual Migrations

Migrations can also be run manually using the provided npm scripts. This is useful during development or when troubleshooting issues.

## Additional Information

For more details on using the migration system, please refer to the [database-migrations.md](../docs/database-migrations.md) document in the docs directory.