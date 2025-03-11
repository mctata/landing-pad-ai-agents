/**
 * Metric Model
 * Schema for content performance metrics
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for traffic source
const TrafficSourceSchema = new Schema({
  source: {
    type: String,
    required: true
  },
  visitors: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  }
}, { _id: false });

// Schema for device breakdown
const DeviceBreakdownSchema = new Schema({
  desktop: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  mobile: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  tablet: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

// Schema for daily traffic trend
const DailyTrafficSchema = new Schema({
  date: {
    type: Date,
    required: true
  },
  views: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Schema for scroll depth
const ScrollDepthSchema = new Schema({
  '25': {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  '50': {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  '75': {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  '100': {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, { _id: false });

// Schema for conversion by type
const ConversionTypeSchema = new Schema({
  type: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  },
  value: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Schema for conversion path
const ConversionPathSchema = new Schema({
  averageConversionSteps: {
    type: Number,
    min: 0,
    default: 0
  },
  averageTimeToConvert: {
    type: Number,
    min: 0,
    default: 0
  },
  topConversionPaths: [{
    path: String,
    percentage: Number
  }]
}, { _id: false });

// Schema for keyword ranking
const KeywordRankingSchema = new Schema({
  keyword: {
    type: String,
    required: true
  },
  position: {
    type: Number,
    min: 0
  },
  change: {
    type: Number,
    default: 0
  },
  searchVolume: {
    type: Number,
    min: 0,
    default: 0
  }
}, { _id: false });

// Schema for backlink
const BacklinkSchema = new Schema({
  domain: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  anchorText: {
    type: String
  },
  domainAuthority: {
    type: Number,
    min: 0,
    max: 100
  }
}, { _id: false });

// Schema for recommendation
const RecommendationSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['Content', 'CTA', 'SEO', 'Design', 'Technical']
  },
  suggestion: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  }
}, { _id: false });

// Schema for traffic
const TrafficSchema = new Schema({
  totalViews: {
    type: Number,
    default: 0
  },
  uniqueVisitors: {
    type: Number,
    default: 0
  },
  averageTimeOnPage: {
    type: Number,
    default: 0
  },
  bounceRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  exitRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  trafficSources: [TrafficSourceSchema],
  deviceBreakdown: DeviceBreakdownSchema,
  trafficTrend: [DailyTrafficSchema]
}, { _id: false });

// Schema for engagement
const EngagementSchema = new Schema({
  scrollDepth: ScrollDepthSchema,
  socialShares: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  internalLinkClicks: {
    type: Number,
    default: 0
  },
  externalLinkClicks: {
    type: Number,
    default: 0
  },
  downloadClicks: {
    type: Number,
    default: 0
  },
  videoPlays: {
    type: Number,
    default: 0
  },
  heatmapUrl: {
    type: String
  }
}, { _id: false });

// Schema for conversion
const ConversionSchema = new Schema({
  totalConversions: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  conversionsByType: [ConversionTypeSchema],
  primaryCTAClicks: {
    type: Number,
    default: 0
  },
  primaryCTAConversionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  secondaryCTAClicks: {
    type: Number,
    default: 0
  },
  secondaryCTAConversionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  conversionPath: ConversionPathSchema
}, { _id: false });

// Schema for SEO
const SeoSchema = new Schema({
  keywordRankings: [KeywordRankingSchema],
  organicImpressionsEstimate: {
    type: Number,
    default: 0
  },
  organicClicksEstimate: {
    type: Number,
    default: 0
  },
  estimatedOrganicCTR: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  backlinks: [BacklinkSchema]
}, { _id: false });

// Main Metric Schema
const MetricSchema = new Schema({
  performanceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  contentId: {
    type: String,
    required: true,
    index: true
  },
  contentType: {
    type: String,
    required: true,
    enum: ['BlogPost', 'SocialPost', 'WebsiteCopy', 'Email', 'LandingPage'],
    index: true
  },
  title: {
    type: String,
    required: true
  },
  url: {
    type: String
  },
  dateRange: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  traffic: TrafficSchema,
  engagement: EngagementSchema,
  conversions: ConversionSchema,
  seo: SeoSchema,
  recommendations: [RecommendationSchema],
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for contentId and date range
MetricSchema.index({ 
  contentId: 1, 
  'dateRange.start': 1,
  'dateRange.end': 1
});

/**
 * Generate performanceId
 * Static method to generate a unique performanceId
 */
MetricSchema.statics.generatePerformanceId = function() {
  const currentYear = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit number
  return `PERF-${currentYear}-${randomNum}`;
};

const Metric = mongoose.model('Metric', MetricSchema);

module.exports = Metric;