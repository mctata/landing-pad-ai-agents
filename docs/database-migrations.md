# Database Migrations

This document explains the database migration system for the Landing Pad AI Agents project.

## Overview

The migration system uses `migrate-mongo` to manage database schema changes in a controlled and versioned manner. This allows for:

- Tracking applied migrations
- Applying pending migrations
- Reverting migrations if needed
- Creating new migration scripts

## Migration Files

Migration files are stored in the `migrations/scripts` directory and follow the format:

```
YYYYMMDDHHMMSS-descriptive-name.js
```

Each migration file exports two functions:
- `up`: Code to apply the migration
- `down`: Code to revert the migration

Example migration file:

```javascript
module.exports = {
  async up(db, client) {
    // Apply changes
    await db.collection('users').updateMany({}, { $set: { newField: 'defaultValue' } });
  },

  async down(db, client) {
    // Revert changes
    await db.collection('users').updateMany({}, { $unset: { newField: '' } });
  }
};
```

## Available Commands

The following npm scripts are available for managing migrations:

- `npm run migrate:status`: Show the status of all migrations
- `npm run migrate:up`: Apply all pending migrations
- `npm run migrate:down`: Revert the most recently applied migration
- `npm run migrate:create "description"`: Create a new migration file

## Creating a New Migration

To create a new migration, run:

```bash
npm run migrate:create "add user roles"
```

This will create a new migration file in the `migrations/scripts` directory with a timestamp and the provided description.

## Best Practices

1. **Always test migrations**: Test both the `up` and `down` functions in a development environment before deploying.

2. **Make migrations idempotent**: Migrations should be safe to run multiple times without causing errors or duplicate data.

3. **Small, focused migrations**: Keep each migration focused on a specific change rather than bundling multiple changes together.

4. **Include both up and down methods**: Always implement both the `up` and `down` methods to allow for reverting if needed.

5. **Use transactions when possible**: For operations that modify multiple collections, use transactions to ensure atomicity.

6. **Check before modifying**: Use checks to verify the state before making changes:

   ```javascript
   // Check if the field exists before trying to modify it
   const hasField = await db.collection('users').findOne({ newField: { $exists: true } });
   if (!hasField) {
     await db.collection('users').updateMany({}, { $set: { newField: 'defaultValue' } });
   }
   ```

7. **Document migrations**: Add comments in the migration files explaining what changes are being made and why.

## Example Migrations

### Adding a New Field

```javascript
module.exports = {
  async up(db, client) {
    // Add a new field to all documents in the users collection
    await db.collection('users').updateMany({}, { $set: { lastLoginTimestamp: null } });
  },

  async down(db, client) {
    // Remove the field from all documents
    await db.collection('users').updateMany({}, { $unset: { lastLoginTimestamp: '' } });
  }
};
```

### Creating a New Index

```javascript
module.exports = {
  async up(db, client) {
    // Create a new index on the lastLoginTimestamp field
    await db.collection('users').createIndex({ lastLoginTimestamp: 1 });
  },

  async down(db, client) {
    // Drop the index
    await db.collection('users').dropIndex({ lastLoginTimestamp: 1 });
  }
};
```

### Renaming a Field

```javascript
module.exports = {
  async up(db, client) {
    // Rename the field from oldName to newName
    await db.collection('contents').updateMany({}, { $rename: { 'oldName': 'newName' } });
  },

  async down(db, client) {
    // Rename back from newName to oldName
    await db.collection('contents').updateMany({}, { $rename: { 'newName': 'oldName' } });
  }
};
```

## Troubleshooting

### Migration Failing to Apply

If a migration fails during the `up` method, you'll need to manually fix the database state before trying again. The migration system tracks which migrations have been applied in the `migrations_changelog` collection.

### Migration Failing to Revert

If a migration fails during the `down` method, you'll need to manually fix the database state. You can also manually modify the `migrations_changelog` collection to mark a migration as not applied.

### Viewing Applied Migrations

To view which migrations have been applied, you can check the `migrations_changelog` collection in the database:

```javascript
db.migrations_changelog.find().sort({ timestamp: -1 })
```

Or use the command:

```bash
npm run migrate:status
```