/**
 * Schedule Model
 * Schema for content publication schedules
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Schedule extends BaseModel {
  // Define model attributes
  static attributes = {
    scheduleId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    contentId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'contents',
        key: 'contentId'
      }
    },
    contentType: {
      type: DataTypes.ENUM('blog', 'social', 'website', 'email', 'landing_page'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    scheduledDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    publishDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'published', 'failed', 'cancelled', 'draft'),
      defaultValue: 'scheduled'
    },
    platforms: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    recurrence: {
      type: DataTypes.ENUM('none', 'daily', 'weekly', 'monthly'),
      defaultValue: 'none'
    },
    recurrenceEndDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    publishedUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    publishError: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    workflowId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'workflows',
        key: 'workflowId'
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
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
    tableName: 'schedules',
    timestamps: true,
    indexes: [
      {
        fields: ['scheduleId']
      },
      {
        fields: ['contentId']
      },
      {
        fields: ['contentType']
      },
      {
        fields: ['scheduledDate']
      },
      {
        fields: ['publishDate']
      },
      {
        fields: ['status']
      },
      {
        fields: ['workflowId']
      },
      {
        fields: ['scheduledDate', 'status']
      },
      {
        fields: [{ attribute: 'platforms', operator: 'jsonb_path_ops' }]
      }
    ]
  };

  /**
   * Generate a unique schedule ID
   * @returns {string} - Unique schedule ID
   */
  static generateScheduleId() {
    return this.generateUniqueId('SCH');
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    Schedule.belongsTo(models.Content, { foreignKey: 'contentId', targetKey: 'contentId' });
    Schedule.belongsTo(models.Workflow, { foreignKey: 'workflowId', targetKey: 'workflowId' });
  }
}

module.exports = Schedule;