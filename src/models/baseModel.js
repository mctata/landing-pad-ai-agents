/**
 * Base Model for Sequelize
 * Provides common functionality for all models
 */

const { Model } = require('sequelize');

class BaseModel extends Model {
  /**
   * Initialize the model with Sequelize instance
   * @param {Sequelize} sequelize - Sequelize instance
   */
  static init(sequelize) {
    if (!this.attributes) {
      throw new Error(`Model ${this.name} must define attributes`);
    }
    
    super.init(this.attributes, {
      sequelize,
      modelName: this.name,
      tableName: this.tableName || this.name.toLowerCase() + 's',
      timestamps: true,
      ...this.options
    });
    
    return this;
  }

  /**
   * Define associations with other models
   * This method should be overridden by child classes
   * @param {Object} _models - All registered models
   */
  static associate(_models) {
    // To be implemented by child classes
  }
  
  /**
   * Generate a unique ID with a prefix
   * @param {string} prefix - Prefix for the ID
   * @returns {string} - Generated ID
   */
  static generateUniqueId(prefix) {
    const crypto = require('crypto');
    const timestamp = new Date().getTime().toString(36);
    const randomChars = crypto.randomBytes(3).toString('hex');
    return `${prefix}-${timestamp}${randomChars}`.toUpperCase();
  }
}

module.exports = BaseModel;