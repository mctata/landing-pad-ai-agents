/**
 * API Key Model
 * Defines the schema for API keys used in the system
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;
const { randomBytes } = require('crypto');

const apiKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scopes: {
    type: [String],
    enum: [
      'agents:read',
      'agents:write',
      'content:read',
      'content:write',
      'content:publish',
      'content:delete',
      'analytics:read',
      'integrations:read',
      'integrations:write',
      'workflows:read',
      'workflows:write'
    ],
    default: ['agents:read', 'content:read']
  },
  active: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date
  },
  expiresAt: {
    type: Date
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

// Create a new API key
apiKeySchema.statics.generateApiKey = async function(data) {
  const key = randomBytes(32).toString('hex');
  
  const apiKey = new this({
    key,
    name: data.name,
    owner: data.owner,
    scopes: data.scopes || ['agents:read', 'content:read'],
    expiresAt: data.expiresAt
  });
  
  await apiKey.save();
  return apiKey;
};

// Update last used timestamp
apiKeySchema.statics.updateLastUsed = async function(keyId) {
  await this.findByIdAndUpdate(keyId, {
    lastUsed: new Date()
  });
};

// Revoke an API key
apiKeySchema.statics.revoke = async function(keyId) {
  await this.findByIdAndUpdate(keyId, {
    active: false
  });
};

// Export model
const ApiKey = mongoose.model('ApiKey', apiKeySchema);
module.exports = ApiKey;