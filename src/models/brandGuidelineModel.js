/**
 * Brand Guideline Model
 * Schema for brand guidelines
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class BrandGuideline extends BaseModel {
  // Define model attributes
  static attributes = {
    guidelineId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    // Using JSONB for nested structures
    companyName: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        fullName: '',
        shortName: '',
        abbreviation: '',
        trademarkSymbol: false,
        firstMentionFormat: '',
        subsequentMentionFormat: ''
      }
    },
    productNames: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    voice: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        personality: '',
        tone: '',
        attributes: [],
        examples: []
      }
    },
    terminology: {
      type: DataTypes.JSONB,
      defaultValue: {
        preferredTerms: [],
        industryTerms: []
      }
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false
    }
  };

  // Model options
  static options = {
    tableName: 'brand_guidelines',
    timestamps: true,
    indexes: [
      {
        fields: ['guidelineId']
      },
      {
        fields: ['version']
      },
      {
        fields: ['lastUpdated']
      }
    ]
  };

  /**
   * Generate a unique guideline ID
   * @returns {string} - Unique guideline ID
   */
  static generateGuidelineId() {
    return this.generateUniqueId('BRAND');
  }

  /**
   * Define associations with other models
   * @param {Object} _models - All registered models
   */
  static associate(_models) {
    // Define associations if needed
  }
}

module.exports = BrandGuideline;