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
 * Tool categories for organization and policy filtering
 */
export type ToolCategory = 'coding' | 'system' | 'browser' | 'search' | 'memory' | 'comms' | 'meta';

/**
 * Tool policy for allowlist/denylist filtering
 */
export type FilterMode = 'allowlist' | 'denylist';

export interface ToolPolicy {
  mode: FilterMode;
  tools?: string[];           // Specific tool names
  categories?: ToolCategory[]; // Tool categories
}

/**
 * Tool group for organizing related tools
 */
export interface ToolGroup {
  id: string;
  name: string;
  description?: string;
  tools: string[];
}

/**
 * Tool interface that all tools must implement
 */
export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  definition: ToolDefinition;
  execute(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

/**
 * Tool registry for managing available tools
 */
export interface ToolRegistry {
  // Core registration
  registerTool(tool: Tool): void;
  getTool(name: string): Tool | undefined;
  getAllTools(): Tool[];
  getToolDefinitions(): ToolDefinition[];

  // Category methods
  getToolsByCategory(category: ToolCategory): Tool[];
  getCategories(): ToolCategory[];

  // Policy filtering
  setPolicy(policy: ToolPolicy): void;
  getPolicy(): ToolPolicy | undefined;
  clearPolicy(): void;
  isToolAllowed(name: string): boolean;
  getFilteredTools(): Tool[];
  getFilteredToolDefinitions(): ToolDefinition[];

  // Group methods
  registerGroup(group: ToolGroup): void;
  getGroup(id: string): ToolGroup | undefined;
  getAllGroups(): ToolGroup[];
  getGroupTools(groupId: string): Tool[];
}
