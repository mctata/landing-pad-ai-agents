/**
 * AI Provider Service
 * Provides a common interface for interacting with AI models (OpenAI, Anthropic)
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class AIProviderService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.providers = {};
    
    this._initializeProviders();
  }

  _initializeProviders() {
    // Initialize OpenAI if configured
    if (this.config.openai && this.config.openai.api_key) {
      this.providers.openai = new OpenAI({
        apiKey: this.config.openai.api_key,
        organization: this.config.openai.organization_id,
        timeout: this.config.openai.timeout_ms || 30000,
        maxRetries: this.config.openai.max_retries || 3
      });
      this.logger.info('OpenAI provider initialized');
    }
    
    // Initialize Anthropic if configured
    if (this.config.anthropic && this.config.anthropic.api_key) {
      this.providers.anthropic = new Anthropic({
        apiKey: this.config.anthropic.api_key,
        timeout: this.config.anthropic.timeout_ms || 60000,
        maxRetries: this.config.anthropic.max_retries || 3
      });
      this.logger.info('Anthropic provider initialized');
    }
  }

  /**
   * Generate text using the specified AI provider and model
   * 
   * @param {Object} options - Generation options
   * @param {string} options.provider - AI provider (openai, anthropic)
   * @param {string} options.model - Model name to use
   * @param {Array} options.messages - Array of messages for chat completion
   * @param {string} options.prompt - Text prompt (alternative to messages)
   * @param {number} options.temperature - Sampling temperature (0.0 to 1.0)
   * @param {number} options.max_tokens - Maximum tokens to generate
   * @returns {Promise<string>} Generated text
   */
  async generateText(options) {
    const {
      provider = 'openai',
      model = null,
      messages = null,
      prompt = null,
      temperature = 0.7,
      max_tokens = 2000
    } = options;
    
    if (!this.providers[provider]) {
      throw new Error(`AI provider ${provider} not initialized`);
    }
    
    try {
      // Use provider-specific implementation
      if (provider === 'openai') {
        return await this._generateWithOpenAI(model, messages, prompt, temperature, max_tokens);
      } else if (provider === 'anthropic') {
        return await this._generateWithAnthropic(model, messages, prompt, temperature, max_tokens);
      } else {
        throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (error) {
      this.logger.error(`Error generating text with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Generate text using OpenAI
   */
  async _generateWithOpenAI(model, messages, prompt, temperature, max_tokens) {
    const defaultModel = this.config.openai.default_model || 'gpt-4-turbo';
    const modelToUse = model || defaultModel;
    
    if (messages) {
      // Use chat completion
      const response = await this.providers.openai.chat.completions.create({
        model: modelToUse,
        messages,
        temperature,
        max_tokens
      });
      
      return response.choices[0].message.content;
    } else if (prompt) {
      // Use text completion (for older models) or chat completion with a user message
      if (modelToUse.startsWith('gpt-3.5') || modelToUse.startsWith('gpt-4')) {
        // For newer models, wrap the prompt in a chat format
        const response = await this.providers.openai.chat.completions.create({
          model: modelToUse,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens
        });
        
        return response.choices[0].message.content;
      } else {
        // Legacy models (unlikely to be used but included for completeness)
        const response = await this.providers.openai.completions.create({
          model: modelToUse,
          prompt,
          temperature,
          max_tokens
        });
        
        return response.choices[0].text;
      }
    } else {
      throw new Error('Either messages or prompt must be provided');
    }
  }

  /**
   * Generate text using Anthropic
   */
  async _generateWithAnthropic(model, messages, prompt, temperature, max_tokens) {
    const defaultModel = this.config.anthropic.default_model || 'claude-3-opus-20240229';
    const modelToUse = model || defaultModel;
    
    if (messages) {
      // Convert messages to Anthropic format
      const anthropicMessages = messages.map(msg => {
        if (msg.role === 'user') {
          return { role: 'user', content: msg.content };
        } else if (msg.role === 'assistant') {
          return { role: 'assistant', content: msg.content };
        } else if (msg.role === 'system') {
          return { role: 'system', content: msg.content };
        }
        // Skip other roles
        return null;
      }).filter(Boolean);
      
      const response = await this.providers.anthropic.messages.create({
        model: modelToUse,
        messages: anthropicMessages,
        temperature,
        max_tokens
      });
      
      return response.content[0].text;
    } else if (prompt) {
      // Use messages format with a user message
      const response = await this.providers.anthropic.messages.create({
        model: modelToUse,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens
      });
      
      return response.content[0].text;
    } else {
      throw new Error('Either messages or prompt must be provided');
    }
  }
}

module.exports = AIProviderService;