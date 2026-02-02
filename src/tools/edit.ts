import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult } from './types.js';
import type { ToolDefinition } from '../providers/types.js';

export class EditTool implements Tool {
  name = 'edit';
  category = 'coding' as const;
  description = 'Find and replace text in a file';

  definition: ToolDefinition = {
    name: 'edit',
    description: 'Perform find-and-replace in a file. Can replace single or all occurrences.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to edit',
        },
        find: {
          type: 'string',
          description: 'Text to find',
        },
        replace: {
          type: 'string',
          description: 'Text to replace with',
        },
        all: {
          type: 'boolean',
          description: 'Replace all occurrences (default: false, replaces only first)',
        },
      },
      required: ['path', 'find', 'replace'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const filePath = input.path as string;
    const find = input.find as string;
    const replace = input.replace as string;
    const replaceAll = input.all as boolean | undefined;

    try {
      // Read the file
      const content = await fs.readFile(filePath, 'utf-8');

      // Check if the pattern exists
      if (!content.includes(find)) {
        return {
          success: false,
          output: '',
          error: `Pattern not found in file: "${find}"`,
        };
      }

      // Perform replacement
      let newContent: string;
      let count: number;

      if (replaceAll) {
        // Count occurrences
        count = content.split(find).length - 1;
        newContent = content.split(find).join(replace);
      } else {
        count = 1;
        newContent = content.replace(find, replace);
      }

      // Write the file
      await fs.writeFile(filePath, newContent, 'utf-8');

      // Generate diff-style output
      const diffOutput = this.generateDiff(find, replace, count);

      context.logger.debug({ filePath, count }, 'File edited successfully');

      return {
        success: true,
        output: `Edited ${filePath}: ${count} replacement(s)\n\n${diffOutput}`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      context.logger.error({ filePath, error: err.message }, 'Failed to edit file');
      return {
        success: false,
        output: '',
        error: `Failed to edit file: ${err.message}`,
      };
    }
  }

  private generateDiff(find: string, replace: string, count: number): string {
    const findLines = find.split('\n');
    const replaceLines = replace.split('\n');

    let diff = '';

    // Show removed lines
    for (const line of findLines) {
      diff += `- ${line}\n`;
    }

    // Show added lines
    for (const line of replaceLines) {
      diff += `+ ${line}\n`;
    }

    if (count > 1) {
      diff += `\n(${count} occurrences replaced)`;
    }

    return diff;
  }
}
