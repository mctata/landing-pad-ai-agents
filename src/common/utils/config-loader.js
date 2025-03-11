/**
 * Config Loader Utility
 * Loads and validates configuration files for the agent system
 * Supports environment-specific configuration for CI/CD deployments
 */

const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

class ConfigLoader {
  /**
   * Load configuration from files
   * @returns {Promise<Object>} Loaded configuration
   */
  static async load() {
    try {
      // Load environment-specific configuration
      const envConfig = await this._loadEnvironmentConfig();
      
      // Load agent configurations
      const agentsConfig = await this._loadConfigFile('agents.json');
      
      // Load messaging configuration
      const messagingConfig = await this._loadConfigFile('messaging.json');
      
      // Load storage configuration
      const storageConfig = await this._loadConfigFile('storage.json');
      
      // Load external services configuration
      const externalServicesConfig = await this._loadConfigFile('external-services.json');
      
      // Combine all configurations with environment config taking precedence
      const config = {
        agents: agentsConfig,
        messaging: messagingConfig,
        storage: storageConfig,
        externalServices: externalServicesConfig,
        ...envConfig
      };
      
      // Apply environment-specific overrides
      const configWithOverrides = this._applyEnvironmentOverrides(config);
      
      // Apply environment variable overrides
      const finalConfig = this._applyEnvVarOverrides(configWithOverrides);
      
      // Validate the final configuration
      return this._validateConfig(finalConfig);
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }
  
  /**
   * Load a specific configuration file
   * @private
   * @param {string} filename - Configuration filename
   * @returns {Promise<Object>} Loaded configuration
   */
  static async _loadConfigFile(filename) {
    const configPath = path.join(process.cwd(), 'config', filename);
    
    try {
      const data = await fs.readFile(configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // If file doesn't exist, try to load default
        const defaultConfigPath = path.join(process.cwd(), 'config', 'default', filename);
        try {
          const defaultData = await fs.readFile(defaultConfigPath, 'utf8');
          return JSON.parse(defaultData);
        } catch (defaultError) {
          throw new Error(`Configuration file ${filename} not found and no default available`);
        }
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file ${filename}: ${error.message}`);
      } else {
        throw new Error(`Error loading configuration file ${filename}: ${error.message}`);
      }
    }
  }
  
  /**
   * Load environment-specific configuration file
   * @private
   * @returns {Promise<Object>} Environment-specific configuration
   */
  static async _loadEnvironmentConfig() {
    const environment = process.env.NODE_ENV || 'development';
    const envConfigPath = path.join(process.cwd(), 'src', 'config', 'environments', `${environment}.js`);
    
    try {
      // Check if the environment config file exists
      await fs.access(envConfigPath);
      
      // Load the environment config module
      return require(envConfigPath);
    } catch (error) {
      // If file doesn't exist or has an error, try to load the development config
      if (environment !== 'development') {
        console.warn(`Environment config not found for ${environment}, falling back to development`);
        try {
          const devConfigPath = path.join(process.cwd(), 'src', 'config', 'environments', 'development.js');
          await fs.access(devConfigPath);
          return require(devConfigPath);
        } catch (devError) {
          console.warn('Development configuration not found, using defaults');
          return {};
        }
      }
      
      // If this is already development environment or no configs found, return empty object
      return {};
    }
  }

  /**
   * Get environment-specific overrides for configuration
   * @private
   * @param {Object} config - Base configuration
   * @returns {Object} Configuration with environment overrides applied
   */
  static _applyEnvironmentOverrides(config) {
    const environment = process.env.NODE_ENV || 'development';
    
    // Check for environment-specific overrides in each main section
    for (const [section, sectionConfig] of Object.entries(config)) {
      if (sectionConfig && typeof sectionConfig === 'object' && sectionConfig[environment]) {
        // Deep merge environment-specific configurations
        config[section] = {
          ...sectionConfig,
          ...sectionConfig[environment]
        };
        
        // Remove environment-specific keys to clean up the final config
        for (const env of ['development', 'test', 'staging', 'production']) {
          delete config[section][env];
        }
      }
    }
    
    return config;
  }
  
  /**
   * Apply environment variable overrides where applicable
   * @private
   * @param {Object} config - Configuration object
   * @returns {Object} Configuration with environment variable overrides
   */
  static _applyEnvVarOverrides(config) {
    // Pattern to match: CONFIG_SECTION_KEY=value
    const envPattern = /^CONFIG_([A-Z0-9]+)_([A-Z0-9_]+)$/;
    
    for (const [key, value] of Object.entries(process.env)) {
      const match = key.match(envPattern);
      if (match) {
        const section = match[1].toLowerCase();
        const configKey = match[2].toLowerCase();
        
        // Convert section name format (e.g., CONTENT_STRATEGY -> content_strategy)
        const formattedSection = section.replace(/_([a-z])/g, (_, letter) => letter);
        
        // Apply override if section exists
        if (config[formattedSection]) {
          // Parse value based on type
          let parsedValue = value;
          
          if (value.toLowerCase() === 'true') parsedValue = true;
          else if (value.toLowerCase() === 'false') parsedValue = false;
          else if (!isNaN(value) && value.trim() !== '') parsedValue = Number(value);
          
          // Convert key format (e.g., MAX_TOKENS -> maxTokens)
          const formattedKey = configKey.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          
          config[formattedSection][formattedKey] = parsedValue;
        }
      }
    }
    
    return config;
  }
  
  /**
   * Validate configuration structure and required fields
   * @private
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validated configuration
   */
  static _validateConfig(config) {
    const environment = process.env.NODE_ENV || 'development';
    const isTest = environment === 'test';
    
    // Less strict validation in test environment
    if (!isTest) {
      // Check for required sections
      const requiredSections = ['agents', 'messaging', 'storage'];
      for (const section of requiredSections) {
        if (!config[section]) {
          throw new Error(`Missing required configuration section: ${section}`);
        }
      }
      
      // Check for required agent configurations
      const requiredAgents = [
        'content_strategy', 
        'content_creation', 
        'content_management', 
        'optimisation', 
        'brand_consistency'
      ];
      
      if (config.agents) {
        for (const agent of requiredAgents) {
          if (!config.agents[agent]) {
            console.warn(`Missing configuration for agent: ${agent}. It may not be available.`);
          }
        }
      }
    }
    
    // Check for CI/CD required configurations
    if (environment === 'production' || environment === 'staging') {
      // Validate database configuration
      if (!config.database || !config.database.uri) {
        throw new Error(`Missing required database URI in ${environment} environment`);
      }
      
      // Validate security settings
      if (!process.env.JWT_SECRET) {
        throw new Error(`Missing required JWT_SECRET in ${environment} environment`);
      }
      
      // Log warnings for recommended but not required settings
      if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
        console.warn('No AI provider API keys found. At least one is recommended for agent functionality.');
      }
    }
    
    return config;
  }
}

module.exports = ConfigLoader;