import * as path from 'path';
import type { Logger } from 'pino';
import type { Config } from '../config/config.js';
import { AnthropicProvider, ProviderRegistry, type LLMProvider } from '../providers/index.js';
import { createDefaultToolRegistry, type ToolRegistry } from '../tools/index.js';
import { SessionManager } from '../agent/session.js';
import { Agent } from '../agent/agent.js';
import { TelegramChannel } from '../channels/telegram.js';

export interface GatewayOptions {
  config: Config;
  logger: Logger;
}

export class Gateway {
  private config: Config;
  private logger: Logger;

  private providerRegistry: ProviderRegistry | null = null;
  private toolRegistry: ToolRegistry | null = null;
  private sessionManager: SessionManager | null = null;
  private agent: Agent | null = null;
  private telegramChannel: TelegramChannel | null = null;

  private isInitialized = false;
  private isRunning = false;

  constructor(options: GatewayOptions) {
    this.config = options.config;
    this.logger = options.logger;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing gateway...');

    // Initialize provider registry
    this.providerRegistry = new ProviderRegistry();
    this.initializeProviders();

    // Initialize tool registry
    this.toolRegistry = await createDefaultToolRegistry();
    this.logger.debug({ tools: this.toolRegistry.getAllTools().map((t) => t.name) }, 'Tools registered');

    // Initialize session manager
    const sessionsDir = path.join(this.config.agent.workspace, 'sessions');
    this.sessionManager = new SessionManager(sessionsDir);
    this.logger.debug({ sessionsDir }, 'Session manager initialized');

    // Initialize agent
    const provider = this.providerRegistry.getDefaultProvider();
    if (!provider) {
      throw new Error('No LLM provider available. Please configure at least one provider.');
    }

    this.agent = new Agent({
      provider,
      sessionManager: this.sessionManager,
      toolRegistry: this.toolRegistry,
      workspace: this.config.agent.workspace,
      logger: this.logger,
      maxIterations: this.config.agent.maxIterations,
    });
    this.logger.debug('Agent initialized');

    this.isInitialized = true;
    this.logger.info('Gateway initialized successfully');
  }

  private initializeProviders(): void {
    if (!this.providerRegistry) return;

    // Initialize Anthropic provider
    const anthropicConfig = this.config.providers.anthropic;
    if (anthropicConfig.apiKey) {
      const anthropic = new AnthropicProvider({
        apiKey: anthropicConfig.apiKey,
        model: anthropicConfig.model,
      });
      this.providerRegistry.registerProvider(anthropic);
      this.logger.debug({ provider: 'anthropic', model: anthropicConfig.model }, 'Provider registered');
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    this.logger.info('Starting gateway...');

    // Start Telegram channel if enabled
    if (this.config.channels.telegram.enabled && this.config.channels.telegram.botToken) {
      this.telegramChannel = new TelegramChannel({
        botToken: this.config.channels.telegram.botToken,
        agent: this.agent!,
        sessionManager: this.sessionManager!,
        logger: this.logger,
      });
      await this.telegramChannel.start();
    }

    this.isRunning = true;
    this.logger.info('Gateway started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping gateway...');

    // Stop Telegram channel
    if (this.telegramChannel) {
      await this.telegramChannel.stop();
      this.telegramChannel = null;
    }

    this.isRunning = false;
    this.logger.info('Gateway stopped');
  }

  getProvider(): LLMProvider | undefined {
    return this.providerRegistry?.getDefaultProvider();
  }

  getToolRegistry(): ToolRegistry {
    if (!this.toolRegistry) {
      throw new Error('Gateway not initialized');
    }
    return this.toolRegistry;
  }

  getSessionManager(): SessionManager {
    if (!this.sessionManager) {
      throw new Error('Gateway not initialized');
    }
    return this.sessionManager;
  }

  getAgent(): Agent {
    if (!this.agent) {
      throw new Error('Gateway not initialized');
    }
    return this.agent;
  }

  isGatewayRunning(): boolean {
    return this.isRunning;
  }
}

/**
 * Setup signal handlers for graceful shutdown
 */
export function setupGracefulShutdown(gateway: Gateway, logger: Logger): void {
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');
    try {
      await gateway.stop();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
