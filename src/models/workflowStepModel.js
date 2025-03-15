/**
 * WorkflowStep Model
 * Schema for workflow steps
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class WorkflowStep extends BaseModel {
  // Define model attributes
  static attributes = {
    stepId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    workflowId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'workflows',
        key: 'workflowId'
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('manual', 'automatic', 'approval'),
      allowNull: false,
      defaultValue: 'automatic'
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped'),
      allowNull: false,
      defaultValue: 'pending'
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    config: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    result: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    assignedTo: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true
    }
  };

  // Model options
  static options = {
    tableName: 'workflow_steps',
    timestamps: true,
    indexes: [
      {
        fields: ['stepId']
      },
      {
        fields: ['workflowId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['order']
      },
      {
        fields: ['assignedTo']
      },
      {
        fields: ['workflowId', 'status'],
        name: 'workflow_steps_workflow_status_idx'
      },
      {
        fields: ['workflowId', 'order'],
        name: 'workflow_steps_workflow_order_idx'
      }
    ]
  };

  /**
   * Generate a unique step ID
   * @returns {string} - Unique step ID
   */
  static generateStepId() {
    return this.generateUniqueId('STP');
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    WorkflowStep.belongsTo(models.Workflow, { foreignKey: 'workflowId', targetKey: 'workflowId' });
    WorkflowStep.belongsTo(models.User, { foreignKey: 'assignedTo', targetKey: 'userId', as: 'assignee' });
    // Add other associations as needed
  }
}

module.exports = WorkflowStep;