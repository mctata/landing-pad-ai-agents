'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create a function to automatically update the updated_at timestamp
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION update_modified_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create triggers for each table with updated_at
    const tables = [
      'users',
      'agents',
      'contents',
      'briefs',
      'brand_guidelines',
      'workflows',
      'api_keys',
      'metrics',
      'reports',
      'schedules'
    ];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        CREATE TRIGGER update_${table}_modified
        BEFORE UPDATE ON ${table}
        FOR EACH ROW
        EXECUTE FUNCTION update_modified_column();
      `);
    }
  },

  async down(queryInterface, Sequelize) {
    // Drop triggers for each table
    const tables = [
      'users',
      'agents',
      'contents',
      'briefs',
      'brand_guidelines',
      'workflows',
      'api_keys',
      'metrics',
      'reports',
      'schedules'
    ];

    for (const table of tables) {
      await queryInterface.sequelize.query(`
        DROP TRIGGER IF EXISTS update_${table}_modified ON ${table};
      `);
    }

    // Drop the function
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS update_modified_column();
    `);
  }
};