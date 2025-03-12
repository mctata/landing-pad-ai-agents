/**
 * Tests for the optimized AIProviderService
 * 
 * Tests caching, batch processing, and performance optimizations
 */

const AIProviderService = require('../../services/AIProviderService');
const { performanceHelpers } = require('../../testing/testHelpers');

// Mock dependencies
jest.mock('axios');
jest.mock('../../services/ConfigService', () => ({
  getConfig: jest.fn().mockReturnValue({
    'external-services': {
      ai: {
        taskRouting: {
          default: 'anthropic',
          embeddings: 'openai'
        },
        providers: {
          anthropic: {
            enabled: true,
            apiKey: 'mock-anthropic-key',
            models: {
              default: 'claude-3-haiku-20240307',
              embeddings: null
            },
            options: {
              temperature: 0.7,
              topP: 0.9,
              maxTokens: 1000,
              timeout: 30000,
              retryStrategy: {
                attempts: 3,
                initialDelay: 1000,
                factor: 2,
                maxDelay: 10000
              }
            }
          },
          openai: {
            enabled: true,
            apiKey: 'mock-openai-key',
            models: {
              default: 'gpt-4-turbo',
              embeddings: 'text-embedding-3-small'
            },
            options: {
              temperature: 0.7,
              topP: 0.9,
              maxTokens: 1000,
              timeout: 30000,
              retryStrategy: {
                attempts: 3,
                initialDelay: 1000,
                factor: 2,
                maxDelay: 10000
              }
            }
          }
        },
        cache: {
          ttl: 3600,
          checkperiod: 600,
          maxKeys: 100
        }
      }
    }
  })
}));

jest.mock('../../services/LoggerService', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

// Mock for AnthropicProvider.generateText
const mockAnthropicResponse = {
  data: {
    completion: 'This is a mock response from Anthropic Claude'
  }
};

// Mock for OpenAIProvider.generateText
const mockOpenAIResponse = {
  data: {
    choices: [
      {
        message: {
          content: 'This is a mock response from OpenAI'
        }
      }
    ]
  }
};

// Mock for OpenAIProvider.generateEmbeddings
const mockEmbeddingsResponse = {
  data: {
    data: [
      {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
      }
    ]
  }
};

describe('AIProviderService Optimizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear the cache for each test
    AIProviderService.clearCache();
    
    // Reset metrics
    AIProviderService.metrics = {
      hits: 0,
      misses: 0,
      totalRequests: 0
    };
    
    // Setup Axios mocks for provider calls
    const axiosCreate = require('axios').create;
    
    axiosCreate.mockImplementation((config) => {
      if (config.baseURL === 'https://api.anthropic.com') {
        return {
          defaults: {
            headers: config.headers
          },
          post: jest.fn().mockResolvedValue(mockAnthropicResponse)
        };
      }
      
      if (config.baseURL === 'https://api.openai.com/v1') {
        return {
          defaults: {
            headers: config.headers
          },
          post: jest.fn((endpoint) => {
            if (endpoint === '/embeddings') {
              return Promise.resolve(mockEmbeddingsResponse);
            }
            return Promise.resolve(mockOpenAIResponse);
          })
        };
      }
      
      return {
        defaults: { headers: {} },
        post: jest.fn().mockRejectedValue(new Error('Unmocked URL'))
      };
    });
  });
  
  describe('Response Caching', () => {
    it('should cache text generation results and improve performance', async () => {
      // First call will miss cache
      const firstCallTime = await performanceHelpers.measureExecutionTime(
        AIProviderService.generateText.bind(AIProviderService),
        ['Test prompt']
      );
      
      // Second call should use cache
      const secondCallTime = await performanceHelpers.measureExecutionTime(
        AIProviderService.generateText.bind(AIProviderService),
        ['Test prompt']
      );
      
      // Verify cache metrics
      expect(AIProviderService.metrics.hits).toBe(1);
      expect(AIProviderService.metrics.misses).toBe(1);
      
      // Verify performance improvement
      expect(secondCallTime.executionTime).toBeLessThan(firstCallTime.executionTime);
      
      // Get cache stats
      const cacheStats = AIProviderService.getCacheStats();
      expect(cacheStats.keys).toBe(1);
    });
    
    it('should not cache when skipCache is true', async () => {
      // First call
      await AIProviderService.generateText('Test prompt');
      
      // Second call with skipCache option
      await AIProviderService.generateText('Test prompt', { skipCache: true });
      
      // Verify cache metrics
      expect(AIProviderService.metrics.hits).toBe(0);
      expect(AIProviderService.metrics.misses).toBe(2);
    });
  });
  
  describe('Batch Processing', () => {
    it('should process multiple tasks concurrently', async () => {
      const tasks = [
        { type: 'text', data: { prompt: 'Task 1' } },
        { type: 'text', data: { prompt: 'Task 2' } },
        { type: 'embeddings', data: { text: 'Embeddings text' } }
      ];
      
      const batchResult = await AIProviderService.batchProcess(tasks);
      
      // Check overall batch results
      expect(batchResult.results.length).toBe(3);
      expect(batchResult.stats.totalTasks).toBe(3);
      expect(batchResult.stats.successCount).toBe(3);
      expect(batchResult.stats.errorCount).toBe(0);
      
      // Check individual task results
      expect(batchResult.results[0].success).toBe(true);
      expect(batchResult.results[1].success).toBe(true);
      expect(batchResult.results[2].success).toBe(true);
      
      // Check that we got appropriate responses for each task
      expect(batchResult.results[0].result).toContain('Anthropic Claude');
      expect(batchResult.results[1].result).toContain('Anthropic Claude');
      expect(Array.isArray(batchResult.results[2].result)).toBe(true);
    });
    
    it('should respect concurrency limits', async () => {
      // Create 10 tasks to test concurrency
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        type: 'text',
        data: { prompt: `Task ${i+1}` }
      }));
      
      // Set concurrency to 3
      const batchResult = await AIProviderService.batchProcess(tasks, { concurrency: 3 });
      
      // Should still process all tasks
      expect(batchResult.results.length).toBe(10);
      expect(batchResult.stats.successCount).toBe(10);
    });
    
    it('should handle errors in batch processing', async () => {
      // Mock an error for one specific prompt
      const axiosPost = jest.fn()
        .mockImplementationOnce(() => Promise.resolve(mockAnthropicResponse))
        .mockImplementationOnce(() => Promise.reject(new Error('API error')))
        .mockImplementationOnce(() => Promise.resolve(mockAnthropicResponse));
      
      require('axios').create.mockImplementationOnce(() => ({
        defaults: { headers: {} },
        post: axiosPost
      }));
      
      const tasks = [
        { type: 'text', data: { prompt: 'Success task' } },
        { type: 'text', data: { prompt: 'Error task' } },
        { type: 'text', data: { prompt: 'Another success task' } }
      ];
      
      const batchResult = await AIProviderService.batchProcess(tasks, { continueOnError: true });
      
      // Should have one failure, two successes
      expect(batchResult.stats.successCount).toBe(2);
      expect(batchResult.stats.errorCount).toBe(1);
      
      // Check individual results
      expect(batchResult.results[0].success).toBe(true);
      expect(batchResult.results[1].success).toBe(false);
      expect(batchResult.results[2].success).toBe(true);
    });
  });
  
  describe('Performance Benchmarking', () => {
    it('should compare performance of cached vs uncached requests', async () => {
      const prompt = 'Performance test prompt';
      
      // Benchmark uncached requests
      const uncachedBenchmark = await performanceHelpers.benchmark(
        async () => {
          // Generate unique prompts to avoid cache hits
          const uniquePrompt = `${prompt} ${Date.now()}`;
          return await AIProviderService.generateText(uniquePrompt, { skipCache: true });
        },
        [],
        5 // 5 iterations
      );
      
      // Benchmark cached requests (run once to cache, then benchmark)
      await AIProviderService.generateText(prompt);
      
      const cachedBenchmark = await performanceHelpers.benchmark(
        async () => {
          return await AIProviderService.generateText(prompt);
        },
        [],
        5 // 5 iterations
      );
      
      // Cached requests should be faster
      expect(parseFloat(cachedBenchmark.avg)).toBeLessThan(parseFloat(uncachedBenchmark.avg));
      expect(parseFloat(cachedBenchmark.max)).toBeLessThan(parseFloat(uncachedBenchmark.max));
    });
  });
});