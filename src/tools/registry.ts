import type { Tool, ToolRegistry } from './types.js';
import type { ToolDefinition } from '../providers/types.js';

export class ToolRegistryImpl implements ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getAllTools().map((tool) => tool.definition);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }
}

/**
 * Create a registry with all default tools
 */
export async function createDefaultToolRegistry(): Promise<ToolRegistryImpl> {
  const { ReadTool } = await import('./read.js');
  const { WriteTool } = await import('./write.js');
  const { EditTool } = await import('./edit.js');
  const { BashTool } = await import('./bash.js');
  const { BrowserTool } = await import('./browser/index.js');

  const registry = new ToolRegistryImpl();
  registry.registerTool(new ReadTool());
  registry.registerTool(new WriteTool());
  registry.registerTool(new EditTool());
  registry.registerTool(new BashTool());
  registry.registerTool(new BrowserTool());

  return registry;
}
