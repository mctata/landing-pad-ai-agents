# PostgreSQL Optimization Guide

This document outlines the PostgreSQL optimizations implemented in this project to maximize database performance, reliability, and maintenance.

## Key Optimizations

### 1. Full-Text Search

Implemented native PostgreSQL full-text search using:
- `tsvector` column for efficient search indexing
- GIN indexes for fast text search
- Automatic search vector updates via triggers
- Custom ranking for search results

### 2. Data Modeling Improvements

- Converted JSONB array fields to proper relational tables (workflow steps)
- Added optimized foreign key constraints with appropriate cascade behaviors
- Implemented efficient time-based triggers
- Consistent data versioning for content

### 3. Performance Indexes

- Compound indexes for common query patterns (e.g., type+status)
- JSONB-specific GIN indexes for array fields (tags, categories)
- Partial indexes to reduce index size (e.g., exclude deleted records)
- Functional indexes for case-insensitive searches

### 4. Transaction Support

- Added proper transaction management for data consistency
- Implemented managed transactions with automatic rollback on error
- Support for nested transactions
- Batch operation support for data migrations

### 5. Connection Pooling

- Optimized connection pool settings based on environment
- Separate pools for read/write operations
- Automatic connection timeout handling
- Health monitoring for connection pool

### 6. Monitoring and Health Checks

- Database health monitoring with Prometheus metrics
- Connection pool statistics
- Query performance tracking
- Automatic health status reporting via API

### 7. Autovacuum and Maintenance

- Custom autovacuum settings for high-traffic tables
- Regular database statistics analysis
- Automated index maintenance
- Performance monitoring

## Available Scripts

- `npm run db:optimize` - Run all PostgreSQL optimizations
- `npm run migrate:search` - Add full-text search capabilities
- `npm run migrate:indexes` - Add performance indexes
- `npm run migrate:workflow-steps` - Migrate workflow steps to relational table
- `npm run db:analyze` - Run database analysis for query optimization

## API Endpoints

- `GET /api/health` - Basic health check
- `GET /api/status` - System status including database health
- `GET /api/system/database/health` - Detailed database health metrics
- `GET /api/metrics` - Prometheus-compatible metrics (internal network only)

## Implementation Details

### Search Vector Trigger

```sql
CREATE OR REPLACE FUNCTION update_content_search_vector()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  -- Extract text from JSONB content field
  IF NEW.content IS NULL THEN
    content_text := '';
  ELSIF jsonb_typeof(NEW.content) = 'string' THEN
    content_text := NEW.content::TEXT;
  ELSIF jsonb_typeof(NEW.content) = 'object' THEN
    -- Try to extract text fields commonly used in our content structure
    content_text := '';
    
    -- Append body field if it exists
    IF NEW.content ? 'body' THEN
      IF jsonb_typeof(NEW.content->'body') = 'string' THEN
        content_text := content_text || ' ' || (NEW.content->>'body');
      END IF;
    END IF;
    
    -- More fields extraction here...
  END IF;
  
  -- Combine all searchable text
  NEW.search_vector := to_tsvector('english', 
    coalesce(NEW.title, '') || ' ' || 
    content_text || ' ' || 
    coalesce(NEW.meta_description, '') || ' ' || 
    array_to_string(NEW.keywords, ' ') || ' ' || 
    array_to_string(NEW.categories, ' ') || ' ' || 
    array_to_string(NEW.tags, ' ')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Performance Considerations

1. **Batch Operations:** Always use batch operations for large data sets
2. **Proper Indexing:** Create indexes based on actual query patterns
3. **Transaction Management:** Use transactions for data consistency
4. **Connection Pooling:** Configure pool size based on workload
5. **Regular Maintenance:** Run ANALYZE regularly to update statistics
6. **Monitor Performance:** Use the built-in monitoring tools

## Future Improvements

- Add read replica support for scaling read operations
- Implement connection pooling with PgBouncer for high-load environments
- Add partitioning for time-series metrics data
- Implement custom caching layer for frequently accessed data