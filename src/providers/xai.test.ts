import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XAIProvider } from './xai.js';
import type { CompletionRequest } from './types.js';

// Mock the openai module (xAI uses OpenAI-compatible API)
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

describe('XAIProvider', () => {
  let provider: XAIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new XAIProvider({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create provider with default model', () => {
      expect(provider.name).toBe('xai');
      expect(provider.model).toBe('grok-4');
    });

    it('should create provider with custom model', () => {
      const customProvider = new XAIProvider({
        apiKey: 'test-key',
        model: 'grok-4-1-fast-reasoning',
      });
      expect(customProvider.model).toBe('grok-4-1-fast-reasoning');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is present', () => {
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when API key is empty', () => {
      const noKeyProvider = new XAIProvider({ apiKey: '' });
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
              content: 'Hello from Grok!',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
        model: 'grok-4',
      });

      const mockInstance = new OpenAI({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (provider as unknown as { client: typeof mockInstance }).client = mockInstance;

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await provider.complete(request);

      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toEqual({ type: 'text', text: 'Hello from Grok!' });
      expect(response.stopReason).toBe('end_turn');
    });

    it('should include system message in messages array', async () => {
      const { default: OpenAI } = await import('openai');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'OK' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'grok-4',
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
                  id: 'call_789',
                  type: 'function',
                  function: {
                    name: 'search_web',
                    arguments: '{"query": "latest news"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10 },
        model: 'grok-4',
      });

      const mockInstance = new OpenAI({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (provider as unknown as { client: typeof mockInstance }).client = mockInstance;

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Search for news' }],
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.content).toContainEqual({
        type: 'tool_use',
        id: 'call_789',
        name: 'search_web',
        input: { query: 'latest news' },
      });
    });

    it('should handle vision content', async () => {
      const { default: OpenAI } = await import('openai');
      const mockCreate = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: 'I see a cat in the image',
              tool_calls: null,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
        model: 'grok-2-vision-1212',
      });

      const visionProvider = new XAIProvider({
        apiKey: 'test-key',
        model: 'grok-2-vision-1212',
      });

      const mockInstance = new OpenAI({ apiKey: 'test' });
      (mockInstance.chat.completions.create as unknown) = mockCreate;
      (visionProvider as unknown as { client: typeof mockInstance }).client = mockInstance;

      const request: CompletionRequest = {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: 'base64data',
                },
              },
            ],
          },
        ],
      };

      const response = await visionProvider.complete(request);

      expect(response.content[0]).toEqual({
        type: 'text',
        text: 'I see a cat in the image',
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
