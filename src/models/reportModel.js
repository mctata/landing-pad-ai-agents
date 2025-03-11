/**
 * Report Model
 * Schema for analytics reports
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for report sections
const ReportSectionSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  chartType: {
    type: String,
    enum: [
      'bar', 'line', 'pie', 'table', 'heatmap', 
      'radar', 'scatter', 'summary', 'custom'
    ]
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  insights: [String],
  recommendations: [String],
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Main Report Schema
const ReportSchema = new Schema({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  type: {
    type: String,
    required: true,
    enum: [
      'content_performance', 
      'audience_insights', 
      'channel_performance', 
      'seo_performance', 
      'conversion_analysis',
      'executive_summary',
      'custom'
    ],
    index: true
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
  contentIds: [{
    type: String,
    index: true
  }],
  sections: [ReportSectionSchema],
  summary: {
    type: String
  },
  topInsights: [String],
  recommendations: [String],
  sharing: {
    isPublic: {
      type: Boolean,
      default: false
    },
    accessCode: {
      type: String
    },
    expiration: {
      type: Date
    }
  },
  scheduledDelivery: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    recipients: [String],
    nextDelivery: {
      type: Date
    }
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
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

// Compound indexes
ReportSchema.index({ type: 1, 'dateRange.start': 1, 'dateRange.end': 1 });
ReportSchema.index({ 'scheduledDelivery.isScheduled': 1, 'scheduledDelivery.nextDelivery': 1 });

/**
 * Generate reportId
 * Static method to generate a unique reportId
 */
ReportSchema.statics.generateReportId = function() {
  const currentYear = new Date().getFullYear();
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const randomNum = Math.floor(Math.random() * 9000) + 1000; // 4-digit number
  return `RPT-${currentYear}${currentMonth}-${randomNum}`;
};

const Report = mongoose.model('Report', ReportSchema);

module.exports = Report;