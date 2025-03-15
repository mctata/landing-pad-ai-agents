'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Create ENUM types for workflow step statuses
    await queryInterface.sequelize.query(`
      CREATE TYPE enum_workflow_step_type AS ENUM ('manual', 'automatic', 'approval');
      CREATE TYPE enum_workflow_step_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'skipped');
    `);
    
    // Create workflow_steps table
    await queryInterface.createTable('workflow_steps', {
      stepId: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true
      },
      workflowId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'workflows',
          key: 'workflowId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      type: {
        type: 'enum_workflow_step_type',
        allowNull: false,
        defaultValue: 'automatic'
      },
      status: {
        type: 'enum_workflow_step_status',
        allowNull: false,
        defaultValue: 'pending'
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      config: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      result: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      assignedTo: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'users',
          key: 'userId'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdBy: {
        type: Sequelize.STRING,
        allowNull: false
      },
      updatedBy: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    
    // Add indexes for workflow steps table
    await queryInterface.addIndex('workflow_steps', ['stepId']);
    await queryInterface.addIndex('workflow_steps', ['workflowId']);
    await queryInterface.addIndex('workflow_steps', ['status']);
    await queryInterface.addIndex('workflow_steps', ['order']);
    await queryInterface.addIndex('workflow_steps', ['assignedTo']);
    await queryInterface.addIndex('workflow_steps', ['workflowId', 'status'], {
      name: 'workflow_steps_workflow_status_idx'
    });
    await queryInterface.addIndex('workflow_steps', ['workflowId', 'order'], {
      name: 'workflow_steps_workflow_order_idx'
    });
    
    // Add currentStepId to workflows table
    await queryInterface.addColumn('workflows', 'currentStepId', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove currentStepId from workflows table
    await queryInterface.removeColumn('workflows', 'currentStepId');
    
    // Drop workflow_steps table
    await queryInterface.dropTable('workflow_steps');
    
    // Drop ENUM types
    await queryInterface.sequelize.query(`
      DROP TYPE enum_workflow_step_type;
      DROP TYPE enum_workflow_step_status;
    `);
  }
};