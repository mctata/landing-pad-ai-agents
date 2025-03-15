'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    console.log('Running database analysis for query optimization...');
    
    // Analyze the database for better query planning
    await queryInterface.sequelize.query('ANALYZE VERBOSE');
    
    console.log('Database analysis completed');
    
    // Update PostgreSQL statistics for better query planning
    const tables = [
      'users', 
      'contents', 
      'content_versions', 
      'briefs', 
      'workflows', 
      'workflow_steps',
      'brand_guidelines',
      'metrics',
      'sessions'
    ];
    
    for (const table of tables) {
      try {
        console.log(`Updating statistics for ${table}...`);
        await queryInterface.sequelize.query(`ANALYZE ${table}`);
      } catch (error) {
        console.error(`Error updating statistics for ${table}: ${error.message}`);
      }
    }
    
    // Set autovacuum parameters for high-traffic tables
    const highTrafficTables = ['sessions', 'contents', 'metrics', 'content_versions'];
    
    for (const table of highTrafficTables) {
      try {
        console.log(`Setting autovacuum parameters for ${table}...`);
        await queryInterface.sequelize.query(`
          ALTER TABLE ${table} SET (
            autovacuum_vacuum_scale_factor = 0.05,
            autovacuum_analyze_scale_factor = 0.025,
            autovacuum_vacuum_threshold = 50,
            autovacuum_analyze_threshold = 50
          )
        `);
      } catch (error) {
        console.error(`Error setting autovacuum parameters for ${table}: ${error.message}`);
      }
    }
    
    console.log('Database optimization completed');
  },

  async down (queryInterface, Sequelize) {
    // Reset autovacuum parameters for high-traffic tables
    const highTrafficTables = ['sessions', 'contents', 'metrics', 'content_versions'];
    
    for (const table of highTrafficTables) {
      try {
        console.log(`Resetting autovacuum parameters for ${table}...`);
        await queryInterface.sequelize.query(`
          ALTER TABLE ${table} RESET (
            autovacuum_vacuum_scale_factor,
            autovacuum_analyze_scale_factor,
            autovacuum_vacuum_threshold,
            autovacuum_analyze_threshold
          )
        `);
      } catch (error) {
        console.error(`Error resetting autovacuum parameters for ${table}: ${error.message}`);
      }
    }
  }
};