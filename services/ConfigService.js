/**
 * Configuration Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides access to configuration settings from various sources:
 * - JSON config files (in /config directory)
 * - Environment variables
 * - Default values
 * 
 * It performs environment variable interpolation and validation.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

class ConfigService {
  constructor() {
    this.configs = new Map();
    this.configDir = path.join(process.cwd(), 'config');
    
    this._loadConfigs();
  }

  /**
   * Get configuration
   * @param {string} name - Configuration name
   * @returns {Object} - Configuration object
   */
  getConfig(name) {
    if (!this.configs.has(name)) {
      throw new Error(`Configuration not found: ${name}`);
    }
    
    return this.configs.get(name);
  }

  /**
   * Get all configurations
   * @returns {Object} - All configurations
   */
  getAllConfigs() {
    const configs = {};
    
    for (const [name, config] of this.configs.entries()) {
      configs[name] = config;
    }
    
    return configs;
  }

  /**
   * Load all configs from the config directory
   * @private
   */
  _loadConfigs() {
    // Check if config directory exists
    if (!fs.existsSync(this.configDir)) {
      throw new Error(`Config directory not found: ${this.configDir}`);
    }
    
    // Get all JSON files in the config directory
    const configFiles = fs.readdirSync(this.configDir)
      .filter(file => file.endsWith('.json'));
    
    // Load each config file
    for (const file of configFiles) {
      try {
        const name = path.basename(file, '.json');
        const filePath = path.join(this.configDir, file);
        
        // Read file
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse JSON
        const config = JSON.parse(content);
        
        // Process configuration (interpolate environment variables)
        const processedConfig = this._processConfig(config);
        
        // Store config
        this.configs.set(name, processedConfig);
      } catch (error) {
        console.error(`Failed to load config file ${file}: ${error.message}`);
        // Continue loading other configs
      }
    }
  }

  /**
   * Process configuration values (interpolate environment variables)
   * @private
   * @param {Object|Array|string|number|boolean} value - Configuration value
   * @returns {Object|Array|string|number|boolean} - Processed value
   */
  _processConfig(value) {
    // Handle null or undefined
    if (value === null || value === undefined) {
      return value;
    }
    
    // Handle different value types
    switch (typeof value) {
      case 'string':
        return this._interpolateEnvVars(value);
      
      case 'object':
        // Handle arrays
        if (Array.isArray(value)) {
          return value.map(item => this._processConfig(item));
        }
        
        // Handle objects
        const processed = {};
        for (const [key, val] of Object.entries(value)) {
          processed[key] = this._processConfig(val);
        }
        return processed;
      
      // Return as is for other types
      default:
        return value;
    }
  }

  /**
   * Interpolate environment variables in string
   * @private
   * @param {string} str - String to interpolate
   * @returns {string} - Interpolated string
   */
  _interpolateEnvVars(str) {
    // Check if string contains environment variable pattern
    if (typeof str !== 'string' || !str.includes('${')) {
      return str;
    }
    
    // Replace environment variables
    return str.replace(/\${([^}]+)}/g, (match, name) => {
      const value = process.env[name];
      
      if (value === undefined) {
        console.warn(`Environment variable ${name} not found`);
        return match; // Keep original if env var not found
      }
      
      return value;
    });
  }
}

// Singleton instance
const instance = new ConfigService();

module.exports = instance;
