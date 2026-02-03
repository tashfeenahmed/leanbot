/**
 * File Send Tool
 * Allows the agent to send files to the user via the chat channel
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Tool, ToolContext, ToolResult, ToolCategory } from './types.js';
import type { ToolDefinition } from '../providers/types.js';

export type FileSendCallback = (userId: string, filePath: string, caption?: string) => Promise<boolean>;

// Global callback for sending files
let fileSendCallback: FileSendCallback | null = null;

/**
 * Initialize the file send tool with a callback
 */
export function initializeFileSend(callback: FileSendCallback): void {
  fileSendCallback = callback;
}

export class FileSendTool implements Tool {
  name = 'send_file';
  category = 'comms' as ToolCategory;
  description = 'Send a file to the user via chat. Use this to send PDFs, images, documents, or any file the user requests.';

  definition: ToolDefinition = {
    name: 'send_file',
    description: this.description,
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to send',
        },
        caption: {
          type: 'string',
          description: 'Optional caption/message to accompany the file',
        },
      },
      required: ['file_path'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const filePath = input.file_path as string;
    const caption = input.caption as string | undefined;

    if (!filePath) {
      return {
        success: false,
        output: 'Missing required parameter: file_path',
      };
    }

    // Resolve to absolute path if relative
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(context.workspace, filePath);

    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch {
      return {
        success: false,
        output: `File not found: ${absolutePath}`,
      };
    }

    // Get file stats
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      return {
        success: false,
        output: `Not a file: ${absolutePath}`,
      };
    }

    // Check file size (Telegram limit is 50MB for bots)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (stats.size > maxSize) {
      return {
        success: false,
        output: `File too large: ${(stats.size / 1024 / 1024).toFixed(2)}MB (max 50MB)`,
      };
    }

    if (!fileSendCallback) {
      return {
        success: false,
        output: 'File sending not available - no channel configured',
      };
    }

    if (!context.userId) {
      return {
        success: false,
        output: 'Cannot send file - user ID not available',
      };
    }

    try {
      const success = await fileSendCallback(context.userId, absolutePath, caption);

      if (success) {
        const fileName = path.basename(absolutePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        return {
          success: true,
          output: `File sent successfully: ${fileName} (${sizeKB}KB)`,
        };
      } else {
        return {
          success: false,
          output: 'Failed to send file - check logs for details',
        };
      }
    } catch (error) {
      return {
        success: false,
        output: `Error sending file: ${(error as Error).message}`,
      };
    }
  }
}
