/**
 * Content Version Model
 * Schema for content version history
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ContentVersionSchema = new Schema({
  contentId: {
    type: String,
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true,
    min: 1
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  changes: {
    type: [String],
    default: []
  },
  reason: {
    type: String,
    trim: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for contentId and version
ContentVersionSchema.index({ contentId: 1, version: 1 }, { unique: true });

const ContentVersion = mongoose.model('ContentVersion', ContentVersionSchema);

module.exports = ContentVersion;