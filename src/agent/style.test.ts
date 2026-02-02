/**
 * Tests for Response Style Configuration
 */

import { describe, it, expect } from 'vitest';
import {
  StyleManager,
  parseStyle,
  getStyleDescription,
  STYLE_PRESETS,
  type ResponseStyle,
} from './style.js';

describe('STYLE_PRESETS', () => {
  it('should have terse preset', () => {
    expect(STYLE_PRESETS.terse).toBeDefined();
    expect(STYLE_PRESETS.terse.style).toBe('terse');
    expect(STYLE_PRESETS.terse.codeComments).toBe(false);
    expect(STYLE_PRESETS.terse.stepByStep).toBe(false);
    expect(STYLE_PRESETS.terse.maxLength).toBe(500);
  });

  it('should have balanced preset', () => {
    expect(STYLE_PRESETS.balanced).toBeDefined();
    expect(STYLE_PRESETS.balanced.style).toBe('balanced');
    expect(STYLE_PRESETS.balanced.codeComments).toBe(true);
    expect(STYLE_PRESETS.balanced.maxLength).toBe(0);
  });

  it('should have verbose preset', () => {
    expect(STYLE_PRESETS.verbose).toBeDefined();
    expect(STYLE_PRESETS.verbose.style).toBe('verbose');
    expect(STYLE_PRESETS.verbose.stepByStep).toBe(true);
    expect(STYLE_PRESETS.verbose.showReasoning).toBe(true);
  });
});

describe('StyleManager', () => {
  describe('constructor', () => {
    it('should create with string style', () => {
      const manager = new StyleManager('terse');

      expect(manager.getStyle()).toBe('terse');
    });

    it('should create with config object', () => {
      const manager = new StyleManager({
        style: 'verbose',
        codeComments: false,
        maxLength: 1000,
      });

      const config = manager.getConfig();
      expect(config.style).toBe('verbose');
      expect(config.codeComments).toBe(false);
      expect(config.maxLength).toBe(1000);
    });

    it('should default to balanced', () => {
      const manager = new StyleManager();

      expect(manager.getStyle()).toBe('balanced');
    });
  });

  describe('setStyle', () => {
    it('should change style preset', () => {
      const manager = new StyleManager('terse');

      manager.setStyle('verbose');

      expect(manager.getStyle()).toBe('verbose');
      const config = manager.getConfig();
      expect(config.stepByStep).toBe(true);
    });
  });

  describe('configure', () => {
    it('should update specific options', () => {
      const manager = new StyleManager('balanced');

      manager.configure({ codeComments: false, maxLength: 1000 });

      const config = manager.getConfig();
      expect(config.style).toBe('balanced');
      expect(config.codeComments).toBe(false);
      expect(config.maxLength).toBe(1000);
    });
  });

  describe('addInstruction', () => {
    it('should add custom instruction', () => {
      const manager = new StyleManager('balanced');

      manager.addInstruction('Always use TypeScript');
      manager.addInstruction('Prefer functional programming');

      const prompt = manager.buildStylePrompt();
      expect(prompt).toContain('Always use TypeScript');
      expect(prompt).toContain('Prefer functional programming');
    });
  });

  describe('clearInstructions', () => {
    it('should clear custom instructions', () => {
      const manager = new StyleManager('balanced');
      manager.addInstruction('Always use TypeScript');

      manager.clearInstructions();

      const prompt = manager.buildStylePrompt();
      expect(prompt).not.toContain('Always use TypeScript');
    });
  });

  describe('buildStylePrompt', () => {
    it('should build terse style prompt', () => {
      const manager = new StyleManager('terse');
      const prompt = manager.buildStylePrompt();

      expect(prompt).toContain('Response Style Guidelines');
      expect(prompt).toContain('concise and direct');
      expect(prompt).toContain('Do not add comments');
      expect(prompt).toContain('under 500 characters');
    });

    it('should build balanced style prompt', () => {
      const manager = new StyleManager('balanced');
      const prompt = manager.buildStylePrompt();

      expect(prompt).toContain('helpful and conversational');
      expect(prompt).toContain('markdown formatting');
    });

    it('should build verbose style prompt', () => {
      const manager = new StyleManager('verbose');
      const prompt = manager.buildStylePrompt();

      expect(prompt).toContain('detailed explanations');
      expect(prompt).toContain('step by step');
      expect(prompt).toContain('reasoning and thought process');
    });

    it('should include custom instructions', () => {
      const manager = new StyleManager('balanced');
      manager.addInstruction('Test instruction');

      const prompt = manager.buildStylePrompt();

      expect(prompt).toContain('Custom Instructions');
      expect(prompt).toContain('Test instruction');
    });
  });

  describe('withOverrides', () => {
    it('should create new manager with overrides', () => {
      const original = new StyleManager('balanced');
      original.addInstruction('Original instruction');

      const overridden = original.withOverrides({ codeComments: false });

      // Original unchanged
      expect(original.getConfig().codeComments).toBe(true);

      // New manager has override
      expect(overridden.getConfig().codeComments).toBe(false);

      // Custom instructions preserved
      const prompt = overridden.buildStylePrompt();
      expect(prompt).toContain('Original instruction');
    });
  });
});

describe('parseStyle', () => {
  it('should parse terse variants', () => {
    expect(parseStyle('terse')).toBe('terse');
    expect(parseStyle('TERSE')).toBe('terse');
    expect(parseStyle('brief')).toBe('terse');
    expect(parseStyle('short')).toBe('terse');
    expect(parseStyle('minimal')).toBe('terse');
  });

  it('should parse verbose variants', () => {
    expect(parseStyle('verbose')).toBe('verbose');
    expect(parseStyle('VERBOSE')).toBe('verbose');
    expect(parseStyle('detailed')).toBe('verbose');
    expect(parseStyle('long')).toBe('verbose');
    expect(parseStyle('full')).toBe('verbose');
  });

  it('should parse balanced variants', () => {
    expect(parseStyle('balanced')).toBe('balanced');
    expect(parseStyle('normal')).toBe('balanced');
    expect(parseStyle('default')).toBe('balanced');
  });

  it('should default to balanced for unknown input', () => {
    expect(parseStyle('unknown')).toBe('balanced');
    expect(parseStyle('')).toBe('balanced');
  });
});

describe('getStyleDescription', () => {
  it('should return descriptions for each style', () => {
    expect(getStyleDescription('terse')).toContain('Brief');
    expect(getStyleDescription('balanced')).toContain('Normal');
    expect(getStyleDescription('verbose')).toContain('Detailed');
  });
});
