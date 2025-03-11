/**
 * Brief Model
 * Schema for content briefs
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for target keywords
const TargetKeywordSchema = new Schema({
  keyword: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['Primary', 'Secondary', 'Tertiary'],
    default: 'Secondary'
  },
  searchVolume: {
    type: Number,
    min: 0
  },
  difficulty: {
    type: Number,
    min: 0,
    max: 100
  }
}, { _id: false });

// Schema for target audience
const TargetAudienceSchema = new Schema({
  primary: {
    type: String,
    required: true,
    trim: true
  },
  secondary: {
    type: String,
    trim: true
  },
  excludes: {
    type: String,
    trim: true
  },
  demographics: {
    type: Map,
    of: String
  },
  painPoints: [String]
}, { _id: false });

// Schema for content goals
const ContentGoalsSchema = new Schema({
  primary: {
    type: String,
    required: true,
    trim: true
  },
  secondary: [String],
  kpis: [String]
}, { _id: false });

// Schema for outline sections
const OutlineSectionSchema = new Schema({
  section: {
    type: String,
    required: true,
    trim: true
  },
  keyPoints: [String]
}, { _id: false });

// Schema for format
const FormatSchema = new Schema({
  length: {
    min: Number,
    max: Number,
    target: Number
  },
  structure: String,
  formatting: String,
  images: String
}, { _id: false });

// Schema for call to action
const CallToActionSchema = new Schema({
  primary: {
    type: String,
    required: true,
    trim: true
  },
  secondary: {
    type: String,
    trim: true
  },
  url: {
    primary: String,
    secondary: String
  }
}, { _id: false });

// Schema for deadlines
const DeadlineSchema = new Schema({
  draft: {
    type: Date,
    required: true
  },
  publication: {
    type: Date
  }
}, { _id: false });

// Schema for references
const ReferenceSchema = new Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    trim: true
  }
}, { _id: false });

// Main Brief Schema
const BriefSchema = new Schema({
  briefId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  contentType: {
    type: String,
    required: true,
    enum: ['BlogPost', 'SocialPost', 'WebsiteCopy', 'Email', 'LandingPage'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Draft', 'Assigned', 'InProgress', 'Completed', 'Cancelled'],
    default: 'Draft',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  targetKeywords: [TargetKeywordSchema],
  targetAudience: TargetAudienceSchema,
  contentGoals: ContentGoalsSchema,
  outline: [OutlineSectionSchema],
  tone: {
    type: String,
    trim: true
  },
  format: FormatSchema,
  callToAction: CallToActionSchema,
  deadline: DeadlineSchema,
  assignedTo: {
    type: String,
    trim: true
  },
  additionalNotes: {
    type: String,
    trim: true
  },
  references: [ReferenceSchema],
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
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  resultingContentId: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Text index for search
BriefSchema.index({ 
  title: 'text', 
  'targetKeywords.keyword': 'text',
  'targetAudience.primary': 'text',
  additionalNotes: 'text'
});

/**
 * Generate briefId
 * Static method to generate a unique briefId
 */
BriefSchema.statics.generateBriefId = function() {
  const currentYear = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit number
  return `BRIEF-${currentYear}-${randomNum}`;
};

const Brief = mongoose.model('Brief', BriefSchema);

module.exports = Brief;