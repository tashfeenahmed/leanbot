import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock the telegram module to avoid actual bot creation
vi.mock('../channels/telegram.js', () => ({
  TelegramChannel: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('Gateway', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leanbot-gateway-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create gateway with valid config', async () => {
      const { Gateway } = await import('./gateway.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: false,
              botToken: '',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      expect(gateway).toBeDefined();
    });

    it('should initialize provider registry', async () => {
      const { Gateway } = await import('./gateway.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: false,
              botToken: '',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      await gateway.initialize();

      const provider = gateway.getProvider();
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('anthropic');
    });

    it('should initialize tool registry with default tools', async () => {
      const { Gateway } = await import('./gateway.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: false,
              botToken: '',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      await gateway.initialize();

      const tools = gateway.getToolRegistry().getAllTools();
      expect(tools.length).toBe(4); // read, write, edit, bash
    });

    it('should initialize session manager', async () => {
      const { Gateway } = await import('./gateway.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: false,
              botToken: '',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      await gateway.initialize();

      const sessionManager = gateway.getSessionManager();
      expect(sessionManager).toBeDefined();
    });
  });

  describe('channel management', () => {
    it('should not start telegram channel when disabled', async () => {
      const { Gateway } = await import('./gateway.js');
      const { TelegramChannel } = await import('../channels/telegram.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: false,
              botToken: '',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      await gateway.initialize();
      await gateway.start();

      expect(TelegramChannel).not.toHaveBeenCalled();
    });

    it('should start telegram channel when enabled', async () => {
      const { Gateway } = await import('./gateway.js');
      const { TelegramChannel } = await import('../channels/telegram.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: true,
              botToken: 'test-bot-token',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      await gateway.initialize();
      await gateway.start();

      expect(TelegramChannel).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should handle graceful shutdown', async () => {
      const { Gateway } = await import('./gateway.js');
      const { pino } = await import('pino');

      const gateway = new Gateway({
        config: {
          providers: {
            anthropic: {
              apiKey: 'test-key',
              model: 'claude-sonnet-4-20250514',
            },
          },
          channels: {
            telegram: {
              enabled: true,
              botToken: 'test-bot-token',
            },
          },
          agent: {
            workspace: testDir,
            maxIterations: 20,
          },
          logging: {
            level: 'info',
          },
        },
        logger: pino({ level: 'silent' }),
      });

      await gateway.initialize();
      await gateway.start();

      // Should not throw
      await expect(gateway.stop()).resolves.not.toThrow();
    });
  });
});
