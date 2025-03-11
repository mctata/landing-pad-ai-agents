/**
 * Brand Guideline Model
 * Schema for brand guidelines
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for company name
const CompanyNameSchema = new Schema({
  fullName: {
    type: String,
    required: true
  },
  shortName: {
    type: String,
    required: true
  },
  abbreviation: {
    type: String
  },
  trademarkSymbol: {
    type: Boolean,
    default: false
  },
  firstMentionFormat: {
    type: String
  },
  subsequentMentionFormat: {
    type: String
  }
}, { _id: false });

// Schema for product names
const ProductNameSchema = new Schema({
  fullName: {
    type: String,
    required: true
  },
  shortName: {
    type: String
  },
  incorrectVariations: [String],
  useCase: {
    type: String
  }
}, { _id: false });

// Schema for voice examples
const VoiceExampleSchema = new Schema({
  good: {
    type: String,
    required: true
  },
  bad: {
    type: String,
    required: true
  },
  explanation: {
    type: String
  }
}, { _id: false });

// Schema for voice
const VoiceSchema = new Schema({
  personality: {
    type: String,
    required: true
  },
  tone: {
    type: String,
    required: true
  },
  attributes: [String],
  examples: [VoiceExampleSchema]
}, { _id: false });

// Schema for preferred terms
const PreferredTermSchema = new Schema({
  term: {
    type: String,
    required: true
  },
  alternatives: {
    type: String
  },
  avoidTerms: {
    type: String
  },
  context: {
    type: String
  }
}, { _id: false });

// Schema for industry terms
const IndustryTermSchema = new Schema({
  term: {
    type: String,
    required: true
  },
  definition: {
    type: String,
    required: true
  },
  abbreviation: {
    type: String
  },
  firstUse: {
    type: String
  }
}, { _id: false });

// Schema for terminology
const TerminologySchema = new Schema({
  preferredTerms: [PreferredTermSchema],
  industryTerms: [IndustryTermSchema]
}, { _id: false });

// Main Brand Guideline Schema
const BrandGuidelineSchema = new Schema({
  guidelineId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  version: {
    type: String,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  companyName: CompanyNameSchema,
  productNames: [ProductNameSchema],
  voice: VoiceSchema,
  terminology: TerminologySchema,
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String,
    required: true
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

/**
 * Generate guidelineId
 * Static method to generate a unique guidelineId
 */
BrandGuidelineSchema.statics.generateGuidelineId = function() {
  const currentYear = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit number
  return `BRAND-${currentYear}-${randomNum}`;
};

const BrandGuideline = mongoose.model('BrandGuideline', BrandGuidelineSchema);

module.exports = BrandGuideline;