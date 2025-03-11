/**
 * Schedule Model
 * Schema for content publication schedules
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for publication platform details
const PlatformDetailsSchema = new Schema({
  platformId: {
    type: String,
    required: true
  },
  platformName: {
    type: String,
    required: true
  },
  account: {
    type: String
  },
  targetUrl: {
    type: String
  },
  customSettings: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// Main Schedule Schema
const ScheduleSchema = new Schema({
  scheduleId: {
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
    enum: ['blog', 'social', 'website', 'email', 'landing_page'],
    index: true
  },
  title: {
    type: String,
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },
  publishDate: {
    type: Date,
    index: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'published', 'failed', 'cancelled', 'draft'],
    default: 'scheduled',
    index: true
  },
  platforms: [PlatformDetailsSchema],
  recurrence: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'monthly'],
    default: 'none'
  },
  recurrenceEndDate: {
    type: Date
  },
  publishedUrl: {
    type: String
  },
  publishError: {
    type: String
  },
  workflowId: {
    type: String,
    index: true
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
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes
ScheduleSchema.index({ scheduledDate: 1, status: 1 });
ScheduleSchema.index({ contentId: 1, 'platforms.platformId': 1 });

/**
 * Generate scheduleId
 * Static method to generate a unique scheduleId
 */
ScheduleSchema.statics.generateScheduleId = function() {
  const timestamp = new Date().getTime().toString(36);
  const randomChars = Math.random().toString(36).substring(2, 5);
  return `SCH-${timestamp}${randomChars}`.toUpperCase();
};

const Schedule = mongoose.model('Schedule', ScheduleSchema);

module.exports = Schedule;