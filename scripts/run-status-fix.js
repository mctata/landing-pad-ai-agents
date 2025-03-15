'use strict';

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Create Sequelize instance from environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  }
);

async function fixUserStatusEnum() {
  let success = false;
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    
    // Step 1: Drop the default constraint
    console.log('Dropping default constraint from status column...');
    await sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN status DROP DEFAULT;
    `);
    
    // Step 2: Create the enum type if it doesn't exist
    console.log('Creating enum type if needed...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_status') THEN
          CREATE TYPE enum_users_status AS ENUM ('active', 'inactive', 'suspended', 'pending', 'locked');
        END IF;
      END
      $$;
    `);
    
    // Step 3: Convert all existing values to match enum values
    console.log('Ensuring all status values match the enum values...');
    await sequelize.query(`
      UPDATE users
      SET status = 'active'
      WHERE status NOT IN ('active', 'inactive', 'suspended', 'pending', 'locked');
    `);
    
    // Step 4: Convert the column type
    console.log('Converting column to enum type...');
    await sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN status TYPE enum_users_status 
      USING status::enum_users_status;
    `);
    
    // Step 5: Add the default constraint back
    console.log('Setting default value on status column...');
    await sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN status SET DEFAULT 'active'::enum_users_status;
    `);
    
    console.log('Successfully fixed users.status column');
    success = true;
  } catch (error) {
    console.error('Error fixing users.status:', error);
    success = false;
  } finally {
    await sequelize.close();
  }
  
  return success;
}

// Execute the migration
fixUserStatusEnum()
  .then(success => {
    console.log(success ? 'Migration process succeeded.' : 'Migration process failed.');
  })
  .catch(err => {
    console.error('Fatal migration error:', err);
  });