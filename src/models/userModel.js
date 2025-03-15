/**
 * User Model
 * Schema for user accounts with enhanced security features
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const BaseModel = require('./baseModel');

class User extends BaseModel {
  // Define model attributes
  static attributes = {
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 255]
      }
    },
    roles: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ['viewer'],
      validate: {
        isValidRole(value) {
          const validRoles = ['admin', 'editor', 'writer', 'viewer'];
          if (value && value.length) {
            for (const role of value) {
              if (!validRoles.includes(role)) {
                throw new Error(`${role} is not a valid role`);
              }
            }
          }
        }
      }
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    organization: {
      type: DataTypes.STRING,
      allowNull: true
    },
    jobTitle: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'pending', 'locked'),
      defaultValue: 'active'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failedLoginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorSecret: {
      type: DataTypes.STRING,
      allowNull: true
    },
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    previousPasswords: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    requiresPasswordChange: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    lastActivity: {
      type: DataTypes.DATE,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.STRING,
      allowNull: true
    }
  };

  // Model options
  static options = {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeSave: async (user) => {
        // Only hash the password if it's modified or new
        if (!user.changed('password')) {
          return;
        }
        
        // Save previous password to history (up to 5)
        if (user.changed('password') && user.previous('password')) {
          // Add current password to previous passwords array
          const previousPasswords = [...(user.previousPasswords || [])];
          
          // Store up to 5 previous passwords
          previousPasswords.push(user.previous('password'));
          if (previousPasswords.length > 5) {
            previousPasswords.shift();
          }
          
          user.previousPasswords = previousPasswords;
          user.passwordChangedAt = new Date(Date.now() - 1000); // Subtract 1 second to handle timing issues
        }
        
        // Generate salt and hash password
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    defaultScope: {
      attributes: { exclude: ['password', 'previousPasswords', 'passwordResetToken', 'passwordResetExpires', 'twoFactorSecret'] }
    },
    scopes: {
      withSensitiveData: {
        attributes: { include: ['previousPasswords'] }
      }
    }
  };

  // Virtual fields
  static getterMethods = {
    fullName() {
      return `${this.firstName} ${this.lastName}`;
    },
    
    accountStatus() {
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
    }
  };

  /**
   * Compare a candidate password with the stored password
   * @param {string} candidatePassword - Password to compare
   * @returns {Promise<boolean>} - True if password matches
   */
  comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * Check if provided password was used before
   * @param {string} candidatePassword - Password to check
   * @returns {boolean} - True if password was used before
   */
  async isPasswordReused(candidatePassword) {
    if (!this.previousPasswords || this.previousPasswords.length === 0) {
      return false;
    }
    
    // Check if password matches any previously used passwords
    for (const prevPassword of this.previousPasswords) {
      if (await bcrypt.compare(candidatePassword, prevPassword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} - Validation result
   */
  static validatePasswordStrength(password) {
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
    const hasSpecialChars = /[!@#$%^&*()_+\-=[{};':"\\|,.<>/?]/.test(password);
    
    if (!(hasUppercase && hasLowercase && hasNumbers && hasSpecialChars)) {
      return {
        valid: false,
        message: 'Password must include uppercase and lowercase letters, numbers, and special characters'
      };
    }
    
    // Check for common passwords
    const commonPasswords = ['Password123!', 'Admin123!', 'Welcome1!', 'Passw0rd!'];
    if (commonPasswords.includes(password)) {
      return {
        valid: false,
        message: 'Password is too common or easily guessable'
      };
    }
    
    return { valid: true };
  }

  /**
   * Create password reset token
   * @returns {string} - Reset token
   */
  createPasswordResetToken() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Token expires in 1 hour
    this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    
    return resetToken;
  }

  /**
   * Handle failed login attempts
   */
  async handleFailedLogin() {
    this.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.status = 'locked';
      this.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    
    await this.save();
  }

  /**
   * Reset failed login attempts
   */
  async resetLoginAttempts() {
    this.failedLoginAttempts = 0;
    this.lockUntil = null;
    
    if (this.status === 'locked') {
      this.status = 'active';
    }
    
    await this.save();
  }

  /**
   * Check if user account is locked
   * @returns {boolean} - True if account is locked
   */
  isLocked() {
    // Account is locked and lock period hasn't expired
    return this.status === 'locked' && this.lockUntil && this.lockUntil > Date.now();
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity() {
    this.lastActivity = new Date();
    await this.save();
  }

  /**
   * Check if password was changed after a token was issued
   * @param {number} JWTTimestamp - JWT timestamp in seconds
   * @returns {boolean} - True if password was changed after token issuance
   */
  changedPasswordAfter(JWTTimestamp) {
    if (this.passwordChangedAt) {
      const changedTimestamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return JWTTimestamp < changedTimestamp;
    }
    return false;
  }

  /**
   * Generate a unique user ID
   * @returns {string} - Unique user ID
   */
  static generateUserId() {
    return this.generateUniqueId('USER');
  }

  /**
   * Define associations with other models
   * @param {Object} _models - All registered models
   */
  static associate(_models) {
    // Define associations here
    // Example: User.hasMany(_models.Content, { foreignKey: 'createdBy', sourceKey: 'userId' });
  }
}

module.exports = User;