/**
 * Workflow Model
 * Schema for content workflows
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Workflow extends BaseModel {
  // Define model attributes
  static attributes = {
    workflowId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
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
      type: DataTypes.ENUM('content_creation', 'content_optimization', 'brand_check', 'publication', 'reporting'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending'
    },
    contentId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'contents',
        key: 'contentId'
      }
    },
    briefId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'briefs',
        key: 'briefId'
      }
    },
    steps: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    currentStep: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      validate: {
        min: 1,
        max: 10
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  };

  // Model options
  static options = {
    tableName: 'workflows',
    timestamps: true,
    indexes: [
      {
        fields: ['workflowId']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['contentId']
      },
      {
        fields: ['briefId']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['contentId', 'type']
      }
    ]
  };

  /**
   * Generate a unique workflow ID
   * @returns {string} - Unique workflow ID
   */
  static generateWorkflowId() {
    return this.generateUniqueId('WF');
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    Workflow.belongsTo(models.Content, { foreignKey: 'contentId', targetKey: 'contentId' });
    Workflow.belongsTo(models.Brief, { foreignKey: 'briefId', targetKey: 'briefId' });
  }
}

module.exports = Workflow;