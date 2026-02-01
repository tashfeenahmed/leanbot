import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ToolContext } from '../types.js';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          url: vi.fn().mockReturnValue('https://example.com'),
          title: vi.fn().mockResolvedValue('Example Domain'),
          click: vi.fn().mockResolvedValue(undefined),
          type: vi.fn().mockResolvedValue(undefined),
          fill: vi.fn().mockResolvedValue(undefined),
          selectOption: vi.fn().mockResolvedValue(undefined),
          waitForSelector: vi.fn().mockResolvedValue(undefined),
          waitForNavigation: vi.fn().mockResolvedValue(undefined),
          screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
          textContent: vi.fn().mockResolvedValue('Page text content'),
          innerHTML: vi.fn().mockResolvedValue('<div>Page HTML</div>'),
          content: vi.fn().mockResolvedValue('<html><body>Full page</body></html>'),
          getAttribute: vi.fn().mockResolvedValue('attribute-value'),
          $: vi.fn().mockResolvedValue({}),
          locator: vi.fn().mockReturnValue({
            scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
          }),
          keyboard: {
            press: vi.fn().mockResolvedValue(undefined),
          },
          evaluate: vi.fn().mockImplementation((fn: any) => {
            if (typeof fn === 'string') {
              return Promise.resolve('evaluated');
            }
            // For snapshot, return mock elements
            if (fn.toString().includes('querySelectorAll')) {
              return Promise.resolve([
                {
                  ref: 1,
                  tag: 'button',
                  text: 'Click me',
                  selector: 'button.submit',
                  rect: { x: 100, y: 100, width: 100, height: 40 },
                },
                {
                  ref: 2,
                  tag: 'input',
                  text: '',
                  selector: 'input[name="email"]',
                  attributes: { type: 'email', placeholder: 'Enter email' },
                  rect: { x: 100, y: 150, width: 200, height: 30 },
                },
              ]);
            }
            // For text extraction
            if (fn.toString().includes('innerText')) {
              return Promise.resolve('Page body text');
            }
            return Promise.resolve(undefined);
          }),
          goBack: vi.fn().mockResolvedValue(undefined),
          goForward: vi.fn().mockResolvedValue(undefined),
          reload: vi.fn().mockResolvedValue(undefined),
          viewportSize: vi.fn().mockReturnValue({ width: 1280, height: 720 }),
          setDefaultTimeout: vi.fn(),
        }),
        addCookies: vi.fn().mockResolvedValue(undefined),
        cookies: vi.fn().mockResolvedValue([]),
        clearCookies: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

const createMockContext = (): ToolContext => ({
  workspace: '/test/workspace',
  sessionId: 'test-session',
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as any,
});

describe('Browser Types', () => {
  it('should export browser types', async () => {
    const types = await import('./types.js');

    expect(types).toBeDefined();
  });
});

describe('BrowserSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Reset singleton
    const { BrowserSession } = await import('./session.js');
    BrowserSession.resetInstance();
  });

  it('should create singleton instance', async () => {
    const { BrowserSession } = await import('./session.js');

    const session1 = BrowserSession.getInstance();
    const session2 = BrowserSession.getInstance();

    expect(session1).toBe(session2);
  });

  it('should report availability based on playwright', async () => {
    const { BrowserSession } = await import('./session.js');
    const session = BrowserSession.getInstance();

    // Playwright is mocked, so it should be available
    const available = await session.isAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should return state when not open', async () => {
    const { BrowserSession } = await import('./session.js');
    const session = BrowserSession.getInstance();

    const state = await session.getState();
    expect(state.isOpen).toBe(false);
  });
});

describe('BrowserTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { BrowserSession } = await import('./session.js');
    BrowserSession.resetInstance();
  });

  it('should create tool with correct definition', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();

    expect(tool.name).toBe('browser');
    expect(tool.definition.input_schema.properties).toHaveProperty('operation');
    expect(tool.definition.input_schema.required).toContain('operation');
  });

  it('should require URL for navigate operation', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const context = createMockContext();

    const result = await tool.execute({ operation: 'navigate' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('URL is required');
  });

  it('should require target for click operation', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const context = createMockContext();

    const result = await tool.execute({ operation: 'click' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Target is required');
  });

  it('should require target and text for type operation', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const context = createMockContext();

    const result1 = await tool.execute({ operation: 'type' }, context);
    expect(result1.success).toBe(false);
    expect(result1.error).toContain('Target is required');

    const result2 = await tool.execute({ operation: 'type', target: 1 }, context);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('Text is required');
  });

  it('should require key for press operation', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const context = createMockContext();

    const result = await tool.execute({ operation: 'press' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Key is required');
  });

  it('should handle unknown operation', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const context = createMockContext();

    const result = await tool.execute({ operation: 'unknown' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown operation');
  });

  it('should handle close operation', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const context = createMockContext();

    const result = await tool.execute({ operation: 'close' }, context);

    expect(result.success).toBe(true);
    expect(result.output).toContain('Browser closed');
  });

  it('should list all operations in definition', async () => {
    const { BrowserTool } = await import('./browser.js');

    const tool = new BrowserTool();
    const operations = (tool.definition.input_schema.properties as any).operation.enum;

    expect(operations).toContain('navigate');
    expect(operations).toContain('snapshot');
    expect(operations).toContain('click');
    expect(operations).toContain('type');
    expect(operations).toContain('fill');
    expect(operations).toContain('select');
    expect(operations).toContain('press');
    expect(operations).toContain('screenshot');
    expect(operations).toContain('extract');
    expect(operations).toContain('wait');
    expect(operations).toContain('scroll');
    expect(operations).toContain('back');
    expect(operations).toContain('forward');
    expect(operations).toContain('reload');
    expect(operations).toContain('close');
  });
});

describe('Browser Tool Integration', () => {
  it('should be registered in default tool registry', async () => {
    const { createDefaultToolRegistry } = await import('../registry.js');

    const registry = await createDefaultToolRegistry();

    expect(registry.hasTool('browser')).toBe(true);
  });

  it('should get browser tool from registry', async () => {
    const { createDefaultToolRegistry } = await import('../registry.js');

    const registry = await createDefaultToolRegistry();
    const tool = registry.getTool('browser');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('browser');
  });
});

describe('Browser Index Exports', () => {
  it('should export all browser components', async () => {
    const browserModule = await import('./index.js');

    expect(browserModule.BrowserSession).toBeDefined();
    expect(browserModule.BrowserTool).toBeDefined();
  });
});
