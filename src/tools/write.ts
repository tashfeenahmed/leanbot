import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolContext, ToolResult } from './types.js';
import type { ToolDefinition } from '../providers/types.js';

export class WriteTool implements Tool {
  name = 'write';
  description = 'Write content to a file, creating parent directories if needed';

  definition: ToolDefinition = {
    name: 'write',
    description: 'Write content to a file. Creates parent directories automatically. Overwrites existing files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const filePath = input.path as string;
    const content = input.content as string;

    try {
      // Create parent directories if they don't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Check if file exists (for logging purposes)
      let exists = false;
      try {
        await fs.access(filePath);
        exists = true;
      } catch {
        // File doesn't exist, that's fine
      }

      // Write the file
      await fs.writeFile(filePath, content, 'utf-8');

      const action = exists ? 'Updated' : 'Created';
      const bytes = Buffer.byteLength(content, 'utf-8');

      context.logger.debug({ filePath, bytes, action: action.toLowerCase() }, 'File written successfully');

      return {
        success: true,
        output: `Successfully ${action.toLowerCase()} file: ${filePath} (${bytes} bytes)`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      context.logger.error({ filePath, error: err.message }, 'Failed to write file');
      return {
        success: false,
        output: '',
        error: `Failed to write file: ${err.message}`,
      };
    }
  }
}
