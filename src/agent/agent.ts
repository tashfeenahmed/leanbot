import * as fs from 'fs/promises';
import * as path from 'path';
import type { Logger } from 'pino';
import type {
  LLMProvider,
  Message,
  ContentBlock,
  ToolUseContent,
  TokenUsage,
  CompletionRequest,
} from '../providers/types.js';
import type { ToolRegistry, ToolContext } from '../tools/types.js';
import type { SessionManager } from './session.js';

export interface AgentOptions {
  provider: LLMProvider;
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  workspace: string;
  logger: Logger;
  maxIterations: number;
  systemPrompt?: string;
}

export interface AgentResult {
  response: string;
  tokenUsage: TokenUsage;
  iterationsUsed: number;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant with access to tools for file operations and command execution.

You can:
- Read files from the filesystem
- Write and edit files
- Execute bash commands

Always be helpful and thorough in completing tasks. When using tools, explain what you're doing.`;

export class Agent {
  private provider: LLMProvider;
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;
  private workspace: string;
  private logger: Logger;
  private maxIterations: number;
  private baseSystemPrompt: string;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.sessionManager = options.sessionManager;
    this.toolRegistry = options.toolRegistry;
    this.workspace = options.workspace;
    this.logger = options.logger;
    this.maxIterations = options.maxIterations;
    this.baseSystemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  }

  async processMessage(sessionId: string, userMessage: string): Promise<AgentResult> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message to session
    await this.sessionManager.addMessage(sessionId, {
      role: 'user',
      content: userMessage,
    });

    // Build system prompt
    const systemPrompt = await this.buildSystemPrompt();

    // Get tool definitions
    const tools = this.toolRegistry.getToolDefinitions();

    // Track usage across iterations
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iterations = 0;
    let finalResponse = '';

    // Agent loop
    while (iterations < this.maxIterations) {
      iterations++;

      // Get current messages from session
      const currentSession = await this.sessionManager.getSession(sessionId);
      const messages = currentSession?.messages || [];

      // Build completion request
      const request: CompletionRequest = {
        messages,
        system: systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        maxTokens: 4096,
      };

      this.logger.debug({ iteration: iterations, messageCount: messages.length }, 'Agent iteration');

      // Call LLM
      const response = await this.provider.complete(request);

      // Track token usage
      totalInputTokens += response.usage.inputTokens;
      totalOutputTokens += response.usage.outputTokens;

      // Process response content
      const textContent = this.extractTextContent(response.content);
      const toolUses = this.extractToolUses(response.content);

      // If no tool use, we're done
      if (response.stopReason === 'end_turn' || toolUses.length === 0) {
        finalResponse = textContent || 'I completed the task.';

        // Add assistant response to session
        await this.sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: response.content,
        });

        break;
      }

      // Add assistant message with tool use
      await this.sessionManager.addMessage(sessionId, {
        role: 'assistant',
        content: response.content,
      });

      // Execute tools and gather results
      const toolResults = await this.executeTools(toolUses, sessionId);

      // Add tool results as user message
      await this.sessionManager.addMessage(sessionId, {
        role: 'user',
        content: toolResults,
      });

      // If this is the last iteration, add a warning
      if (iterations >= this.maxIterations) {
        finalResponse = `I've reached the maximum iterations (${this.maxIterations}). Here's what I've done so far: ${textContent || 'Multiple tool operations completed.'}`;
      }
    }

    // Record token usage
    const tokenUsage = { inputTokens: totalInputTokens, outputTokens: totalOutputTokens };
    await this.sessionManager.recordTokenUsage(sessionId, tokenUsage);

    this.logger.info(
      { sessionId, iterations, inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      'Message processed'
    );

    return {
      response: finalResponse,
      tokenUsage,
      iterationsUsed: iterations,
    };
  }

  private async buildSystemPrompt(): Promise<string> {
    let prompt = this.baseSystemPrompt;

    // Add workspace context
    prompt += `\n\nWorkspace: ${this.workspace}`;

    // Load SOUL.md if present
    const soulPath = path.join(this.workspace, 'SOUL.md');
    try {
      const soulContent = await fs.readFile(soulPath, 'utf-8');
      prompt += `\n\n## Behavioral Guidelines (from SOUL.md)\n${soulContent}`;
    } catch {
      // SOUL.md not found, that's fine
    }

    return prompt;
  }

  private extractTextContent(content: ContentBlock[]): string {
    return content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  }

  private extractToolUses(content: ContentBlock[]): ToolUseContent[] {
    return content.filter((block): block is ToolUseContent => block.type === 'tool_use');
  }

  private async executeTools(
    toolUses: ToolUseContent[],
    sessionId: string
  ): Promise<ContentBlock[]> {
    const results: ContentBlock[] = [];

    for (const toolUse of toolUses) {
      const tool = this.toolRegistry.getTool(toolUse.name);

      if (!tool) {
        this.logger.warn({ toolName: toolUse.name }, 'Unknown tool requested');
        results.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: Unknown tool "${toolUse.name}"`,
          is_error: true,
        });
        continue;
      }

      const context: ToolContext = {
        workspace: this.workspace,
        sessionId,
        logger: this.logger.child({ tool: toolUse.name }),
      };

      this.logger.debug({ toolName: toolUse.name, input: toolUse.input }, 'Executing tool');

      try {
        const result = await tool.execute(toolUse.input, context);

        results.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.success ? result.output : `Error: ${result.error}`,
          is_error: !result.success,
        });
      } catch (error) {
        const err = error as Error;
        this.logger.error({ toolName: toolUse.name, error: err.message }, 'Tool execution failed');
        results.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error executing tool: ${err.message}`,
          is_error: true,
        });
      }
    }

    return results;
  }
}
