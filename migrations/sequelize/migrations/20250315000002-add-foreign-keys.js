'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add foreign key for Brief -> Content relationship
    await queryInterface.addConstraint('contents', {
      fields: ['brief_id'],
      type: 'foreign key',
      name: 'fk_content_brief',
      references: {
        table: 'briefs',
        field: 'brief_id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for Content -> ContentVersion relationship
    await queryInterface.addConstraint('content_versions', {
      fields: ['content_id'],
      type: 'foreign key',
      name: 'fk_content_version_content',
      references: {
        table: 'contents',
        field: 'content_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for User -> ApiKey relationship
    await queryInterface.addConstraint('api_keys', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_api_key_user',
      references: {
        table: 'users',
        field: 'user_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for Brief -> Workflow relationship
    await queryInterface.addConstraint('workflows', {
      fields: ['brief_id'],
      type: 'foreign key',
      name: 'fk_workflow_brief',
      references: {
        table: 'briefs',
        field: 'brief_id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for Content -> Workflow relationship
    await queryInterface.addConstraint('workflows', {
      fields: ['content_id'],
      type: 'foreign key',
      name: 'fk_workflow_content',
      references: {
        table: 'contents',
        field: 'content_id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for Content -> Metric relationship
    await queryInterface.addConstraint('metrics', {
      fields: ['content_id'],
      type: 'foreign key',
      name: 'fk_metric_content',
      references: {
        table: 'contents',
        field: 'content_id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for User -> Notification relationship
    await queryInterface.addConstraint('notifications', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_notification_user',
      references: {
        table: 'users',
        field: 'user_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for Content -> Schedule relationship
    await queryInterface.addConstraint('schedules', {
      fields: ['content_id'],
      type: 'foreign key',
      name: 'fk_schedule_content',
      references: {
        table: 'contents',
        field: 'content_id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Add foreign key for Workflow -> Schedule relationship
    await queryInterface.addConstraint('schedules', {
      fields: ['workflow_id'],
      type: 'foreign key',
      name: 'fk_schedule_workflow',
      references: {
        table: 'workflows',
        field: 'workflow_id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove all foreign keys in reverse order
    await queryInterface.removeConstraint('schedules', 'fk_schedule_workflow');
    await queryInterface.removeConstraint('schedules', 'fk_schedule_content');
    await queryInterface.removeConstraint('notifications', 'fk_notification_user');
    await queryInterface.removeConstraint('metrics', 'fk_metric_content');
    await queryInterface.removeConstraint('workflows', 'fk_workflow_content');
    await queryInterface.removeConstraint('workflows', 'fk_workflow_brief');
    await queryInterface.removeConstraint('api_keys', 'fk_api_key_user');
    await queryInterface.removeConstraint('content_versions', 'fk_content_version_content');
    await queryInterface.removeConstraint('contents', 'fk_content_brief');
  }
};