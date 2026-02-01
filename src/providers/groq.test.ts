import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroqProvider } from './groq.js';
import type { CompletionRequest } from './types.js';

// Mock the groq-sdk module
vi.mock('groq-sdk', () => {
  const MockGroq = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }));
  return { default: MockGroq };
});

describe('GroqProvider', () => {
  let provider: GroqProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GroqProvider({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create provider with default model', () => {
      expect(provider.name).toBe('groq');
      expect(provider.model).toBe('llama-3.3-70b-versatile');
    });

    it('should create provider with custom model', () => {
      const customProvider = new GroqProvider({
        apiKey: 'test-key',
        model: 'mixtral-8x7b-32768',
      });
      expect(customProvider.model).toBe('mixtral-8x7b-32768');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is present', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const noKeyProvider = new GroqProvider({ apiKey: '' });
      expect(noKeyProvider.isAvailable()).toBe(false);
    });
  });

  describe('complete', () => {
    it('should format response correctly', async () => {
      const { default: Groq } = await import('groq-sdk');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Hello from Groq!',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
        model: 'llama-3.3-70b-versatile',
      });

      const mockInstance = new Groq({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (provider as unknown as { client: typeof mockInstance }).client = mockInstance;

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await provider.complete(request);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello from Groq!' });
      expect(response.stopReason).toBe('end_turn');
    });

    it('should include system message in messages array', async () => {
      const { default: Groq } = await import('groq-sdk');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'llama-3.3-70b-versatile',
      });

      const mockInstance = new Groq({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (provider as unknown as { client: typeof mockInstance }).client = mockInstance;

      await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'You are a helpful assistant',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            { role: 'system', content: 'You are a helpful assistant' },
          ]),
        })
      );
    });

    it('should handle tool calls', async () => {
      const { default: Groq } = await import('groq-sdk');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call_456',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"city": "London"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
        model: 'llama-3.3-70b-versatile',
      });

      const mockInstance = new Groq({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (provider as unknown as { client: typeof mockInstance }).client = mockInstance;

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Weather?' }],
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content).toContainEqual({
        type: 'tool_use',
        id: 'call_456',
        name: 'get_weather',
        input: { city: 'London' },
      });
    });
  });

  describe('speed characteristics', () => {
    it('should be marked as a fast provider', () => {
      expect(provider.characteristics.speed).toBe('fast');
    });
  });
});
