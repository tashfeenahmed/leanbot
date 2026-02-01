import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router, RouterOptions, ProviderHealth } from './router.js';
import type { LLMProvider, CompletionRequest, CompletionResponse } from '../providers/types.js';
import { ComplexityTier } from './complexity.js';

// Mock provider factory
function createMockProvider(
  name: string,
  available = true,
  healthy = true
): LLMProvider & { checkHealth?: () => Promise<boolean> } {
  return {
    name,
    isAvailable: () => available,
    checkHealth: vi.fn().mockResolvedValue(healthy),
    complete: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: `Response from ${name}` }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
      model: name,
    } as CompletionResponse),
  };
}

describe('Router', () => {
  describe('constructor', () => {
    it('should create router with default configuration', () => {
      const router = new Router({});
      expect(router).toBeInstanceOf(Router);
    });

    it('should create router with custom provider order', () => {
      const router = new Router({
        providerOrder: ['groq', 'openai', 'anthropic'],
      });
      expect(router.getProviderOrder()).toEqual(['groq', 'openai', 'anthropic']);
    });
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      const router = new Router({});
      const provider = createMockProvider('test');
      router.registerProvider(provider);
      expect(router.getProvider('test')).toBe(provider);
    });

    it('should override existing provider with same name', () => {
      const router = new Router({});
      const provider1 = createMockProvider('test');
      const provider2 = createMockProvider('test');
      router.registerProvider(provider1);
      router.registerProvider(provider2);
      expect(router.getProvider('test')).toBe(provider2);
    });
  });

  describe('selectProvider', () => {
    let router: Router;

    beforeEach(() => {
      router = new Router({
        providerOrder: ['groq', 'openai', 'anthropic'],
        tierMapping: {
          fast: ['groq', 'openai'],
          standard: ['openai', 'anthropic'],
          capable: ['anthropic'],
        },
      });
      router.registerProvider(createMockProvider('groq'));
      router.registerProvider(createMockProvider('openai'));
      router.registerProvider(createMockProvider('anthropic'));
    });

    it('should select first available provider for fast tier', async () => {
      const provider = await router.selectProvider('fast');
      expect(provider?.name).toBe('groq');
    });

    it('should select first available provider for capable tier', async () => {
      const provider = await router.selectProvider('capable');
      expect(provider?.name).toBe('anthropic');
    });

    it('should fallback to next provider if first is unavailable', async () => {
      router.registerProvider(createMockProvider('groq', false));
      const provider = await router.selectProvider('fast');
      expect(provider?.name).toBe('openai');
    });

    it('should return undefined if no providers available', async () => {
      router.registerProvider(createMockProvider('groq', false));
      router.registerProvider(createMockProvider('openai', false));
      router.registerProvider(createMockProvider('anthropic', false));
      const provider = await router.selectProvider('fast');
      expect(provider).toBeUndefined();
    });
  });

  describe('health checking', () => {
    let router: Router;

    beforeEach(() => {
      router = new Router({
        healthCheckInterval: 1000,
        unhealthyThreshold: 2,
      });
    });

    it('should track provider health status', async () => {
      const provider = createMockProvider('test', true, true);
      router.registerProvider(provider);

      await router.checkProviderHealth('test');
      const health = router.getProviderHealth('test');

      expect(health?.isHealthy).toBe(true);
      expect(health?.consecutiveFailures).toBe(0);
    });

    it('should mark provider unhealthy after consecutive failures', async () => {
      const provider = createMockProvider('test', true, false);
      router.registerProvider(provider);

      // Fail twice to exceed threshold
      await router.checkProviderHealth('test');
      await router.checkProviderHealth('test');

      const health = router.getProviderHealth('test');
      expect(health?.isHealthy).toBe(false);
      expect(health?.consecutiveFailures).toBe(2);
    });

    it('should recover health after successful check', async () => {
      const provider = createMockProvider('test', true, false);
      router.registerProvider(provider);

      // Fail twice
      await router.checkProviderHealth('test');
      await router.checkProviderHealth('test');

      // Now succeed
      (provider.checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      await router.checkProviderHealth('test');

      const health = router.getProviderHealth('test');
      expect(health?.isHealthy).toBe(true);
      expect(health?.consecutiveFailures).toBe(0);
    });

    it('should skip unhealthy providers during selection', async () => {
      router = new Router({
        providerOrder: ['fast', 'slow'],
        tierMapping: { fast: ['fast', 'slow'] },
        unhealthyThreshold: 1,
      });

      const fastProvider = createMockProvider('fast', true, false);
      const slowProvider = createMockProvider('slow', true, true);
      router.registerProvider(fastProvider);
      router.registerProvider(slowProvider);

      // Mark fast as unhealthy
      await router.checkProviderHealth('fast');

      const provider = await router.selectProvider('fast');
      expect(provider?.name).toBe('slow');
    });
  });

  describe('fallback chain', () => {
    let router: Router;

    beforeEach(() => {
      router = new Router({
        providerOrder: ['primary', 'fallback1', 'fallback2'],
        tierMapping: {
          fast: ['primary', 'fallback1', 'fallback2'],
        },
      });
    });

    it('should execute request with fallback on failure', async () => {
      const primaryProvider = createMockProvider('primary', true, true);
      (primaryProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Primary failed')
      );

      const fallbackProvider = createMockProvider('fallback1', true, true);

      router.registerProvider(primaryProvider);
      router.registerProvider(fallbackProvider);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await router.executeWithFallback(request, 'fast');

      expect(result.provider).toBe('fallback1');
      expect(result.response.content[0]).toEqual({
        type: 'text',
        text: 'Response from fallback1',
      });
    });

    it('should try all providers in fallback chain', async () => {
      const providers = ['primary', 'fallback1', 'fallback2'].map((name) => {
        const p = createMockProvider(name, true, true);
        if (name !== 'fallback2') {
          (p.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error(`${name} failed`)
          );
        }
        return p;
      });

      providers.forEach((p) => router.registerProvider(p));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await router.executeWithFallback(request, 'fast');

      expect(result.provider).toBe('fallback2');
    });

    it('should throw if all providers fail', async () => {
      const providers = ['primary', 'fallback1', 'fallback2'].map((name) => {
        const p = createMockProvider(name, true, true);
        (p.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
          new Error(`${name} failed`)
        );
        return p;
      });

      providers.forEach((p) => router.registerProvider(p));

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(router.executeWithFallback(request, 'fast')).rejects.toThrow(
        'All providers failed'
      );
    });

    it('should record failure metrics for failed providers', async () => {
      const primaryProvider = createMockProvider('primary', true, true);
      (primaryProvider.complete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Primary failed')
      );

      const fallbackProvider = createMockProvider('fallback1', true, true);

      router.registerProvider(primaryProvider);
      router.registerProvider(fallbackProvider);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await router.executeWithFallback(request, 'fast');

      const health = router.getProviderHealth('primary');
      expect(health?.consecutiveFailures).toBeGreaterThan(0);
    });
  });

  describe('complexity-based routing', () => {
    let router: Router;

    beforeEach(() => {
      router = new Router({
        tierMapping: {
          fast: ['groq'],
          standard: ['openai'],
          capable: ['anthropic'],
        },
      });
      router.registerProvider(createMockProvider('groq'));
      router.registerProvider(createMockProvider('openai'));
      router.registerProvider(createMockProvider('anthropic'));
    });

    it('should route trivial messages to fast tier', async () => {
      const provider = await router.selectProviderForMessage('hi');
      expect(provider?.name).toBe('groq');
    });

    it('should route complex messages to capable tier', async () => {
      const provider = await router.selectProviderForMessage(
        'Refactor the entire authentication system to use JWT'
      );
      expect(provider?.name).toBe('anthropic');
    });

    it('should respect tier override', async () => {
      const provider = await router.selectProviderForMessage('hi', 'capable');
      expect(provider?.name).toBe('anthropic');
    });
  });
});
