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
const NodeCache = require('node-cache');
const crypto = require('crypto');
const ConfigService = require('./ConfigService');
const logger = require('./LoggerService');

class AIProviderService {
  constructor() {
    this.config = ConfigService.getConfig('external-services').ai;
    this.logger = logger.createLogger('ai-provider');
    this.providers = {};
    
    // Initialize response cache
    const cacheConfig = this.config.cache || { 
      ttl: 3600, // 1 hour default TTL 
      checkperiod: 600, // Check for expired entries every 10 minutes
      maxKeys: 1000 // Maximum number of cached responses
    };
    
    this.responseCache = new NodeCache({
      stdTTL: cacheConfig.ttl,
      checkperiod: cacheConfig.checkperiod,
      maxKeys: cacheConfig.maxKeys,
      useClones: false
    });
    
    // Cache metrics
    this.metrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0
    };
    
    // Initialize providers
    this._initializeProviders();
    
    // Log cache initialization
    this.logger.info(`Initialized AI response cache (TTL: ${cacheConfig.ttl}s, max keys: ${cacheConfig.maxKeys})`);
    
    // Set up cache statistics reporting
    setInterval(() => {
      const cacheStats = this.responseCache.getStats();
      const hitRate = this.metrics.totalRequests > 0 
        ? (this.metrics.hits / this.metrics.totalRequests * 100).toFixed(2) 
        : 0;
        
      this.logger.info(`AI cache stats: ${this.responseCache.keys().length} keys, hit rate: ${hitRate}%, hits: ${this.metrics.hits}, misses: ${this.metrics.misses}`);
    }, 300000); // Log every 5 minutes
  }
  
  /**
   * Generate cache key from request parameters
   * @private
   * @param {string} provider - AI provider name
   * @param {string} operation - Operation type (text, embeddings)
   * @param {string} prompt - Input prompt or text
   * @param {string} model - Model name
   * @param {Object} options - Options that affect output
   * @returns {string} - Cache key
   */
  _generateCacheKey(provider, operation, prompt, model, options) {
    // Extract options that affect the output
    const relevantOptions = {
      temperature: options.temperature,
      topP: options.topP,
      maxTokens: options.maxTokens,
      systemPrompt: options.systemPrompt
    };
    
    // Create a string to hash
    const dataToHash = JSON.stringify({
      provider,
      operation,
      prompt,
      model,
      options: relevantOptions
    });
    
    // Generate hash for cache key
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
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
      
      // Update request metrics
      this.metrics.totalRequests++;
      
      // Skip cache if explicitly disabled in options
      if (options.skipCache !== true && options.temperature !== 0) {
        // Check if result is in cache (only cache if temperature > 0 for deterministic results)
        const cacheKey = this._generateCacheKey(providerName, 'text', prompt, modelName, options);
        const cachedResult = this.responseCache.get(cacheKey);
        
        if (cachedResult) {
          this.metrics.hits++;
          this.logger.debug(`Cache hit for ${providerName} text generation`);
          return cachedResult;
        }
        
        this.metrics.misses++;
        this.logger.debug(`Cache miss for ${providerName} text generation`);
      }
      
      this.logger.info(`Generating text with ${providerName} model: ${modelName}`);
      
      // Check if provider is available
      if (!this.providers[providerName] || !this.config.providers[providerName].enabled) {
        throw new Error(`AI provider not available: ${providerName}`);
      }
      
      // Get provider
      const provider = this.providers[providerName];
      
      // Generate text
      const startTime = process.hrtime.bigint();
      const result = await provider.generateText(prompt, modelName, options);
      const endTime = process.hrtime.bigint();
      
      // Calculate execution time in milliseconds
      const executionTime = Number(endTime - startTime) / 1e6;
      this.logger.debug(`${providerName} text generation took ${executionTime.toFixed(2)}ms`);
      
      // Cache result if appropriate (don't cache if specified in options or temperature is 0)
      if (options.skipCache !== true && options.temperature !== 0) {
        const cacheKey = this._generateCacheKey(providerName, 'text', prompt, modelName, options);
        // Use custom TTL if provided, otherwise use default from cache settings
        const ttl = options.cacheTTL || undefined;
        this.responseCache.set(cacheKey, result, ttl);
      }
      
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
      
      // Update request metrics
      this.metrics.totalRequests++;
      
      // Embeddings are deterministic, so we can always use cache unless explicitly disabled
      if (options.skipCache !== true) {
        // Check if result is in cache
        const cacheKey = this._generateCacheKey(providerName, 'embeddings', text, modelName, options);
        const cachedResult = this.responseCache.get(cacheKey);
        
        if (cachedResult) {
          this.metrics.hits++;
          this.logger.debug(`Cache hit for ${providerName} embeddings generation`);
          return cachedResult;
        }
        
        this.metrics.misses++;
        this.logger.debug(`Cache miss for ${providerName} embeddings generation`);
      }
      
      this.logger.info(`Generating embeddings with ${providerName} model: ${modelName}`);
      
      // Check if provider is available
      if (!this.providers[providerName] || !this.config.providers[providerName].enabled) {
        throw new Error(`AI provider not available: ${providerName}`);
      }
      
      // Get provider
      const provider = this.providers[providerName];
      
      // Generate embeddings
      const startTime = process.hrtime.bigint();
      const result = await provider.generateEmbeddings(text, modelName, options);
      const endTime = process.hrtime.bigint();
      
      // Calculate execution time in milliseconds
      const executionTime = Number(endTime - startTime) / 1e6;
      this.logger.debug(`${providerName} embeddings generation took ${executionTime.toFixed(2)}ms`);
      
      // Cache result if not disabled
      if (options.skipCache !== true) {
        const cacheKey = this._generateCacheKey(providerName, 'embeddings', text, modelName, options);
        // Use custom TTL if provided, otherwise use default from cache settings
        const ttl = options.cacheTTL || undefined;
        this.responseCache.set(cacheKey, result, ttl);
      }
      
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
   * Batch process multiple AI tasks in parallel with concurrency control
   * @param {Array<Object>} tasks - Array of task objects, each containing:
   *   @param {string} type - Task type ('text', 'embeddings', or a custom task type)
   *   @param {Object} data - Task data object (e.g., {prompt: "..."} or {text: "..."})
   *   @param {Object} options - Options for the task
   * @param {Object} batchOptions - Options for batch processing
   *   @param {number} concurrency - Maximum number of concurrent tasks (default: 5)
   *   @param {boolean} continueOnError - Whether to continue batch on individual errors (default: true)
   * @returns {Promise<Array<Object>>} - Results with success/error status for each task
   */
  async batchProcess(tasks, batchOptions = {}) {
    const concurrency = batchOptions.concurrency || 5;
    const continueOnError = batchOptions.continueOnError !== false;
    
    this.logger.info(`Starting batch processing of ${tasks.length} tasks with concurrency ${concurrency}`);
    
    const startTime = process.hrtime.bigint();
    const results = new Array(tasks.length);
    
    // Process tasks in chunks for concurrency control
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency);
      const chunkPromises = chunk.map((task, index) => {
        return (async () => {
          const taskIndex = i + index;
          try {
            let result;
            
            // Determine which method to call based on task type
            switch (task.type) {
              case 'text':
                result = await this.generateText(task.data.prompt, task.options || {});
                break;
              case 'embeddings':
                result = await this.generateEmbeddings(task.data.text, task.options || {});
                break;
              default:
                // Route to appropriate handler via routeTask
                result = await this.routeTask(task.type, task.data, task.options || {});
            }
            
            // Store successful result
            results[taskIndex] = {
              success: true,
              result
            };
          } catch (error) {
            // Store error result
            results[taskIndex] = {
              success: false,
              error: error.message
            };
            
            // Break batch if continueOnError is false
            if (!continueOnError) {
              throw error;
            }
          }
        })();
      });
      
      // Wait for all tasks in this chunk to complete
      try {
        await Promise.all(chunkPromises);
      } catch (error) {
        // If continueOnError is false and an error occurred, we stop processing
        if (!continueOnError) {
          // Fill remaining tasks as unprocessed
          for (let j = i + concurrency; j < tasks.length; j++) {
            results[j] = {
              success: false,
              error: 'Batch processing terminated early',
              unprocessed: true
            };
          }
          break;
        }
      }
    }
    
    // Calculate total execution time
    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1e6;
    
    const successCount = results.filter(r => r && r.success).length;
    const errorCount = results.filter(r => r && !r.success).length;
    
    this.logger.info(`Batch processing completed in ${executionTime.toFixed(2)}ms (${successCount} successes, ${errorCount} errors)`);
    
    return {
      results,
      stats: {
        totalTasks: tasks.length,
        successCount,
        errorCount,
        executionTime
      }
    };
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    const cacheStats = this.responseCache.getStats();
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests * 100).toFixed(2) 
      : 0;
    
    return {
      keys: this.responseCache.keys().length,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      totalRequests: this.metrics.totalRequests,
      hitRate: `${hitRate}%`,
      ...cacheStats
    };
  }
  
  /**
   * Clear the entire response cache
   * @returns {number} - Number of keys cleared
   */
  clearCache() {
    const keyCount = this.responseCache.keys().length;
    this.responseCache.flushAll();
    this.logger.info(`Cleared AI response cache (${keyCount} keys removed)`);
    return keyCount;
  }
  
  /**
   * Clear cache entries by provider
   * @param {string} provider - Provider name to clear
   * @returns {number} - Number of keys cleared
   */
  clearCacheByProvider(provider) {
    let clearedCount = 0;
    
    // This is inefficient but the only way with node-cache
    // without storing additional metadata for each entry
    const allKeys = this.responseCache.keys();
    
    for (const key of allKeys) {
      const cacheData = this.responseCache.get(key);
      if (key.startsWith(provider)) {
        this.responseCache.del(key);
        clearedCount++;
      }
    }
    
    this.logger.info(`Cleared AI response cache for provider ${provider} (${clearedCount} keys removed)`);
    return clearedCount;
  }
  
  /**
   * Set a custom API key for a provider at runtime
   * @param {string} provider - Provider name
   * @param {string} apiKey - New API key
   * @returns {boolean} - Success status
   */
  setProviderApiKey(provider, apiKey) {
    if (!this.providers[provider]) {
      this.logger.error(`Provider ${provider} not found`);
      return false;
    }
    
    try {
      // Update API key
      this.providers[provider].apiKey = apiKey;
      
      // Update client headers if needed
      if (provider === 'anthropic') {
        this.providers[provider].client.defaults.headers['x-api-key'] = apiKey;
      } else if (provider === 'openai') {
        this.providers[provider].client.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      this.logger.info(`Updated API key for provider ${provider}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update API key for provider ${provider}: ${error.message}`);
      return false;
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
