/**
 * User Model
 * Schema for user accounts with enhanced security features
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
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
    index: true,
    validate: {
      validator: function(v) {
        return /^([\w-.]+@([\w-]+\.)+[\w-]{2,})?$/.test(v);
      },
      message: props => `${props.value} is not a valid email address!`
    }
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
    enum: ['active', 'inactive', 'suspended', 'pending', 'locked'],
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  passwordChangedAt: {
    type: Date
  },
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  preferences: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  previousPasswords: {
    type: [String],
    select: false,
    default: []
  },
  requiresPasswordChange: {
    type: Boolean,
    default: false
  },
  lastActivity: {
    type: Date
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

// Check if provided password was used before
UserSchema.methods.isPasswordReused = async function(candidatePassword) {
  // Get previous passwords (need to include them in query)
  const user = await this.model('User').findById(this._id).select('+previousPasswords');
  
  if (!user.previousPasswords || user.previousPasswords.length === 0) {
    return false;
  }
  
  // Check if password matches any previously used passwords
  for (const prevPassword of user.previousPasswords) {
    if (await bcrypt.compare(candidatePassword, prevPassword)) {
      return true;
    }
  }
  
  return false;
};

// Method to validate password strength
UserSchema.statics.validatePasswordStrength = function(password) {
  // At least 8 characters
  if (password.length < 8) {
    return { 
      valid: false, 
      message: 'Password must be at least 8 characters long' 
    };
  }
  
  // Check for complexity
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  if (!(hasUppercase && hasLowercase && hasNumbers && hasSpecialChars)) {
    return {
      valid: false,
      message: 'Password must include uppercase and lowercase letters, numbers, and special characters'
    };
  }
  
  // Check for common passwords (this would be expanded in a real implementation)
  const commonPasswords = ['Password123!', 'Admin123!', 'Welcome1!', 'Passw0rd!'];
  if (commonPasswords.includes(password)) {
    return {
      valid: false,
      message: 'Password is too common or easily guessable'
    };
  }
  
  return { valid: true };
};

// Method to create password reset token
UserSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Token expires in 1 hour
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  
  return resetToken;
};

// Method to handle failed login attempts
UserSchema.methods.handleFailedLogin = async function() {
  this.failedLoginAttempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.status = 'locked';
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
  }
  
  await this.save();
};

// Method to reset failed login attempts
UserSchema.methods.resetLoginAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockUntil = undefined;
  
  if (this.status === 'locked') {
    this.status = 'active';
  }
  
  await this.save();
};

// Method to check if user account is locked
UserSchema.methods.isLocked = function() {
  // Account is locked and lock period hasn't expired
  return this.status === 'locked' && this.lockUntil && this.lockUntil > Date.now();
};

// Method to update last activity timestamp
UserSchema.methods.updateActivity = async function() {
  this.lastActivity = new Date();
  await this.save();
};

// Hash password before saving and store previous passwords
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    // Save previous password to history (up to 5)
    if (this.password && this.isModified('password')) {
      // Get user with previous passwords
      const previousUser = await this.model('User').findById(this._id).select('+previousPasswords');
      
      if (previousUser && previousUser.previousPasswords) {
        // Add current password to previous passwords
        const currentPasswordHash = this.password;
        
        // Store up to 5 previous passwords
        previousUser.previousPasswords.push(currentPasswordHash);
        if (previousUser.previousPasswords.length > 5) {
          previousUser.previousPasswords.shift();
        }
        
        this.previousPasswords = previousUser.previousPasswords;
        this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to handle timing issues
      }
    }
    
    // Generate salt
    const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 for extra security
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

// Virtual for account status with lock information
UserSchema.virtual('accountStatus').get(function() {
  if (this.status === 'locked' && this.lockUntil) {
    const now = new Date();
    if (this.lockUntil > now) {
      const minutesLeft = Math.ceil((this.lockUntil - now) / (1000 * 60));
      return `Locked (${minutesLeft} minutes remaining)`;
    } else {
      return 'Ready to unlock';
    }
  }
  return this.status;
});

// Check if password was changed after a token was issued
UserSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Ensure virtuals are included when converting to JSON
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.previousPasswords;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.twoFactorSecret;
    return ret;
  }
});

/**
 * Generate userId
 * Static method to generate a unique userId
 */
UserSchema.statics.generateUserId = function() {
  const timestamp = new Date().getTime().toString(36);
  const randomChars = crypto.randomBytes(3).toString('hex');
  return `USER-${timestamp}${randomChars}`.toUpperCase();
};

const User = mongoose.model('User', UserSchema);

module.exports = User;