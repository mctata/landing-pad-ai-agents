/**
 * AI Provider Service
 * Provides access to AI models for text generation and analysis
 */

const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

class AIProviderService {
  /**
   * Create a new AI provider service
   * @param {Object} config - Configuration object
   * @param {Object} logger - Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize OpenAI client if configured
    if (config.openai && config.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey,
        organization: config.openai.organization
      });
      this.logger.info('OpenAI client initialized');
    }
    
    // Initialize Anthropic client if configured
    if (config.anthropic && config.anthropic.apiKey) {
      this.anthropic = new Anthropic({
        apiKey: config.anthropic.apiKey
      });
      this.logger.info('Anthropic client initialized');
    }
    
    // Default provider and model
    this.defaultProvider = 'anthropic';
    this.defaultModels = {
      anthropic: 'claude-3-opus-20240229',
      openai: 'gpt-4-0125-preview'
    };
    
    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
  }
  
  /**
   * Generate text using AI
   * @param {Object} options - Text generation options
   * @param {string} options.provider - AI provider (openai or anthropic)
   * @param {string} options.model - Model name
   * @param {Array} options.messages - Messages for chat completion
   * @param {number} options.temperature - Temperature (0.0 to 1.0)
   * @param {number} options.max_tokens - Maximum tokens to generate
   * @returns {Promise<string>} Generated text
   */
  async generateText(options) {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModels[provider];
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const maxTokens = options.max_tokens || 1000;
    
    // Validate input
    if (!Array.isArray(options.messages) || options.messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }
    
    // Add retry logic
    let attempt = 0;
    let lastError = null;
    
    while (attempt < this.maxRetries) {
      try {
        if (provider === 'openai') {
          return await this._generateWithOpenAI(model, options.messages, temperature, maxTokens);
        } else if (provider === 'anthropic') {
          return await this._generateWithAnthropic(model, options.messages, temperature, maxTokens);
        } else {
          throw new Error(`Unsupported AI provider: ${provider}`);
        }
      } catch (error) {
        lastError = error;
        attempt++;
        
        // Check if error is retryable
        if (error.status === 429 || error.status >= 500) {
          this.logger.warn(`AI request failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`);
          
          if (attempt < this.maxRetries) {
            // Exponential backoff
            const delay = this.retryDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Non-retryable error
          break;
        }
      }
    }
    
    // If we get here, all attempts failed
    this.logger.error(`All ${this.maxRetries} attempts to generate text with ${provider} failed`, lastError);
    throw lastError || new Error(`Failed to generate text with ${provider}`);
  }
  
  /**
   * Generate text using OpenAI
   * @private
   */
  async _generateWithOpenAI(model, messages, temperature, maxTokens) {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    });
    
    this.logger.debug('Generated text with OpenAI', {
      model,
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens
    });
    
    // Return only the content of the message
    return completion.choices[0].message.content;
  }
  
  /**
   * Generate text using Anthropic
   * @private
   */
  async _generateWithAnthropic(model, messages, temperature, maxTokens) {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }
    
    // Convert messages to Anthropic format
    const anthropicMessages = this._convertToAnthropicFormat(messages);
    
    const completion = await this.anthropic.messages.create({
      model,
      messages: anthropicMessages,
      temperature,
      max_tokens: maxTokens
    });
    
    this.logger.debug('Generated text with Anthropic', {
      model,
      inputTokens: completion.usage.input_tokens,
      outputTokens: completion.usage.output_tokens
    });
    
    // Return only the content of the message
    return completion.content[0].text;
  }
  
  /**
   * Convert messages from OpenAI format to Anthropic format
   * @private
   */
  _convertToAnthropicFormat(messages) {
    return messages.map(message => {
      // Map OpenAI roles to Anthropic roles
      let role = message.role;
      if (role === 'system') {
        // We use the first message as a system message
        return { role: 'system', content: message.content };
      } else if (role === 'assistant') {
        return { role: 'assistant', content: message.content };
      } else {
        // Default to user for any other role
        return { role: 'user', content: message.content };
      }
    });
  }
  
  /**
   * Analyze text using AI
   * @param {Object} options - Text analysis options
   * @param {string} options.provider - AI provider (openai or anthropic)
   * @param {string} options.model - Model name
   * @param {string} options.text - Text to analyze
   * @param {string} options.task - Analysis task (sentiment, entities, summarize, etc.)
   * @param {Object} options.parameters - Task-specific parameters
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeText(options) {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModels[provider];
    const text = options.text;
    const task = options.task || 'analyze';
    const parameters = options.parameters || {};
    
    // Validate input
    if (!text) {
      throw new Error('Text is required for analysis');
    }
    
    // Create system and user messages based on task
    const systemMessage = {
      role: 'system',
      content: this._getSystemPromptForTask(task, parameters)
    };
    
    const userMessage = {
      role: 'user',
      content: `${text}`
    };
    
    // Generate analysis using AI
    const result = await this.generateText({
      provider,
      model,
      messages: [systemMessage, userMessage],
      temperature: parameters.temperature || 0.2,
      max_tokens: parameters.max_tokens || 1000
    });
    
    // Parse JSON response if expected
    if (parameters.format === 'json') {
      try {
        return JSON.parse(result);
      } catch (error) {
        this.logger.warn('Failed to parse JSON from AI response', { error: error.message });
        
        // Try to extract JSON from the response
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (nestedError) {
            this.logger.error('Failed to extract JSON from response', { error: nestedError.message });
          }
        }
        
        // Return the raw text if JSON parsing fails
        return { text: result, parsing_error: error.message };
      }
    }
    
    return { text: result };
  }
  
  /**
   * Get system prompt for a specific analysis task
   * @private
   */
  _getSystemPromptForTask(task, parameters) {
    switch (task) {
      case 'sentiment':
        return `You are a sentiment analysis expert. Analyze the sentiment of the provided text and return a JSON object with the following properties:
          - sentiment: "positive", "negative", or "neutral"
          - confidence: a number between 0 and 1
          - scores: an object with positive, negative, and neutral scores (0-1)
          - summary: a brief explanation of the sentiment assessment`;
        
      case 'entities':
        return `You are an entity recognition expert. Identify entities mentioned in the provided text and return a JSON array of entity objects, each with the following properties:
          - text: the entity text
          - type: the entity type (person, organization, location, date, etc.)
          - start: character offset where the entity starts
          - end: character offset where the entity ends
          - confidence: a number between 0 and 1`;
        
      case 'summarize':
        const maxLength = parameters.max_length || 200;
        return `You are a summarization expert. Provide a concise summary of the text in ${maxLength} characters or less. Focus on the key points and maintain the original meaning.`;
        
      case 'keywords':
        const count = parameters.count || 10;
        return `You are a keyword extraction expert. Identify the ${count} most important keywords or phrases in the text and return them as a JSON array of strings.`;
        
      case 'categorize':
        const categories = parameters.categories ? JSON.stringify(parameters.categories) : 'determine appropriate categories';
        return `You are a content categorization expert. Analyze the text and categorize it according to these categories: ${categories}. Return a JSON array of the most relevant categories.`;
        
      default:
        return `You are an expert text analyst. Analyze the provided text and return insights about its content, style, and structure.`;
    }
  }
  
  /**
   * Check AI service availability
   * @param {string} provider - Provider to check (openai or anthropic)
   * @returns {Promise<boolean>} True if the service is available
   */
  async checkAvailability(provider) {
    provider = provider || this.defaultProvider;
    
    try {
      if (provider === 'openai') {
        if (!this.openai) return false;
        
        // Simple ping to check if the API is responding
        await this.openai.models.list({ limit: 1 });
        return true;
      } else if (provider === 'anthropic') {
        if (!this.anthropic) return false;
        
        // Simple ping to check if the API is responding
        await this.anthropic.models.list();
        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.logger.error(`Error checking ${provider} availability:`, error);
      return false;
    }
  }
  
  /**
   * Get available AI models
   * @param {string} provider - Provider to check (openai or anthropic)
   * @returns {Promise<Array>} List of available models
   */
  async getAvailableModels(provider) {
    provider = provider || this.defaultProvider;
    
    try {
      if (provider === 'openai') {
        if (!this.openai) return [];
        
        const response = await this.openai.models.list();
        return response.data.map(model => ({
          id: model.id,
          created: model.created,
          provider: 'openai'
        }));
      } else if (provider === 'anthropic') {
        if (!this.anthropic) return [];
        
        const response = await this.anthropic.models.list();
        return response.data.map(model => ({
          id: model.id,
          created: new Date(model.created * 1000),
          provider: 'anthropic'
        }));
      } else {
        return [];
      }
    } catch (error) {
      this.logger.error(`Error getting ${provider} models:`, error);
      return [];
    }
  }
}

module.exports = AIProviderService;