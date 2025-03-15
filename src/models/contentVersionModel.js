/**
 * Content Version Model
 * Schema for content version history
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class ContentVersion extends BaseModel {
  // Define model attributes
  static attributes = {
    versionId: {
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
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1
      }
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    changes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    }
  };

  // Model options
  static options = {
    tableName: 'content_versions',
    timestamps: true,
    updatedAt: false, // Only need createdAt for versions
    indexes: [
      {
        fields: ['contentId']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['contentId', 'version'],
        unique: true
      }
    ]
  };

  /**
   * Generate a unique version ID
   * @returns {string} - Unique version ID
   */
  static generateVersionId() {
    return this.generateUniqueId('VER');
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    ContentVersion.belongsTo(models.Content, { foreignKey: 'contentId', targetKey: 'contentId' });
  }
}

module.exports = ContentVersion;