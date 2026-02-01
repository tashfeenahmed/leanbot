#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
import { pino } from 'pino';
import { loadConfig, resetConfig } from './config/index.js';
import { Gateway, setupGracefulShutdown } from './gateway/index.js';
import { createLogger } from './utils/logger.js';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('leanbot')
  .description('Personal AI assistant accessible via Telegram')
  .version(VERSION);

// Start command - runs the gateway server
program
  .command('start')
  .description('Start the LeanBot gateway server')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      resetConfig();
      const config = loadConfig();

      if (options.verbose) {
        config.logging.level = 'debug';
      }

      const logger = createLogger(config.logging);

      logger.info({ version: VERSION }, 'Starting LeanBot...');

      const gateway = new Gateway({ config, logger });
      setupGracefulShutdown(gateway, logger);

      await gateway.initialize();
      await gateway.start();

      logger.info('LeanBot is running. Press Ctrl+C to stop.');
    } catch (error) {
      console.error('Failed to start LeanBot:', (error as Error).message);
      process.exit(1);
    }
  });

// Chat command - interactive CLI chat
program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-s, --session <id>', 'Resume existing session')
  .action(async (options) => {
    try {
      resetConfig();
      const config = loadConfig();
      const logger = pino({ level: 'silent' });

      const gateway = new Gateway({ config, logger });
      await gateway.initialize();

      const sessionManager = gateway.getSessionManager();
      const agent = gateway.getAgent();

      // Get or create session
      let sessionId: string;
      if (options.session) {
        const existing = await sessionManager.getSession(options.session);
        if (!existing) {
          console.error(`Session not found: ${options.session}`);
          process.exit(1);
        }
        sessionId = options.session;
        console.log(`Resuming session: ${sessionId}`);
      } else {
        const session = await sessionManager.createSession({ channelId: 'cli' });
        sessionId = session.id;
        console.log(`Created new session: ${sessionId}`);
      }

      console.log('LeanBot Chat - Type your messages below. Use Ctrl+C to exit.\n');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'You: ',
      });

      rl.prompt();

      rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
          rl.prompt();
          return;
        }

        try {
          console.log('Assistant: (thinking...)\n');
          const result = await agent.processMessage(sessionId, input);
          console.log(`Assistant: ${result.response}\n`);
          console.log(
            `[Tokens: ${result.tokenUsage.inputTokens} in, ${result.tokenUsage.outputTokens} out]\n`
          );
        } catch (error) {
          console.error(`Error: ${(error as Error).message}\n`);
        }

        rl.prompt();
      });

      rl.on('close', () => {
        console.log('\nGoodbye!');
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start chat:', (error as Error).message);
      process.exit(1);
    }
  });

// Config command - show current configuration
program
  .command('config')
  .description('Show current configuration')
  .option('--json', 'Output as JSON')
  .action((options) => {
    try {
      resetConfig();
      const config = loadConfig();

      // Mask sensitive values
      const safeConfig = {
        providers: {
          anthropic: {
            apiKey: config.providers.anthropic.apiKey ? '***' : '(not set)',
            model: config.providers.anthropic.model,
          },
        },
        channels: {
          telegram: {
            enabled: config.channels.telegram.enabled,
            botToken: config.channels.telegram.botToken ? '***' : '(not set)',
          },
        },
        agent: config.agent,
        logging: config.logging,
      };

      if (options.json) {
        console.log(JSON.stringify(safeConfig, null, 2));
      } else {
        console.log('LeanBot Configuration:');
        console.log('');
        console.log('Providers:');
        console.log(
          `  Anthropic: ${safeConfig.providers.anthropic.apiKey} (model: ${safeConfig.providers.anthropic.model})`
        );
        console.log('');
        console.log('Channels:');
        console.log(
          `  Telegram: ${safeConfig.channels.telegram.enabled ? 'enabled' : 'disabled'} (token: ${safeConfig.channels.telegram.botToken})`
        );
        console.log('');
        console.log('Agent:');
        console.log(`  Workspace: ${safeConfig.agent.workspace}`);
        console.log(`  Max Iterations: ${safeConfig.agent.maxIterations}`);
        console.log('');
        console.log('Logging:');
        console.log(`  Level: ${safeConfig.logging.level}`);
      }
    } catch (error) {
      console.error('Failed to load config:', (error as Error).message);
      process.exit(1);
    }
  });

// Version command
program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(`LeanBot v${VERSION}`);
  });

program.parse();
