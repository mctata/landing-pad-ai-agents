/**
 * User Model
 * Schema for user accounts
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  roles: {
    type: [String],
    enum: ['admin', 'editor', 'writer', 'viewer'],
    default: ['viewer']
  },
  permissions: {
    type: [String],
    default: []
  },
  organization: {
    type: String,
    trim: true
  },
  jobTitle: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  preferences: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
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

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included when converting to JSON
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    return ret;
  }
});

/**
 * Generate userId
 * Static method to generate a unique userId
 */
UserSchema.statics.generateUserId = function() {
  const timestamp = new Date().getTime().toString(36);
  const randomChars = Math.random().toString(36).substring(2, 5);
  return `USER-${timestamp}${randomChars}`.toUpperCase();
};

const User = mongoose.model('User', UserSchema);

module.exports = User;