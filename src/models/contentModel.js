/**
 * Content Model
 * Schema for content items
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ContentSchema = new Schema({
  contentId: {
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['blog', 'social', 'website', 'email', 'landing_page'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: Schema.Types.Mixed,
    required: true
  },
  meta_description: {
    type: String,
    trim: true
  },
  keywords: [{
    type: String,
    trim: true
  }],
  categories: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true,
    index: true
  }],
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'published', 'archived', 'deleted'],
    default: 'draft',
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  slug: {
    type: String,
    trim: true
  },
  url: {
    type: String,
    trim: true
  },
  featuredImage: {
    type: String,
    trim: true
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
  },
  publishedBy: {
    type: String
  },
  publishedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Text index for search
ContentSchema.index({ 
  title: 'text', 
  'content.body': 'text', 
  meta_description: 'text',
  keywords: 'text'
});

// Pre-save hook to update the version number
ContentSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Create slug from title
ContentSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  }
  next();
});

/**
 * Generate contentId
 * Static method to generate a unique contentId
 */
ContentSchema.statics.generateContentId = function() {
  const timestamp = new Date().getTime().toString(36);
  const randomChars = Math.random().toString(36).substring(2, 7);
  return `CNT-${timestamp}${randomChars}`.toUpperCase();
};

const Content = mongoose.model('Content', ContentSchema);

module.exports = Content;