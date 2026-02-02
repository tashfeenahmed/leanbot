/**
 * Response Style Configuration
 *
 * Configures the agent's response style for different use cases:
 * - terse: Brief, minimal responses (good for CLI/automation)
 * - balanced: Normal conversational responses (default)
 * - verbose: Detailed explanations (good for learning/debugging)
 *
 * Style affects:
 * - Response length
 * - Level of explanation
 * - Code comments
 * - Step-by-step breakdowns
 */

/**
 * Response style options
 */
export type ResponseStyle = 'terse' | 'balanced' | 'verbose';

/**
 * Style configuration options
 */
export interface StyleConfig {
  /** Base response style */
  style: ResponseStyle;
  /** Include code comments in generated code */
  codeComments?: boolean;
  /** Include step-by-step explanations */
  stepByStep?: boolean;
  /** Show reasoning/thinking process */
  showReasoning?: boolean;
  /** Maximum response length (0 = unlimited) */
  maxLength?: number;
  /** Use markdown formatting */
  useMarkdown?: boolean;
  /** Include examples */
  includeExamples?: boolean;
}

/**
 * Default style configurations
 */
export const STYLE_PRESETS: Record<ResponseStyle, StyleConfig> = {
  terse: {
    style: 'terse',
    codeComments: false,
    stepByStep: false,
    showReasoning: false,
    maxLength: 500,
    useMarkdown: true,
    includeExamples: false,
  },
  balanced: {
    style: 'balanced',
    codeComments: true,
    stepByStep: false,
    showReasoning: false,
    maxLength: 0,
    useMarkdown: true,
    includeExamples: true,
  },
  verbose: {
    style: 'verbose',
    codeComments: true,
    stepByStep: true,
    showReasoning: true,
    maxLength: 0,
    useMarkdown: true,
    includeExamples: true,
  },
};

/**
 * Style manager for managing response style
 */
export class StyleManager {
  private config: StyleConfig;
  private customInstructions: string[] = [];

  constructor(style: ResponseStyle | StyleConfig = 'balanced') {
    if (typeof style === 'string') {
      this.config = { ...STYLE_PRESETS[style] };
    } else {
      this.config = { ...style };
    }
  }

  /**
   * Get current style
   */
  getStyle(): ResponseStyle {
    return this.config.style;
  }

  /**
   * Get full configuration
   */
  getConfig(): StyleConfig {
    return { ...this.config };
  }

  /**
   * Set style preset
   */
  setStyle(style: ResponseStyle): void {
    this.config = { ...STYLE_PRESETS[style] };
  }

  /**
   * Update specific configuration options
   */
  configure(options: Partial<StyleConfig>): void {
    this.config = { ...this.config, ...options };
  }

  /**
   * Add custom instruction
   */
  addInstruction(instruction: string): void {
    this.customInstructions.push(instruction);
  }

  /**
   * Clear custom instructions
   */
  clearInstructions(): void {
    this.customInstructions = [];
  }

  /**
   * Build style prompt for system message
   */
  buildStylePrompt(): string {
    const lines: string[] = [];

    lines.push('## Response Style Guidelines');
    lines.push('');

    switch (this.config.style) {
      case 'terse':
        lines.push('Be concise and direct. Provide minimal explanations.');
        lines.push('Use short sentences. Avoid unnecessary words.');
        lines.push('Focus on delivering the answer or result quickly.');
        break;

      case 'balanced':
        lines.push('Be helpful and conversational.');
        lines.push('Provide enough context to understand the response.');
        lines.push('Balance brevity with clarity.');
        break;

      case 'verbose':
        lines.push('Provide detailed explanations.');
        lines.push('Walk through your reasoning step by step.');
        lines.push('Include context, alternatives, and potential issues.');
        lines.push('Help the user understand not just what, but why.');
        break;
    }

    lines.push('');

    // Code comments
    if (this.config.codeComments === false) {
      lines.push('- Do not add comments to code unless explicitly asked');
    } else if (this.config.codeComments === true) {
      lines.push('- Add helpful comments to explain non-obvious code');
    }

    // Step-by-step
    if (this.config.stepByStep) {
      lines.push('- Break down complex tasks into numbered steps');
      lines.push('- Explain what each step accomplishes');
    }

    // Reasoning
    if (this.config.showReasoning) {
      lines.push('- Share your reasoning and thought process');
      lines.push('- Explain trade-offs when making decisions');
    }

    // Examples
    if (this.config.includeExamples === false) {
      lines.push('- Skip examples unless specifically requested');
    } else if (this.config.includeExamples === true) {
      lines.push('- Include examples when they help clarify concepts');
    }

    // Max length
    if (this.config.maxLength && this.config.maxLength > 0) {
      lines.push(`- Keep responses under ${this.config.maxLength} characters when possible`);
    }

    // Markdown
    if (this.config.useMarkdown) {
      lines.push('- Use markdown formatting for code, lists, and emphasis');
    } else {
      lines.push('- Use plain text without markdown formatting');
    }

    // Custom instructions
    if (this.customInstructions.length > 0) {
      lines.push('');
      lines.push('## Custom Instructions');
      for (const instruction of this.customInstructions) {
        lines.push(`- ${instruction}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Create a new manager with overrides
   */
  withOverrides(overrides: Partial<StyleConfig>): StyleManager {
    const newManager = new StyleManager(this.config);
    newManager.configure(overrides);
    newManager.customInstructions = [...this.customInstructions];
    return newManager;
  }
}

/**
 * Parse style from string input
 */
export function parseStyle(input: string): ResponseStyle {
  const normalized = input.toLowerCase().trim();

  switch (normalized) {
    case 'terse':
    case 'brief':
    case 'short':
    case 'minimal':
      return 'terse';

    case 'verbose':
    case 'detailed':
    case 'long':
    case 'full':
      return 'verbose';

    case 'balanced':
    case 'normal':
    case 'default':
    default:
      return 'balanced';
  }
}

/**
 * Get style description for display
 */
export function getStyleDescription(style: ResponseStyle): string {
  switch (style) {
    case 'terse':
      return 'Brief, minimal responses';
    case 'balanced':
      return 'Normal conversational responses';
    case 'verbose':
      return 'Detailed explanations with reasoning';
  }
}

/**
 * Default style manager instance
 */
export const defaultStyleManager = new StyleManager('balanced');
