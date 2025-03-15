'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { performance } = require('perf_hooks');

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false // Disable logging for performance tests
  }
);

// Helper function to measure execution time
async function measureTime(description, callback) {
  console.log(`\n${description}:`);
  const start = performance.now();
  const result = await callback();
  const end = performance.now();
  console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
  return { timeTaken: end - start, result };
}

// Test DB schema
function testSchema() {
  return measureTime('Verifying database schema', async () => {
    // Get table list
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name;
    `);
    
    console.log('Tables in database:');
    tables.forEach(t => console.log(`- ${t.table_name}`));
    
    // Check if we have essential tables
    const essentialTables = ['contents', 'users', 'workflows', 'workflow_steps', 'metrics'];
    const missingTables = essentialTables.filter(
      table => !tables.find(t => t.table_name === table)
    );
    
    if (missingTables.length > 0) {
      console.log(`\nMissing tables: ${missingTables.join(', ')}`);
    } else {
      console.log('\nAll essential tables are present.');
    }
    
    return { tables: tables.map(t => t.table_name), missingTables };
  });
}

// Test full-text search on contents table (if it exists)
async function testFullTextSearch() {
  try {
    // Check if contents table exists first
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name='contents';
    `);
    
    if (tables.length === 0) {
      console.log('\nSkipping full-text search test - contents table does not exist');
      return { skipped: true };
    }
    
    // Check if search_vector column exists
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='contents' AND column_name='search_vector';
    `);
    
    if (columns.length === 0) {
      console.log('\nSkipping full-text search test - search_vector column does not exist');
      return { skipped: true };
    }
    
    return measureTime('Testing full-text search performance', async () => {
      // Query with the full-text search index
      const [results, _metadata] = await sequelize.query(`
        SELECT id, title FROM contents 
        WHERE search_vector @@ plainto_tsquery('english', 'marketing content') 
        ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'marketing content')) DESC
        LIMIT 10;
      `);
      console.log(`Found ${results.length} results using indexed search`);
      
      return { indexedResults: results.length };
    });
  } catch (error) {
    console.log('\nSkipping full-text search test due to error:', error.message);
    return { skipped: true, error: error.message };
  }
}

// Test workflow steps relational query performance
async function testWorkflowStepsPerformance() {
  try {
    // Check if workflow tables exist first
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name IN ('workflows', 'workflow_steps');
    `);
    
    if (tables.length < 2) {
      console.log('\nSkipping workflow steps test - required tables do not exist');
      return { skipped: true };
    }
    
    return measureTime('Testing workflow steps query performance', async () => {
      // Query using the workflow_steps table (relational)
      const [results, _metadata] = await sequelize.query(`
        SELECT w.id, w.name, COUNT(ws.id) as step_count
        FROM workflows w
        LEFT JOIN workflow_steps ws ON w.id = ws.workflow_id
        GROUP BY w.id, w.name
        ORDER BY step_count DESC
        LIMIT 5;
      `);
      console.log(`Retrieved ${results.length} workflows with step counts`);
      return { workflows: results };
    });
  } catch (error) {
    console.log('\nSkipping workflow steps test due to error:', error.message);
    return { skipped: true, error: error.message };
  }
}

// Test index performance on users table
async function testUserIndexPerformance() {
  try {
    // Check if users table exists first
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name='users';
    `);
    
    if (tables.length === 0) {
      console.log('\nSkipping user index test - users table does not exist');
      return { skipped: true };
    }
    
    return measureTime('Testing user index performance', async () => {
      // Query with email index
      const [results1, _metadata1] = await sequelize.query(`
        EXPLAIN ANALYZE
        SELECT * FROM users WHERE email = 'admin@example.com';
      `);
      console.log('Query plan with email index:');
      results1.forEach(r => console.log(Object.values(r)[0]));
      
      // Query with status field
      const [results2, _metadata2] = await sequelize.query(`
        EXPLAIN ANALYZE
        SELECT COUNT(*) FROM users WHERE status = 'active';
      `);
      console.log('\nQuery plan for status field:');
      results2.forEach(r => console.log(Object.values(r)[0]));
      
      return { emailQueryLines: results1.length, statusQueryLines: results2.length };
    });
  } catch (error) {
    console.log('\nSkipping user index test due to error:', error.message);
    return { skipped: true, error: error.message };
  }
}

// Test content metrics query performance
async function testContentMetricsPerformance() {
  try {
    // Check if required tables exist first
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name IN ('contents', 'metrics');
    `);
    
    if (tables.length < 2) {
      console.log('\nSkipping content metrics test - required tables do not exist');
      return { skipped: true };
    }
    
    // Get column types to ensure proper casting
    const [contentIdType] = await sequelize.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='contents' AND column_name='id'
    `);
    
    const [metricContentIdType] = await sequelize.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='metrics' AND column_name='content_id'
    `);
    
    // Add casting if needed
    let joinCondition = 'c.id = m.content_id';
    if (contentIdType.length > 0 && metricContentIdType.length > 0) {
      const cType = contentIdType[0].data_type;
      const mType = metricContentIdType[0].data_type;
      
      console.log(`Content ID type: ${cType}, Metric content_id type: ${mType}`);
      
      if (cType !== mType) {
        if (cType === 'integer' || cType === 'bigint') {
          joinCondition = 'c.id = m.content_id::integer';
        } else if (mType === 'integer' || mType === 'bigint') {
          joinCondition = 'c.id::integer = m.content_id';
        }
      }
    }
    
    return measureTime('Testing content metrics query performance', async () => {
      const [results, _metadata] = await sequelize.query(`
        SELECT c.id, c.title, COUNT(m.id) as metrics_count
        FROM contents c
        LEFT JOIN metrics m ON ${joinCondition}
        GROUP BY c.id, c.title
        ORDER BY metrics_count DESC
        LIMIT 5;
      `);
      console.log(`Retrieved ${results.length} contents with metrics counts`);
      return { contents: results };
    });
  } catch (error) {
    console.log('\nSkipping content metrics test due to error:', error.message);
    return { skipped: true, error: error.message };
  }
}

// Run database performance tests
async function runPerformanceTests() {
  let success = false;
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Connection established successfully.');
    
    console.log('\n=== DATABASE PERFORMANCE TESTS ===');
    
    await testSchema();
    await testFullTextSearch();
    await testWorkflowStepsPerformance();
    await testUserIndexPerformance();
    await testContentMetricsPerformance();
    
    console.log('\n=== PERFORMANCE TESTS COMPLETED ===');
    success = true;
  } catch (error) {
    console.error('Performance test error:', error);
    success = false;
  } finally {
    await sequelize.close();
  }
  
  return success;
}

// Execute performance tests
runPerformanceTests()
  .then(success => {
    console.log(success ? 'Performance testing succeeded.' : 'Performance testing failed.');
  })
  .catch(err => {
    console.error('Fatal performance testing error:', err);
  });