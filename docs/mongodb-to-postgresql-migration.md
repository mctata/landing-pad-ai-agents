# MongoDB to PostgreSQL Migration Guide

This document provides detailed instructions for migrating the Landing Pad AI Agents platform from MongoDB to PostgreSQL.

## Overview

The migration consists of three main phases:
1. **Schema Creation**: Creating the PostgreSQL database schema (tables, constraints, etc.)
2. **Data Migration**: Transferring data from MongoDB to PostgreSQL
3. **Application Updates**: Modifying the application code to use PostgreSQL

## Prerequisites

- Node.js v18+
- MongoDB database with existing data
- PostgreSQL 14+ database server
- Access to both databases

## Phase 1: Schema Creation

The PostgreSQL schema has already been created using Sequelize migrations. These migrations:
- Create PostgreSQL enum types
- Create tables with appropriate columns and constraints
- Establish foreign key relationships
- Create indices for performance
- Set up automatic timestamp updating with triggers

### Run Migrations

Execute the following commands to create the schema:

```bash
# Run migrations to create schema
npm run migrate:up

# Verify migrations status
npm run migrate:status

# Seed initial data
npm run seed:up
```

## Phase 2: Data Migration

We've created a comprehensive data migration tool that:
- Reads data from MongoDB collections
- Transforms documents to fit PostgreSQL schema
- Preserves IDs and relationships
- Handles arrays, embedded documents, and other MongoDB-specific structures
- Maintains created/updated timestamps

### Before Migration

1. **Backup Both Databases**:
   ```bash
   # MongoDB backup
   mongodump --uri "mongodb://username:password@host:port/database" --out ./mongo-backup
   
   # PostgreSQL backup
   pg_dump -h hostname -U username -d database > pg_backup.sql
   ```

2. **Configure Environment Variables**:
   Update the `.env` file with connection details for both databases:
   ```
   # MongoDB
   MONGODB_URI=mongodb://username:password@localhost:27017
   MONGODB_DB_NAME=landing_pad_ai_agents
   
   # PostgreSQL
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=agents_db
   DB_USER=postgres
   DB_PASSWORD=password
   DB_SSL=false
   ```

3. **Test Run**:
   Perform a dry run to verify everything works without actually writing data:
   ```bash
   npm run migrate:data:dry-run
   ```

### Execute Migration

1. **Run Full Migration**:
   ```bash
   npm run migrate:data
   ```

2. **Migration with Verbose Logging**:
   For more detailed logs:
   ```bash
   npm run migrate:data:verbose
   ```

3. **Migrate Specific Collection**:
   If you need to target a specific collection:
   ```bash
   npm run migrate:data:collection -- --collection=users
   ```

### Verify Migration

After migration, verify the data integrity:

1. **Count Records**:
   Compare record counts between MongoDB and PostgreSQL:
   ```sql
   -- PostgreSQL
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM contents;
   SELECT COUNT(*) FROM workflows;
   -- etc.
   ```

2. **Check Relationships**:
   Verify foreign key relationships are maintained:
   ```sql
   -- Example: Check content-brief relationships
   SELECT c.content_id, c.title, b.brief_id, b.title 
   FROM contents c
   JOIN briefs b ON c.brief_id = b.brief_id;
   ```

3. **Inspect Sample Data**:
   Review sample records to ensure data was mapped correctly.

## Phase 3: Application Updates

Update the application to use PostgreSQL and Sequelize:

1. **Switch Connection**:
   Update environment variables to use PostgreSQL connection string.

2. **Use Sequelize Models**:
   ```javascript
   // Old MongoDB code
   const user = await db.collection('users').findOne({ userId });
   
   // New Sequelize code
   const user = await User.findOne({ where: { userId } });
   ```

3. **Handle Transactions**:
   ```javascript
   // Sequelize transaction example
   const transaction = await sequelize.transaction();
   try {
     // Operations within transaction
     await User.create({ /* user data */ }, { transaction });
     await Content.create({ /* content data */ }, { transaction });
     
     await transaction.commit();
   } catch (error) {
     await transaction.rollback();
     throw error;
   }
   ```

4. **Update Queries**:
   ```javascript
   // MongoDB query
   const docs = await collection.find({ status: 'active', type: 'blog' }).sort({ createdAt: -1 }).limit(10);
   
   // Sequelize query
   const docs = await Content.findAll({
     where: { 
       status: 'active',
       type: 'blog'
     },
     order: [['createdAt', 'DESC']],
     limit: 10
   });
   ```

## Rollback Procedure

If issues arise, follow these steps to rollback:

1. **Stop the Application**:
   ```bash
   npm run stop
   ```

2. **Restore PostgreSQL Database**:
   ```bash
   psql -h hostname -U username -d database -f pg_backup.sql
   ```

3. **Switch Back to MongoDB**:
   Update configuration to use MongoDB.

4. **Restart the Application**:
   ```bash
   npm run start
   ```

## Common Issues and Solutions

### Data Type Conversion

- **ObjectId to String**: MongoDB ObjectIds are converted to strings
- **Date Objects**: Ensure dates are properly converted to PostgreSQL timestamp format
- **JSONB fields**: Complex nested structures are stored in JSONB fields

### Performance Considerations

- **Indexing**: Verify indices are created for commonly queried fields
- **Query Optimization**: PostgreSQL queries may need optimization
- **Connection Pooling**: Configure proper connection pool settings

### Foreign Key Constraints

- **Referential Integrity**: PostgreSQL enforces foreign key constraints
- **ON DELETE/UPDATE Actions**: Set appropriate cascade or restrict actions
- **Null References**: Handle null foreign key references

## Monitoring and Logging

After migration, monitor application performance and database operations:

- Check PostgreSQL logs for errors or slow queries
- Monitor application response times
- Watch for increased error rates

## Conclusion

This migration transforms our database from document-oriented MongoDB to relational PostgreSQL, providing:

- Better data integrity through constraints
- More powerful querying capabilities
- Better schema enforcement
- Improved transaction support

The migration scripts and tools created for this process can be reused and extended for future database operations.