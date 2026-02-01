import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Provider configuration schemas
const anthropicProviderSchema = z.object({
  apiKey: z.string().min(1, 'Anthropic API key is required'),
  model: z.string().default('claude-sonnet-4-20250514'),
});

const providersSchema = z.object({
  anthropic: anthropicProviderSchema,
});

// Channel configuration schemas
const telegramChannelSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default(''),
});

const channelsSchema = z.object({
  telegram: telegramChannelSchema,
});

// Agent configuration schema
const agentSchema = z.object({
  workspace: z.string().min(1, 'Workspace path is required'),
  maxIterations: z.number().int().positive().default(20),
});

// Logging configuration schema
const loggingSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

// Main configuration schema
export const configSchema = z.object({
  providers: providersSchema,
  channels: channelsSchema,
  agent: agentSchema,
  logging: loggingSchema.default({ level: 'info' }),
});

// Type inference from schema
export type Config = z.infer<typeof configSchema>;
export type ProviderConfig = z.infer<typeof providersSchema>;
export type ChannelConfig = z.infer<typeof channelsSchema>;
export type AgentConfig = z.infer<typeof agentSchema>;
export type LoggingConfig = z.infer<typeof loggingSchema>;

/**
 * Load configuration from environment variables
 * @returns Validated configuration object
 * @throws Error if configuration is invalid
 */
export function loadConfig(): Config {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const workspace = process.env.AGENT_WORKSPACE || process.cwd();
  const maxIterations = process.env.AGENT_MAX_ITERATIONS
    ? parseInt(process.env.AGENT_MAX_ITERATIONS, 10)
    : 20;
  const logLevel = process.env.LOG_LEVEL || 'info';

  const rawConfig = {
    providers: {
      anthropic: {
        apiKey: anthropicApiKey,
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      },
    },
    channels: {
      telegram: {
        enabled: !!telegramBotToken,
        botToken: telegramBotToken || '',
      },
    },
    agent: {
      workspace,
      maxIterations,
    },
    logging: {
      level: logLevel,
    },
  };

  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return result.data;
}

// Export a singleton config instance (lazy loaded)
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = null;
}
