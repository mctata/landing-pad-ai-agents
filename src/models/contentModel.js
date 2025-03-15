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
    },
    search_vector: {
      type: DataTypes.TSVECTOR,
      allowNull: true
    }
  };

  // Model options
  static options = {
    tableName: 'contents',
    timestamps: true,
    hooks: {
      beforeSave: async (content, options) => {
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
        
        // Update search vector for full-text search
        if (content.changed('title') || content.changed('content') || content.changed('meta_description') || 
            content.changed('keywords') || content.changed('categories') || content.changed('tags') || 
            content.isNewRecord) {
          
          // Extract text from JSONB content if it's a string or has specific text fields
          let contentText = '';
          if (typeof content.content === 'string') {
            contentText = content.content;
          } else if (content.content && typeof content.content === 'object') {
            // Handle different content structures based on content type
            if (content.content.body) contentText += ' ' + content.content.body;
            if (content.content.text) contentText += ' ' + content.content.text;
            if (content.content.description) contentText += ' ' + content.content.description;
          }
          
          // Combine all searchable text
          const searchableText = [
            content.title || '',
            contentText,
            content.meta_description || '',
            (content.keywords || []).join(' '),
            (content.categories || []).join(' '),
            (content.tags || []).join(' ')
          ].join(' ');
          
          // Use PostgreSQL to update the search vector
          if (options.transaction) {
            await options.transaction.sequelize.query(
              `UPDATE contents SET search_vector = to_tsvector('english', $1) WHERE "contentId" = $2`,
              { 
                bind: [searchableText, content.contentId],
                transaction: options.transaction
              }
            );
          } else {
            // If we're not in a transaction, we'll rely on afterSave hook
            content.searchableText = searchableText;
          }
        }
      },
      afterSave: async (content, options) => {
        // Update search vector if not done in transaction
        if (content.searchableText && !options.transaction) {
          await content.sequelize.query(
            `UPDATE contents SET search_vector = to_tsvector('english', $1) WHERE "contentId" = $2`,
            { 
              bind: [content.searchableText, content.contentId] 
            }
          );
          delete content.searchableText;
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
      },
      {
        fields: ['slug']
      },
      {
        fields: ['publishedAt']
      },
      {
        name: 'contents_search_vector_idx',
        using: 'GIN',
        fields: ['search_vector']
      },
      {
        name: 'contents_type_status_idx',
        fields: ['type', 'status']
      },
      {
        name: 'contents_tags_idx',
        using: 'GIN',
        fields: ['tags']
      },
      {
        name: 'contents_categories_idx',
        using: 'GIN',
        fields: ['categories']
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