/**
 * Unit tests for AI Provider Service
 */

const AIProviderService = require('../../../src/services/AIProviderService');

// Mock external AI provider SDKs
jest.mock('@anthropic-ai/sdk', () => {
  return {
    Anthropic: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ text: 'Mock Anthropic response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
          id: 'mock-message-id'
        })
      }
    }))
  };
});

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock OpenAI response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            id: 'mock-completion-id'
          })
        }
      }
    }))
  };
});

// Mock the logger
jest.mock('../../../src/services/LoggerService', () => {
  return jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }));
});

// Mock the config
jest.mock('../../../src/services/ConfigService', () => {
  return {
    getInstance: jest.fn().mockReturnValue({
      getConfig: jest.fn().mockReturnValue({
        openai: {
          apiKey: 'mock-openai-key',
          model: 'gpt-4o'
        },
        anthropic: {
          apiKey: 'mock-anthropic-key',
          model: 'claude-3-sonnet-20240229'
        }
      })
    })
  };
});

describe('AIProviderService', () => {
  let aiProviderService;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance of AIProviderService
    aiProviderService = AIProviderService.getInstance();
  });
  
  describe('OpenAI Integration', () => {
    it('should generate text using OpenAI', async () => {
      // Arrange
      const prompt = 'Test prompt for OpenAI';
      const options = { provider: 'openai', maxTokens: 100 };
      
      // Act
      const result = await aiProviderService.generateText(prompt, options);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBe('Mock OpenAI response');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage).toBeDefined();
    });
    
    it('should handle OpenAI errors gracefully', async () => {
      // Arrange
      const openai = require('openai');
      openai.OpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API error'))
          }
        }
      }));
      
      // Act & Assert
      await expect(
        aiProviderService.generateText('Test prompt', { provider: 'openai' })
      ).rejects.toThrow('Failed to generate text with OpenAI');
    });
  });
  
  describe('Anthropic Integration', () => {
    it('should generate text using Anthropic', async () => {
      // Arrange
      const prompt = 'Test prompt for Anthropic';
      const options = { provider: 'anthropic', maxTokens: 100 };
      
      // Act
      const result = await aiProviderService.generateText(prompt, options);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBe('Mock Anthropic response');
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-sonnet-20240229');
      expect(result.usage).toBeDefined();
    });
    
    it('should handle Anthropic errors gracefully', async () => {
      // Arrange
      const anthropic = require('@anthropic-ai/sdk');
      anthropic.Anthropic.mockImplementationOnce(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Anthropic API error'))
        }
      }));
      
      // Act & Assert
      await expect(
        aiProviderService.generateText('Test prompt', { provider: 'anthropic' })
      ).rejects.toThrow('Failed to generate text with Anthropic');
    });
  });
  
  describe('Provider Selection', () => {
    it('should use OpenAI as the default provider', async () => {
      // Act
      const result = await aiProviderService.generateText('Test prompt');
      
      // Assert
      expect(result.provider).toBe('openai');
    });
    
    it('should switch providers based on options', async () => {
      // Act
      const result = await aiProviderService.generateText('Test prompt', { provider: 'anthropic' });
      
      // Assert
      expect(result.provider).toBe('anthropic');
    });
    
    it('should throw error for invalid provider', async () => {
      // Act & Assert
      await expect(
        aiProviderService.generateText('Test prompt', { provider: 'invalid-provider' })
      ).rejects.toThrow('Unsupported AI provider');
    });
  });
  
  describe('Parameter Handling', () => {
    it('should apply default parameters when not provided', async () => {
      // Replace the OpenAI mock to check parameters
      const openai = require('openai');
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        id: 'mock-id'
      });
      
      openai.OpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));
      
      // Act
      await aiProviderService.generateText('Test prompt');
      
      // Assert
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: expect.any(Array),
          max_tokens: expect.any(Number),
          temperature: expect.any(Number)
        })
      );
    });
    
    it('should override default parameters with provided options', async () => {
      // Replace the OpenAI mock to check parameters
      const openai = require('openai');
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        id: 'mock-id'
      });
      
      openai.OpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));
      
      // Act
      await aiProviderService.generateText('Test prompt', {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        maxTokens: 500,
        temperature: 0.8
      });
      
      // Assert
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          max_tokens: 500,
          temperature: 0.8
        })
      );
    });
  });
});