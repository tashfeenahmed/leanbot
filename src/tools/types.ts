import type { Logger } from 'pino';
import type { ToolDefinition } from '../providers/types.js';

/**
 * Execution context passed to all tools
 */
export interface ToolContext {
  workspace: string;
  sessionId: string;
  logger: Logger;
}

/**
 * Result returned by tool execution
 */
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Tool interface that all tools must implement
 */
export interface Tool {
  name: string;
  description: string;
  definition: ToolDefinition;
  execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

/**
 * Tool registry for managing available tools
 */
export interface ToolRegistry {
  registerTool(tool: Tool): void;
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
  getToolDefinitions(): ToolDefinition[];
}
