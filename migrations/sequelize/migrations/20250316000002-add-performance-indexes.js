'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Indexes for faster queries on common patterns
    
    // Contents table indexes for frequent access patterns
    await queryInterface.addIndex('contents', ['type', 'status'], {
      name: 'contents_type_status_index',
      where: "status <> 'deleted'"
    });
    
    await queryInterface.addIndex('contents', ['authorId', 'createdAt'], {
      name: 'contents_author_date_index'
    });
    
    await queryInterface.addIndex('contents', ['updatedAt'], {
      name: 'contents_updated_index'
    });
    
    await queryInterface.addIndex('contents', ['slug'], {
      name: 'contents_slug_index',
      unique: true,
      where: "slug IS NOT NULL"
    });
    
    await queryInterface.addIndex('contents', {
      name: 'contents_jsonb_tags_index',
      fields: ['tags'],
      using: 'GIN'
    });
    
    await queryInterface.addIndex('contents', {
      name: 'contents_jsonb_categories_index',
      fields: ['categories'],
      using: 'GIN'
    });
    
    // Users table indexes
    await queryInterface.addIndex('users', ['email'], {
      name: 'users_email_index'
    });
    
    await queryInterface.addIndex('users', ['status'], {
      name: 'users_status_index',
      where: "status <> 'deleted'"
    });
    
    // Workflows table indexes
    await queryInterface.addIndex('workflows', ['status', 'createdAt'], {
      name: 'workflows_status_date_index'
    });
    
    await queryInterface.addIndex('workflows', ['contentId', 'status'], {
      name: 'workflows_content_status_index'
    });
    
    await queryInterface.addIndex('workflows', ['updatedAt'], {
      name: 'workflows_updated_index'
    });
    
    // Brand guidelines indexes
    await queryInterface.addIndex('brand_guidelines', ['createdAt'], {
      name: 'brand_guidelines_date_index'
    });
    
    // Briefs indexes
    await queryInterface.addIndex('briefs', ['status', 'createdAt'], {
      name: 'briefs_status_date_index'
    });
    
    // ContentVersion indexes
    await queryInterface.addIndex('content_versions', ['contentId', 'version'], {
      name: 'content_versions_content_version_index'
    });
    
    // Metrics indexes
    await queryInterface.addIndex('metrics', ['contentId', 'createdAt'], {
      name: 'metrics_content_date_index'
    });
    
    // Add partial index for active session management
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "sessions_expire_idx" ON "sessions" ("expire") 
      WHERE "expire" > NOW()
    `);
  },

  async down (queryInterface, Sequelize) {
    // Remove indexes in reverse order
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "sessions_expire_idx"`);
    
    await queryInterface.removeIndex('metrics', 'metrics_content_date_index');
    await queryInterface.removeIndex('content_versions', 'content_versions_content_version_index');
    await queryInterface.removeIndex('briefs', 'briefs_status_date_index');
    await queryInterface.removeIndex('brand_guidelines', 'brand_guidelines_date_index');
    await queryInterface.removeIndex('workflows', 'workflows_updated_index');
    await queryInterface.removeIndex('workflows', 'workflows_content_status_index');
    await queryInterface.removeIndex('workflows', 'workflows_status_date_index');
    await queryInterface.removeIndex('users', 'users_status_index');
    await queryInterface.removeIndex('users', 'users_email_index');
    await queryInterface.removeIndex('contents', 'contents_jsonb_categories_index');
    await queryInterface.removeIndex('contents', 'contents_jsonb_tags_index');
    await queryInterface.removeIndex('contents', 'contents_slug_index');
    await queryInterface.removeIndex('contents', 'contents_updated_index');
    await queryInterface.removeIndex('contents', 'contents_author_date_index');
    await queryInterface.removeIndex('contents', 'contents_type_status_index');
  }
};