# Migration from MongoDB to PostgreSQL and S3 Storage

## Overview

This document outlines the steps taken to migrate the Landing Pad Digital AI Agents system from MongoDB to PostgreSQL for the database layer, AWS S3 for file storage, and ElastiCache for Redis as the caching layer.

## Completed Steps

1. Updated environment configuration:
   - Added PostgreSQL connection settings for development, staging, and production
   - Added S3 configuration for storage and uploads
   - Added ElastiCache Redis configuration
   - Consolidated environment files (removed duplicate env.example)
   - Updated environment-specific configuration in src/config/environments/

2. Updated package dependencies:
   - Removed MongoDB dependencies: `mongodb`, `mongoose`, `connect-mongo`, `migrate-mongo`
   - Added PostgreSQL dependencies: `pg`, `pg-hstore`, `sequelize`, `sequelize-cli`, `connect-pg-simple`
   - Added AWS S3 dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

3. Created database migration structure:
   - Set up Sequelize migrations directory
   - Created initial schema migration
   - Created Sequelize configuration file

4. Updated core services:
   - Replaced MongoDB-based `DatabaseService` with PostgreSQL-based implementation
   - Replaced file-based `StorageService` with S3-based implementation
   - Updated main configuration loader to use environment-specific settings

5. Updated environment documentation:
   - Modified `getting_started.md` to reflect PostgreSQL, S3, and Redis usage
   - Updated troubleshooting guide

## Pending Tasks

1. Convert MongoDB models to Sequelize models:
   - Update model files in `src/models` to use Sequelize ORM
   - Implement associations between models
   - Create data validation using Sequelize validators

2. Update API controllers and services:
   - Modify database access patterns to use Sequelize instead of Mongoose
   - Update error handling for PostgreSQL-specific errors

3. Update testing infrastructure:
   - Replace MongoDB in-memory server with PostgreSQL test DB
   - Update test fixtures for new database schema
   - Update mocks for S3 and Redis services

4. Database migration:
   - Create data migration script to transfer data from MongoDB to PostgreSQL
   - Validate data integrity after migration
   - Set up backup and rollback procedures

5. Update deployment configuration:
   - Modify Docker configuration to use PostgreSQL
   - Update AWS/deployment scripts for new infrastructure
   - Create database initialization scripts for production

6. Documentation:
   - Update all database-related documentation
   - Add S3 and Redis configuration documentation
   - Create operator guide for managing PostgreSQL database

## Environment Configuration

The application uses the following environment configuration system:

1. **Environment Variables**: The `.env` file (copied from `.env.example`) contains all configuration values that might change between environments or that are sensitive (credentials, API keys).

2. **Environment-Specific Configuration**: The `src/config/environments/` directory contains settings specific to each environment:
   - `development.js` - Local development settings
   - `production.js` - Production deployment settings
   - `staging.js` - Pre-production testing settings
   - `test.js` - Automated testing settings

3. **Configuration Loading**: The `src/config/index.js` file merges all configurations:
   - Loads default settings
   - Applies environment-specific overrides
   - Uses environment variables for sensitive data

### PostgreSQL Connection

```
# Local Development
DATABASE_URL=postgres://postgres:password@localhost:5432/agents_db
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=agents_db

# Production
PROD_DB_URL=postgres://postgres:password@landingpad-agents-prod.c0dcu2ywapx7.us-east-1.rds.amazonaws.com:5432/agents_db
PROD_DB_USER=postgres
PROD_DB_PASSWORD=password
PROD_DB_HOST=landingpad-agents-prod.c0dcu2ywapx7.us-east-1.rds.amazonaws.com
PROD_DB_PORT=5432
PROD_DB_NAME=agents_db

# Development/Staging
DEV_DB_URL=postgres://postgres:password@landingpad-agents-dev.c0dcu2ywapx7.us-east-1.rds.amazonaws.com:5432/agents_db
DEV_DB_USER=postgres
DEV_DB_PASSWORD=password
DEV_DB_HOST=landingpad-agents-dev.c0dcu2ywapx7.us-east-1.rds.amazonaws.com
DEV_DB_PORT=5432
DEV_DB_NAME=agents_db
```

### S3 Storage Configuration

```
# S3 Buckets
S3_BUCKET_PROD=landing-pad-ai-agents
S3_BUCKET_DEV=landing-pad-ai-agents-dev
S3_REGION=us-east-1
S3_STORAGE_PREFIX=storage
S3_UPLOADS_PREFIX=uploads

# S3 URLs
Production Storage: https://landing-pad-ai-agents.s3.us-east-1.amazonaws.com/storage/
Production Uploads: https://landing-pad-ai-agents.s3.us-east-1.amazonaws.com/uploads/
Development Storage: https://landing-pad-ai-agents-dev.s3.us-east-1.amazonaws.com/storage/
Development Uploads: https://landing-pad-ai-agents-dev.s3.us-east-1.amazonaws.com/uploads/
```

### Redis Configuration

```
# ElastiCache Redis
REDIS_PROD_URL=redis://landingpad-agents-prod-redis-4cdgsa.serverless.use1.cache.amazonaws.com:6379
REDIS_DEV_URL=redis://landingpad-agents-dev-redis-4cdgsa.serverless.use1.cache.amazonaws.com:6379
REDIS_LOCAL_URL=redis://localhost:6379
```