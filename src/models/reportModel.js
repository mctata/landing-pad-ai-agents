/**
 * Report Model
 * Schema for analytics reports
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Report extends BaseModel {
  // Define model attributes
  static attributes = {
    reportId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM(
        'content_performance',
        'audience_insights',
        'channel_performance',
        'seo_performance',
        'conversion_analysis',
        'executive_summary',
        'custom'
      ),
      allowNull: false
    },
    dateRange: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        start: null,
        end: null
      }
    },
    contentIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    sections: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    topInsights: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    recommendations: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    sharing: {
      type: DataTypes.JSONB,
      defaultValue: {
        isPublic: false,
        accessCode: null,
        expiration: null
      }
    },
    scheduledDelivery: {
      type: DataTypes.JSONB,
      defaultValue: {
        isScheduled: false,
        frequency: null,
        recipients: [],
        nextDelivery: null
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
    tableName: 'reports',
    timestamps: true,
    indexes: [
      {
        fields: ['reportId']
      },
      {
        fields: ['type']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: [{ attribute: 'dateRange', operator: 'jsonb_path_ops' }]
      },
      {
        fields: [{ attribute: 'contentIds' }]
      },
      {
        fields: [{ attribute: 'scheduledDelivery', operator: 'jsonb_path_ops' }]
      }
    ]
  };

  /**
   * Generate a unique report ID
   * @returns {string} - Unique report ID
   */
  static generateReportId() {
    const currentYear = new Date().getFullYear();
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 9000) + 1000; // 4-digit number
    return `RPT-${currentYear}${currentMonth}-${randomNum}`;
  }

  /**
   * Define associations with other models
   * @param {Object} _models - All registered models
   */
  static associate(_models) {
    // Can create a many-to-many association with Content through a junction table
    // or use the ARRAY of contentIds for simplicity
  }
}

module.exports = Report;