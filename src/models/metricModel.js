/**
 * Metric Model
 * Schema for content performance metrics
 */

const { DataTypes } = require('sequelize');
const BaseModel = require('./baseModel');

class Metric extends BaseModel {
  // Define model attributes
  static attributes = {
    performanceId: {
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
      type: DataTypes.ENUM('BlogPost', 'SocialPost', 'WebsiteCopy', 'Email', 'LandingPage'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dateRange: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        start: null,
        end: null
      }
    },
    // Using JSONB for complex nested structures
    traffic: {
      type: DataTypes.JSONB,
      defaultValue: {
        totalViews: 0,
        uniqueVisitors: 0,
        averageTimeOnPage: 0,
        bounceRate: 0,
        exitRate: 0,
        trafficSources: [],
        deviceBreakdown: {
          desktop: 0,
          mobile: 0,
          tablet: 0
        },
        trafficTrend: []
      }
    },
    engagement: {
      type: DataTypes.JSONB,
      defaultValue: {
        scrollDepth: {
          '25': 0,
          '50': 0,
          '75': 0,
          '100': 0
        },
        socialShares: 0,
        comments: 0,
        internalLinkClicks: 0,
        externalLinkClicks: 0,
        downloadClicks: 0,
        videoPlays: 0,
        heatmapUrl: null
      }
    },
    conversions: {
      type: DataTypes.JSONB,
      defaultValue: {
        totalConversions: 0,
        conversionRate: 0,
        conversionsByType: [],
        primaryCTAClicks: 0,
        primaryCTAConversionRate: 0,
        secondaryCTAClicks: 0,
        secondaryCTAConversionRate: 0,
        conversionPath: {
          averageConversionSteps: 0,
          averageTimeToConvert: 0,
          topConversionPaths: []
        }
      }
    },
    seo: {
      type: DataTypes.JSONB,
      defaultValue: {
        keywordRankings: [],
        organicImpressionsEstimate: 0,
        organicClicksEstimate: 0,
        estimatedOrganicCTR: 0,
        backlinks: []
      }
    },
    recommendations: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false
    }
  };

  // Model options
  static options = {
    tableName: 'metrics',
    timestamps: true,
    indexes: [
      {
        fields: ['performanceId']
      },
      {
        fields: ['contentId']
      },
      {
        fields: ['contentType']
      },
      {
        fields: ['createdAt']
      },
      {
        fields: [{ attribute: 'dateRange', operator: 'jsonb_path_ops' }]
      }
    ]
  };

  /**
   * Generate a unique performance ID
   * @returns {string} - Unique performance ID
   */
  static generatePerformanceId() {
    return this.generateUniqueId('PERF');
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    Metric.belongsTo(models.Content, { foreignKey: 'contentId', targetKey: 'contentId' });
  }
}

module.exports = Metric;