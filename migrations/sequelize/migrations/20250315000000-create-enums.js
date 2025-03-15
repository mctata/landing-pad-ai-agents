'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create enum types for all status fields and other constrained values
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_agent_status" AS ENUM ('active', 'inactive', 'error');
      CREATE TYPE "enum_user_status" AS ENUM ('active', 'inactive', 'pending', 'locked');
      CREATE TYPE "enum_content_status" AS ENUM ('draft', 'review', 'published', 'archived', 'scheduled');
      CREATE TYPE "enum_brief_status" AS ENUM ('draft', 'in_progress', 'completed', 'cancelled');
      CREATE TYPE "enum_workflow_status" AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');
      CREATE TYPE "enum_api_key_status" AS ENUM ('active', 'inactive', 'revoked');
    `);
  },

  async down(queryInterface, Sequelize) {
    // Drop enum types in reverse order
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS "enum_api_key_status";
      DROP TYPE IF EXISTS "enum_workflow_status";
      DROP TYPE IF EXISTS "enum_brief_status";
      DROP TYPE IF EXISTS "enum_content_status";
      DROP TYPE IF EXISTS "enum_user_status";
      DROP TYPE IF EXISTS "enum_agent_status";
    `);
  }
};