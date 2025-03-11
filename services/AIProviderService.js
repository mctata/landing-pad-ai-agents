/**
 * AI Provider Service for Landing Pad Digital AI Content Agents
 * 
 * This service provides a unified interface for interacting with various AI models:
 * - Anthropic Claude for content generation and analysis
 * - OpenAI models for SEO and categorization
 * 
 * It handles:
 * - Model selection based on task
 * - API key management
 * - Request retry logic
 * - Error handling
 */

const axios = require('axios');
const ConfigService = require('./ConfigService');
const logger = require('./LoggerService');

class AIProviderService {
  constructor() {
    this.config = ConfigService.getConfig('external-services').ai;
    this.logger = logger.createLogger('ai-provider');
    this.providers = {};
    
    // Initialize providers
    this._initializeProviders();
  }

  /**
   * Generate text with AI model
   * @param {string} prompt - Prompt for the AI
   * @param {Object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, options = {}) {
    try {
      const providerName = options.provider || this.config.taskRouting.default;
      const modelName = options.model || this.config.providers[providerName].models.default;
      
      this.logger.info(`Generating text with ${providerName} model: ${modelName}`);
      
      // Check if provider is available
      if (!this.providers[providerName] || !this.config.providers[providerName].enabled) {
        throw new Error(`AI provider not available: ${providerName}`);
      }
      
      // Get provider
      const provider = this.providers[providerName];
      
      // Generate text
      const result = await provider.generateText(prompt, modelName, options);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate text: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   * @param {string} text - Text to embed
   * @param {Object} options - Embedding options
   * @returns {Promise<Array>} - Text embeddings
   */
  async generateEmbeddings(text, options = {}) {
    try {
      const providerName = options.provider || 'openai'; // Default to OpenAI for embeddings
      const modelName = options.model || this.config.providers[providerName].models.embeddings;
      
      this.logger.info(`Generating embeddings with ${providerName} model: ${modelName}`);
      
      // Check if provider is available
      if (!this.providers[providerName] || !this.config.providers[providerName].enabled) {
        throw new Error(`AI provider not available: ${providerName}`);
      }
      
      // Get provider
      const provider = this.providers[providerName];
      
      // Generate embeddings
      const result = await provider.generateEmbeddings(text, modelName, options);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Route task to appropriate AI provider
   * @param {string} task - Task type
   * @param {Object} data - Task data
   * @param {Object} options - Task options
   * @returns {Promise<Object>} - Task result
   */
  async routeTask(task, data, options = {}) {
    try {
      // Determine provider based on task
      const providerName = options.provider || this.config.taskRouting[task] || this.config.taskRouting.default;
      
      this.logger.info(`Routing ${task} task to ${providerName}`);
      
      // Execute task
      switch (task) {
        case 'contentGeneration':
          return await this.generateText(data.prompt, { 
            ...options, 
            provider: providerName 
          });
        
        case 'embeddings':
          return await this.generateEmbeddings(data.text, { 
            ...options, 
            provider: providerName 
          });
        
        default:
          // For other tasks, just pass to generateText
          return await this.generateText(data.prompt, { 
            ...options, 
            provider: providerName 
          });
      }
    } catch (error) {
      this.logger.error(`Failed to route task: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Initialize AI providers
   * @private
   */
  _initializeProviders() {
    try {
      // Initialize Anthropic provider
      if (this.config.providers.anthropic && this.config.providers.anthropic.enabled) {
        this.providers.anthropic = new AnthropicProvider(
          this.config.providers.anthropic
        );
        this.logger.info('Initialized Anthropic provider');
      }
      
      // Initialize OpenAI provider
      if (this.config.providers.openai && this.config.providers.openai.enabled) {
        this.providers.openai = new OpenAIProvider(
          this.config.providers.openai
        );
        this.logger.info('Initialized OpenAI provider');
      }
    } catch (error) {
      this.logger.error(`Failed to initialize AI providers: ${error.message}`, error);
      throw error;
    }
  }
}

/**
 * Anthropic provider implementation
 */
class AnthropicProvider {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: 'https://api.anthropic.com',
      headers: {
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      }
    });
  }

  /**
   * Generate text with Anthropic model
   * @param {string} prompt - Prompt for the AI
   * @param {string} model - Model name
   * @param {Object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, model, options = {}) {
    try {
      // Create request
      const request = {
        model,
        prompt: `Human: ${prompt}\n\nAssistant:`,
        max_tokens_to_sample: options.maxTokens || this.config.options.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : this.config.options.temperature,
        top_p: options.topP !== undefined ? options.topP : this.config.options.topP,
        stream: false
      };
      
      // Send request with retry logic
      const response = await this._retryRequest(() => 
        this.client.post('/v1/complete', request, {
          timeout: this.config.options.timeout || 60000
        })
      );
      
      // Return completion
      return response.data.completion.trim();
    } catch (error) {
      logger.createLogger('anthropic').error(`Text generation failed: ${error.message}`, error);
      throw new Error(`Anthropic text generation failed: ${error.message}`);
    }
  }

  /**
   * Execute request with retry logic
   * @private
   * @param {Function} requestFn - Request function
   * @returns {Promise<Object>} - Response
   */
  async _retryRequest(requestFn) {
    const maxRetries = this.config.options.retryStrategy.attempts;
    let attempt = 0;
    let lastError = null;
    
    while (attempt < maxRetries) {
      try {
        return await requestFn();
      } catch (error) {
        attempt++;
        lastError = error;
        
        // Check if we should retry
        if (attempt >= maxRetries || !this._isRetryable(error)) {
          throw error;
        }
        
        // Calculate delay
        const delay = Math.min(
          this.config.options.retryStrategy.initialDelay * Math.pow(this.config.options.retryStrategy.factor, attempt - 1),
          this.config.options.retryStrategy.maxDelay
        );
        
        logger.createLogger('anthropic').warn(`Retrying request after ${delay}ms (attempt ${attempt}/${maxRetries})`);
        
        // Wait for delay
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   * @private
   * @param {Error} error - Error
   * @returns {boolean} - Is retryable
   */
  _isRetryable(error) {
    // Retry on network errors and 429/500/503 status codes
    return !error.response || 
           error.response.status === 429 || 
           error.response.status === 500 || 
           error.response.status === 503;
  }
}

/**
 * OpenAI provider implementation
 */
class OpenAIProvider {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
  }

  /**
   * Generate text with OpenAI model
   * @param {string} prompt - Prompt for the AI
   * @param {string} model - Model name
   * @param {Object} options - Generation options
   * @returns {Promise<string>} - Generated text
   */
  async generateText(prompt, model, options = {}) {
    try {
      // Create request
      const request = {
        model,
        messages: [
          { role: 'system', content: options.systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: options.maxTokens || this.config.options.maxTokens,
        temperature: options.temperature !== undefined ? options.temperature : this.config.options.temperature,
        top_p: options.topP !== undefined ? options.topP : this.config.options.topP,
        stream: false
      };
      
      // Send request with retry logic
      const response = await this._retryRequest(() => 
        this.client.post('/chat/completions', request, {
          timeout: this.config.options.timeout || 60000
        })
      );
      
      // Return completion
      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.createLogger('openai').error(`Text generation failed: ${error.message}`, error);
      throw new Error(`OpenAI text generation failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings with OpenAI model
   * @param {string} text - Text to embed
   * @param {string} model - Model name
   * @param {Object} options - Embedding options
   * @returns {Promise<Array>} - Text embeddings
   */
  async generateEmbeddings(text, model, options = {}) {
    try {
      // Create request
      const request = {
        model,
        input: text
      };
      
      // Send request with retry logic
      const response = await this._retryRequest(() => 
        this.client.post('/embeddings', request, {
          timeout: this.config.options.timeout || 60000
        })
      );
      
      // Return embeddings
      return response.data.data[0].embedding;
    } catch (error) {
      logger.createLogger('openai').error(`Embedding generation failed: ${error.message}`, error);
      throw new Error(`OpenAI embedding generation failed: ${error.message}`);
    }
  }

  /**
   * Execute request with retry logic
   * @private
   * @param {Function} requestFn - Request function
   * @returns {Promise<Object>} - Response
   */
  async _retryRequest(requestFn) {
    const maxRetries = this.config.options.retryStrategy.attempts;
    let attempt = 0;
    let lastError = null;
    
    while (attempt < maxRetries) {
      try {
        return await requestFn();
      } catch (error) {
        attempt++;
        lastError = error;
        
        // Check if we should retry
        if (attempt >= maxRetries || !this._isRetryable(error)) {
          throw error;
        }
        
        // Calculate delay
        const delay = Math.min(
          this.config.options.retryStrategy.initialDelay * Math.pow(this.config.options.retryStrategy.factor, attempt - 1),
          this.config.options.retryStrategy.maxDelay
        );
        
        logger.createLogger('openai').warn(`Retrying request after ${delay}ms (attempt ${attempt}/${maxRetries})`);
        
        // Wait for delay
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is retryable
   * @private
   * @param {Error} error - Error
   * @returns {boolean} - Is retryable
   */
  _isRetryable(error) {
    // Retry on network errors and 429/500/503 status codes
    return !error.response || 
           error.response.status === 429 || 
           error.response.status === 500 || 
           error.response.status === 503;
  }
}

// Singleton instance
const instance = new AIProviderService();

module.exports = instance;
