/**
 * API Key Model
 * Defines the schema for API keys used in the system
 */

const { DataTypes } = require('sequelize');
const { randomBytes } = require('crypto');
const BaseModel = require('./baseModel');

class ApiKey extends BaseModel {
  // Define model attributes
  static attributes = {
    keyId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      unique: true
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'userId'
      }
    },
    scopes: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: ['agents:read', 'content:read'],
      validate: {
        isValidScope(value) {
          const validScopes = [
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
          ];
          
          if (value && value.length) {
            for (const scope of value) {
              if (!validScopes.includes(scope)) {
                throw new Error(`${scope} is not a valid scope`);
              }
            }
          }
        }
      }
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastUsed: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  };

  // Model options
  static options = {
    tableName: 'api_keys',
    timestamps: true,
    indexes: [
      {
        fields: ['key']
      },
      {
        fields: ['userId']
      }
    ]
  };

  /**
   * Generate a unique key ID
   * @returns {string} - Unique key ID
   */
  static generateKeyId() {
    return this.generateUniqueId('KEY');
  }

  /**
   * Create a new API key
   * @param {Object} data - API key data
   * @returns {Object} - Generated API key
   */
  static async generateApiKey(data) {
    const key = randomBytes(32).toString('hex');
    
    const apiKey = await this.create({
      keyId: this.generateKeyId(),
      key,
      name: data.name,
      userId: data.userId,
      scopes: data.scopes || ['agents:read', 'content:read'],
      expiresAt: data.expiresAt
    });
    
    return apiKey;
  }

  /**
   * Update last used timestamp
   * @param {string} keyId - Key ID
   */
  static async updateLastUsed(keyId) {
    await this.update(
      { lastUsed: new Date() },
      { where: { keyId } }
    );
  }

  /**
   * Revoke an API key
   * @param {string} keyId - Key ID
   */
  static async revoke(keyId) {
    await this.update(
      { active: false },
      { where: { keyId } }
    );
  }

  /**
   * Define associations with other models
   * @param {Object} models - All registered models
   */
  static associate(models) {
    ApiKey.belongsTo(models.User, { foreignKey: 'userId', targetKey: 'userId' });
  }
}

module.exports = ApiKey;