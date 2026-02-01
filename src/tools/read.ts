import * as fs from 'fs/promises';
import type { Tool, ToolContext, ToolResult } from './types.js';
import type { ToolDefinition } from '../providers/types.js';

const MAX_LINES = 500;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export class ReadTool implements Tool {
  name = 'read';
  description = 'Read the contents of a file from the filesystem';

  definition: ToolDefinition = {
    name: 'read',
    description: 'Read file contents with optional line range. Returns file content with line numbers.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to read',
        },
        startLine: {
          type: 'number',
          description: 'Starting line number (1-indexed, optional)',
        },
        endLine: {
          type: 'number',
          description: 'Ending line number (1-indexed, optional)',
        },
      },
      required: ['path'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const filePath = input.path as string;
    const startLine = input.startLine as number | undefined;
    const endLine = input.endLine as number | undefined;

    try {
      // Check if file exists
      const stats = await fs.stat(filePath);

      // Check file size
      if (stats.size > MAX_FILE_SIZE) {
        return {
          success: true,
          output: `Warning: File is large (${(stats.size / 1024).toFixed(2)} KB). Reading first ${MAX_LINES} lines.\n`,
        };
      }

      // Read file
      const buffer = await fs.readFile(filePath);

      // Check if binary
      if (this.isBinary(buffer)) {
        return {
          success: true,
          output: `File appears to be binary (${stats.size} bytes). Cannot display binary content.`,
        };
      }

      const content = buffer.toString('utf-8');
      const lines = content.split('\n');

      // Apply line range if specified
      let selectedLines = lines;
      let rangeInfo = '';

      if (startLine !== undefined || endLine !== undefined) {
        const start = (startLine || 1) - 1; // Convert to 0-indexed
        const end = endLine || lines.length;
        selectedLines = lines.slice(start, end);
        rangeInfo = ` (lines ${startLine || 1}-${end})`;
      }

      // Truncate if too many lines
      let truncated = false;
      if (selectedLines.length > MAX_LINES) {
        selectedLines = selectedLines.slice(0, MAX_LINES);
        truncated = true;
      }

      // Format with line numbers
      const startNum = startLine || 1;
      const formatted = selectedLines
        .map((line, idx) => `${String(startNum + idx).padStart(4, ' ')} | ${line}`)
        .join('\n');

      let output = formatted;
      if (truncated) {
        output += `\n\n[Truncated: showing first ${MAX_LINES} lines]`;
      }

      context.logger.debug({ filePath, lines: selectedLines.length }, 'File read successfully');

      return {
        success: true,
        output: `File: ${filePath}${rangeInfo}\n\n${output}`,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      context.logger.error({ filePath, error: err.message }, 'Failed to read file');
      return {
        success: false,
        output: '',
        error: `Failed to read file: ${err.message}`,
      };
    }
  }

  private isBinary(buffer: Buffer): boolean {
    // Check for null bytes in the first 8KB
    const sampleSize = Math.min(buffer.length, 8192);
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) {
        return true;
      }
    }
    return false;
  }
}
