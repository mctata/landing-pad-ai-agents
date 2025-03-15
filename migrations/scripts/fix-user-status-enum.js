'use strict';

module.exports = {
  async up(queryInterface, _Sequelize) {
    try {
      // Create the ENUM type if it doesn't exist
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_status') THEN
            CREATE TYPE enum_users_status AS ENUM ('active', 'inactive', 'suspended', 'pending', 'locked');
          END IF;
        END
        $$;
      `);

      // Alter the column to use the ENUM type
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ALTER COLUMN status TYPE enum_users_status 
        USING status::enum_users_status;
      `);

      // Set default value to 'active'
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ALTER COLUMN status SET DEFAULT 'active'::enum_users_status;
      `);

      console.log('Successfully migrated users.status to ENUM type');
    } catch (error) {
      console.error('Error migrating users.status:', error);
      throw error;
    }
  },

  async down(queryInterface, _Sequelize) {
    try {
      // Convert back to STRING
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ALTER COLUMN status TYPE VARCHAR 
        USING status::VARCHAR;
      `);

      // Set default value back to 'active' string
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ALTER COLUMN status SET DEFAULT 'active';
      `);

      console.log('Successfully reverted users.status to VARCHAR type');
    } catch (error) {
      console.error('Error reverting users.status:', error);
      throw error;
    }
  }
};