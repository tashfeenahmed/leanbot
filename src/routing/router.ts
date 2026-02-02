import type {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
} from '../providers/types.js';
import { analyzeComplexity, type ModelTier } from './complexity.js';

export interface ProviderHealth {
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: string;
}

export interface RouterOptions {
  providerOrder?: string[];
  tierMapping?: Record<ModelTier, string[]>;
  healthCheckInterval?: number;
  unhealthyThreshold?: number;
}

export interface ExecutionResult {
  response: CompletionResponse;
  provider: string;
  attemptedProviders: string[];
}

type ProviderWithHealth = LLMProvider & {
  checkHealth?: () => Promise<boolean>;
};

export class Router {
  private providers: Map<string, ProviderWithHealth> = new Map();
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private providerOrder: string[];
  private tierMapping: Record<ModelTier, string[]>;
  private unhealthyThreshold: number;

  constructor(options: RouterOptions) {
    this.providerOrder = options.providerOrder || ['moonshot', 'anthropic', 'openai', 'groq', 'xai', 'ollama'];
    this.tierMapping = options.tierMapping || {
      fast: ['groq', 'moonshot', 'ollama', 'openai'],
      standard: ['moonshot', 'openai', 'anthropic', 'xai'],
      capable: ['anthropic', 'moonshot', 'openai', 'xai'],
    };
    this.unhealthyThreshold = options.unhealthyThreshold || 3;
  }

  getProviderOrder(): string[] {
    return [...this.providerOrder];
  }

  registerProvider(provider: ProviderWithHealth): void {
    this.providers.set(provider.name, provider);
    this.providerHealth.set(provider.name, {
      isHealthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    });
  }

  getProvider(name: string): ProviderWithHealth | undefined {
    return this.providers.get(name);
  }

  getProviderHealth(name: string): ProviderHealth | undefined {
    return this.providerHealth.get(name);
  }

  async checkProviderHealth(name: string): Promise<boolean> {
    const provider = this.providers.get(name);
    if (!provider) {
      return false;
    }

    const health = this.providerHealth.get(name) || {
      isHealthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    };

    try {
      let isHealthy = provider.isAvailable();

      // If provider has a checkHealth method, use it
      if (provider.checkHealth) {
        isHealthy = isHealthy && (await provider.checkHealth());
      }

      if (isHealthy) {
        health.isHealthy = true;
        health.consecutiveFailures = 0;
        health.lastError = undefined;
      } else {
        health.consecutiveFailures++;
        health.isHealthy = health.consecutiveFailures < this.unhealthyThreshold;
      }
    } catch (error) {
      health.consecutiveFailures++;
      health.lastError = (error as Error).message;
      health.isHealthy = health.consecutiveFailures < this.unhealthyThreshold;
    }

    health.lastCheck = new Date();
    this.providerHealth.set(name, health);

    return health.isHealthy;
  }

  async selectProvider(tier: ModelTier): Promise<ProviderWithHealth | undefined> {
    const tierProviders = this.tierMapping[tier] || [];

    for (const name of tierProviders) {
      const provider = this.providers.get(name);
      if (!provider) continue;

      const health = this.providerHealth.get(name);
      if (health && !health.isHealthy) continue;

      if (provider.isAvailable()) {
        return provider;
      }
    }

    // Fallback: try any available provider
    for (const name of this.providerOrder) {
      const provider = this.providers.get(name);
      if (!provider) continue;

      const health = this.providerHealth.get(name);
      if (health && !health.isHealthy) continue;

      if (provider.isAvailable()) {
        return provider;
      }
    }

    return undefined;
  }

  async selectProviderForMessage(
    message: string,
    overrideTier?: ModelTier
  ): Promise<ProviderWithHealth | undefined> {
    const tier = overrideTier || analyzeComplexity(message).suggestedModelTier;
    return this.selectProvider(tier);
  }

  async executeWithFallback(
    request: CompletionRequest,
    tier: ModelTier
  ): Promise<ExecutionResult> {
    const tierProviders = this.tierMapping[tier] || [];
    const attemptedProviders: string[] = [];
    const errors: Error[] = [];

    // Try tier-specific providers first
    for (const name of tierProviders) {
      const provider = this.providers.get(name);
      if (!provider) continue;

      const health = this.providerHealth.get(name);
      if (health && !health.isHealthy) continue;

      if (!provider.isAvailable()) continue;

      attemptedProviders.push(name);

      try {
        const response = await provider.complete(request);
        return {
          response,
          provider: name,
          attemptedProviders,
        };
      } catch (error) {
        errors.push(error as Error);
        this.recordFailure(name, error as Error);
      }
    }

    // Try remaining providers
    for (const name of this.providerOrder) {
      if (attemptedProviders.includes(name)) continue;

      const provider = this.providers.get(name);
      if (!provider) continue;

      const health = this.providerHealth.get(name);
      if (health && !health.isHealthy) continue;

      if (!provider.isAvailable()) continue;

      attemptedProviders.push(name);

      try {
        const response = await provider.complete(request);
        return {
          response,
          provider: name,
          attemptedProviders,
        };
      } catch (error) {
        errors.push(error as Error);
        this.recordFailure(name, error as Error);
      }
    }

    throw new Error(
      `All providers failed. Attempted: ${attemptedProviders.join(', ')}. Errors: ${errors.map((e) => e.message).join('; ')}`
    );
  }

  private recordFailure(name: string, error: Error): void {
    const health = this.providerHealth.get(name) || {
      isHealthy: true,
      lastCheck: new Date(),
      consecutiveFailures: 0,
    };

    health.consecutiveFailures++;
    health.lastError = error.message;
    health.isHealthy = health.consecutiveFailures < this.unhealthyThreshold;
    health.lastCheck = new Date();

    this.providerHealth.set(name, health);
  }
}
