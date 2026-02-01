import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ContextManager,
  ContextManagerOptions,
  CompressedContext,
} from './context.js';
import type { Message } from '../providers/types.js';

describe('ContextManager', () => {
  let manager: ContextManager;

  describe('constructor', () => {
    it('should create manager with default options', () => {
      manager = new ContextManager({});
      expect(manager).toBeInstanceOf(ContextManager);
    });

    it('should create manager with custom options', () => {
      manager = new ContextManager({
        hotWindowSize: 10,
        maxContextTokens: 100000,
        compressionThreshold: 0.8,
        maxToolOutputBytes: 50000,
      });
      expect(manager.getHotWindowSize()).toBe(10);
      expect(manager.getMaxContextTokens()).toBe(100000);
    });
  });

  describe('hot window', () => {
    beforeEach(() => {
      manager = new ContextManager({
        hotWindowSize: 5,
      });
    });

    it('should keep last N messages in hot window', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const result = manager.processMessages(messages);

      expect(result.hotMessages).toHaveLength(5);
      expect(result.hotMessages[0].content).toBe('Message 5');
      expect(result.hotMessages[4].content).toBe('Message 9');
    });

    it('should not compress if messages fit in hot window', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = manager.processMessages(messages);

      expect(result.hotMessages).toHaveLength(2);
      expect(result.warmSummary).toBeUndefined();
    });

    it('should include warm summary for older messages', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const result = manager.processMessages(messages);

      expect(result.warmSummary).toBeDefined();
      expect(result.warmSummary?.messageCount).toBe(5);
    });
  });

  describe('warm summary', () => {
    beforeEach(() => {
      manager = new ContextManager({
        hotWindowSize: 3,
      });
    });

    it('should compress older messages into summary', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
        { role: 'user', content: 'Question 2' },
        { role: 'assistant', content: 'Answer 2' },
        { role: 'user', content: 'Question 3' },
        { role: 'assistant', content: 'Answer 3' },
      ];

      const result = manager.processMessages(messages);

      expect(result.warmSummary).toBeDefined();
      expect(result.warmSummary?.summary).toContain('Question 1');
      expect(result.warmSummary?.summary).toContain('Answer 1');
    });

    it('should include tool use information in summary', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Read file.txt' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me read that file.' },
            { type: 'tool_use', id: '1', name: 'read', input: { path: 'file.txt' } },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: '1',
              content: 'File contents here',
            },
          ],
        },
        { role: 'assistant', content: 'The file contains...' },
        { role: 'user', content: 'Now do something else' },
        { role: 'assistant', content: 'Sure!' },
      ];

      const result = manager.processMessages(messages);

      expect(result.warmSummary?.toolsUsed).toContain('read');
    });

    it('should track topics discussed in summary', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Tell me about TypeScript' },
        { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript' },
        { role: 'user', content: 'What about React?' },
        { role: 'assistant', content: 'React is a UI library' },
        { role: 'user', content: 'Current question' },
        { role: 'assistant', content: 'Current answer' },
      ];

      const result = manager.processMessages(messages);

      expect(result.warmSummary?.topics).toBeDefined();
      expect(result.warmSummary?.topics?.length).toBeGreaterThan(0);
    });
  });

  describe('tool output truncation', () => {
    beforeEach(() => {
      manager = new ContextManager({
        maxToolOutputBytes: 100, // Very small for testing
      });
    });

    it('should truncate large tool outputs', () => {
      const largeOutput = 'x'.repeat(200);
      const messages: Message[] = [
        { role: 'user', content: 'Read big file' },
        {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: '1', name: 'read', input: { path: 'big.txt' } },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: '1',
              content: largeOutput,
            },
          ],
        },
      ];

      const result = manager.processMessages(messages);

      // Find the tool result in hot messages
      const toolResultMsg = result.hotMessages.find(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some((c) => c.type === 'tool_result')
      );

      expect(toolResultMsg).toBeDefined();
      const toolResult = (toolResultMsg!.content as Array<{ type: string; content?: string }>).find(
        (c) => c.type === 'tool_result'
      );
      expect(toolResult?.content?.length).toBeLessThan(200);
    });

    it('should store hash for truncated outputs', () => {
      const largeOutput = 'Important data: ' + 'x'.repeat(200);
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: '1',
              content: largeOutput,
            },
          ],
        },
      ];

      manager.processMessages(messages);

      // Should be able to retrieve by hash
      const hashes = manager.getTruncatedOutputHashes();
      expect(hashes.length).toBeGreaterThan(0);
    });

    it('should allow retrieval of full output by hash', () => {
      const largeOutput = 'Original content: ' + 'x'.repeat(200);
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: '1',
              content: largeOutput,
            },
          ],
        },
      ];

      manager.processMessages(messages);

      const hashes = manager.getTruncatedOutputHashes();
      const retrieved = manager.getFullOutputByHash(hashes[0]);
      expect(retrieved).toBe(largeOutput);
    });

    it('should not truncate small outputs', () => {
      const smallOutput = 'Small output';
      const messages: Message[] = [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: '1',
              content: smallOutput,
            },
          ],
        },
      ];

      const result = manager.processMessages(messages);

      const toolResult = (result.hotMessages[0].content as Array<{ type: string; content?: string }>).find(
        (c) => c.type === 'tool_result'
      );
      expect(toolResult?.content).toBe(smallOutput);
    });
  });

  describe('auto-compression', () => {
    it('should trigger compression at threshold', () => {
      manager = new ContextManager({
        hotWindowSize: 3,
        maxContextTokens: 100,
        compressionThreshold: 0.7,
      });

      // Create messages that exceed threshold
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'A'.repeat(20), // ~5 tokens each
      }));

      const result = manager.processMessages(messages);

      expect(result.wasCompressed).toBe(true);
      expect(result.warmSummary).toBeDefined();
    });

    it('should not compress below threshold', () => {
      manager = new ContextManager({
        hotWindowSize: 10,
        maxContextTokens: 10000,
        compressionThreshold: 0.7,
      });

      const messages: Message[] = [
        { role: 'user', content: 'Short' },
        { role: 'assistant', content: 'Response' },
      ];

      const result = manager.processMessages(messages);

      expect(result.wasCompressed).toBe(false);
    });
  });

  describe('token estimation', () => {
    beforeEach(() => {
      manager = new ContextManager({});
    });

    it('should estimate tokens for messages', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello world' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const estimate = manager.estimateTokens(messages);
      expect(estimate).toBeGreaterThan(0);
    });

    it('should estimate tokens for content blocks', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me help' },
            { type: 'tool_use', id: '1', name: 'read', input: { path: 'file.txt' } },
          ],
        },
      ];

      const estimate = manager.estimateTokens(messages);
      expect(estimate).toBeGreaterThan(0);
    });
  });

  describe('context capacity', () => {
    beforeEach(() => {
      manager = new ContextManager({
        maxContextTokens: 1000,
      });
    });

    it('should report remaining capacity', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      manager.processMessages(messages);

      const capacity = manager.getRemainingCapacity(messages);
      expect(capacity).toBeLessThan(1000);
      expect(capacity).toBeGreaterThan(0);
    });

    it('should report usage percentage', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello world this is a longer message' },
        { role: 'assistant', content: 'This is a response with more content too' },
      ];

      const usage = manager.getCapacityUsage(messages);
      expect(usage).toBeGreaterThan(0);
      expect(usage).toBeLessThan(1);
    });
  });

  describe('buildContextMessages', () => {
    beforeEach(() => {
      manager = new ContextManager({
        hotWindowSize: 3,
      });
    });

    it('should build messages array for LLM request', () => {
      const messages: Message[] = Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const contextMessages = manager.buildContextMessages(messages);

      // Should include system context about compressed history + hot messages
      expect(contextMessages.length).toBeLessThanOrEqual(messages.length);
    });

    it('should include compressed history indicator', () => {
      const messages: Message[] = Array.from({ length: 8 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const contextMessages = manager.buildContextMessages(messages);

      // First message should indicate there's compressed history
      const hasContextNote = contextMessages.some(
        (m) =>
          typeof m.content === 'string' &&
          m.content.toLowerCase().includes('previous')
      );
      expect(hasContextNote).toBe(true);
    });
  });
});
