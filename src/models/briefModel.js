/**
 * Brief Model
 * Schema for content briefs
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Brief extends BaseModel {
  // Define model attributes
  static attributes = {
    briefId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    contentType: {
      type: DataTypes.ENUM('BlogPost', 'SocialPost', 'WebsiteCopy', 'Email', 'LandingPage'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('Draft', 'Assigned', 'InProgress', 'Completed', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Draft'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Using JSONB for nested structures
    targetKeywords: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    targetAudience: {
      type: DataTypes.JSONB,
      defaultValue: {
        primary: '',
        secondary: '',
        excludes: '',
        demographics: {},
        painPoints: []
      }
    },
    contentGoals: {
      type: DataTypes.JSONB,
      defaultValue: {
        primary: '',
        secondary: [],
        kpis: []
      }
    },
    outline: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    tone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    format: {
      type: DataTypes.JSONB,
      defaultValue: {
        length: {
          min: null,
          max: null,
          target: null
        },
        structure: '',
        formatting: '',
        images: ''
      }
    },
    callToAction: {
      type: DataTypes.JSONB,
      defaultValue: {
        primary: '',
        secondary: '',
        url: {
          primary: '',
          secondary: ''
        }
      }
    },
    deadline: {
      type: DataTypes.JSONB,
      defaultValue: {
        draft: null,
        publication: null
      }
    },
    assignedTo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    additionalNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    references: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    resultingContentId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'contents',
        key: 'contentId'
      }
    }
  };

  // Model options
  static options = {
    tableName: 'briefs',
    timestamps: true,
    indexes: [
      {
        fields: ['briefId']
      },
      {
        fields: ['contentType']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['resultingContentId']
      },
      {
        fields: ['assignedTo']
      }
    ]
  };

  /**
   * Generate a unique brief ID
   * @returns {string} - Unique brief ID
   */
  static generateBriefId() {
    const currentYear = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit number
    return `BRIEF-${currentYear}-${randomNum}`;
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    Brief.belongsTo(models.Content, { foreignKey: 'resultingContentId', targetKey: 'contentId', as: 'resultingContent' });
    // Add other associations as needed
  }
}

module.exports = Brief;