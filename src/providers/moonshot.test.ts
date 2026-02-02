import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoonshotProvider } from './moonshot.js';
import type { CompletionRequest } from './types.js';

// Mock the openai module (Moonshot uses OpenAI-compatible API)
vi.mock('openai', () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  }));
  return { default: MockOpenAI };
});

describe('MoonshotProvider', () => {
  let provider: MoonshotProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new MoonshotProvider({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create provider with default model', () => {
      expect(provider.name).toBe('moonshot');
      expect(provider.model).toBe('kimi-k2.5');
    });

    it('should create provider with custom model', () => {
      const customProvider = new MoonshotProvider({
        apiKey: 'test-key',
        model: 'kimi-k2-thinking',
      });
      expect(customProvider.model).toBe('kimi-k2-thinking');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is present', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const noKeyProvider = new MoonshotProvider({ apiKey: '' });
      expect(noKeyProvider.isAvailable()).toBe(false);
    });
  });

  describe('complete', () => {
    it('should format response correctly', async () => {
      const { default: OpenAI } = await import('openai');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Hello from Kimi!',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
        model: 'kimi-k2.5',
      });

      const mockInstance = new OpenAI({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (provider as unknown as { client: typeof mockInstance }).client = mockInstance;

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await provider.complete(request);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello from Kimi!' });
      expect(response.stopReason).toBe('end_turn');
    });

    it('should include system message in messages array', async () => {
      const { default: OpenAI } = await import('openai');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'kimi-k2.5',
      });

      const mockInstance = new OpenAI({ apiKey: 'test' });
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
      const { default: OpenAI } = await import('openai');
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
                    arguments: '{"city": "Beijing"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
        model: 'kimi-k2.5',
      });

      const mockInstance = new OpenAI({ apiKey: 'test' });
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
        input: { city: 'Beijing' },
      });
    });
  });

  describe('characteristics', () => {
    it('should be marked as a fast provider', () => {
      expect(provider.characteristics.speed).toBe('fast');
    });

    it('should not be local', () => {
      expect(provider.characteristics.isLocal).toBe(false);
    });
  });
});
