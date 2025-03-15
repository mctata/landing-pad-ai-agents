/**
 * Content Model
 * Schema for content items
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Content extends BaseModel {
  // Define model attributes
  static attributes = {
    contentId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.ENUM('blog', 'social', 'website', 'email', 'landing_page'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    content: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    meta_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    keywords: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    categories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending_review', 'approved', 'published', 'archived', 'deleted'),
      defaultValue: 'draft'
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    featuredImage: {
      type: DataTypes.STRING,
      allowNull: true
    },
    authorId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    publishedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  };

  // Model options
  static options = {
    tableName: 'contents',
    timestamps: true,
    hooks: {
      beforeSave: (content) => {
        // Update version number on save
        if (content.changed() && !content.isNewRecord) {
          content.version += 1;
        }
        
        // Create slug from title
        if (content.changed('title') || !content.slug) {
          content.slug = content.title
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
        }
      }
    },
    indexes: [
      {
        fields: ['contentId']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: ['updatedAt']
      },
      {
        fields: ['authorId']
      }
    ]
  };

  /**
   * Generate a unique content ID
   * @returns {string} - Unique content ID
   */
  static generateContentId() {
    return this.generateUniqueId('CNT');
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    Content.belongsTo(models.User, { foreignKey: 'authorId', targetKey: 'userId', as: 'author' });
    Content.hasMany(models.ContentVersion, { foreignKey: 'contentId', sourceKey: 'contentId' });
    // Add other associations as needed
  }
}

module.exports = Content;