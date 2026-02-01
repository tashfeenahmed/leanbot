import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterProvider } from './openrouter.js';
import type { CompletionRequest } from './types.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenRouterProvider({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create provider with default model', () => {
      expect(provider.name).toBe('openrouter');
      expect(provider.model).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should create provider with custom model', () => {
      const customProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        model: 'openai/gpt-4o',
      });
      expect(customProvider.model).toBe('openai/gpt-4o');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is present', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const noKeyProvider = new OpenRouterProvider({ apiKey: '' });
      expect(noKeyProvider.isAvailable()).toBe(false);
    });
  });

  describe('complete', () => {
    it('should make correct API call to OpenRouter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: 'Hello from OpenRouter!',
                  tool_calls: null,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
            },
            model: 'anthropic/claude-3.5-sonnet',
          }),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'You are helpful',
      };

      const response = await provider.complete(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'HTTP-Referer': expect.any(String),
          }),
        })
      );

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello from OpenRouter!' });
    });

    it('should handle tool calls correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_789',
                      type: 'function',
                      function: {
                        name: 'search',
                        arguments: '{"query": "test"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 15, completion_tokens: 10 },
            model: 'anthropic/claude-3.5-sonnet',
          }),
      });

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Search' }],
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content).toContainEqual({
        type: 'tool_use',
        id: 'call_789',
        name: 'search',
        input: { query: 'test' },
      });
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } }),
      });

      await expect(
        provider.complete({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow();
    });

    it('should retry on rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['retry-after', '1']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
              model: 'anthropic/claude-3.5-sonnet',
            }),
        });

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.content[0]).toEqual({ type: 'text', text: 'OK' });
    });
  });

  describe('model routing', () => {
    it('should support switching models dynamically', () => {
      expect(provider.model).toBe('anthropic/claude-3.5-sonnet');

      const fastProvider = new OpenRouterProvider({
        apiKey: 'test-key',
        model: 'meta-llama/llama-3.3-70b-instruct',
      });
      expect(fastProvider.model).toBe('meta-llama/llama-3.3-70b-instruct');
    });
  });

  describe('characteristics', () => {
    it('should have route-based pricing', () => {
      expect(provider.characteristics.pricingType).toBe('routed');
    });
  });
});
