import { spawn } from 'child_process';
import type { Tool, ToolContext, ToolResult } from './types.js';
import type { ToolDefinition } from '../providers/types.js';

const DEFAULT_TIMEOUT = 60000; // 60 seconds
const MAX_OUTPUT_SIZE = 30 * 1024; // 30KB

export class BashTool implements Tool {
  name = 'bash';
  category = 'system' as const;
  description = 'Execute a bash command and return its output';

  definition: ToolDefinition = {
    name: 'bash',
    description: 'Execute a bash command in the workspace directory. Returns stdout/stderr with optional timeout.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The bash command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000)',
        },
      },
      required: ['command'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const command = input.command as string;
    const timeout = (input.timeout as number) || DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn('bash', ['-c', command], {
        cwd: context.workspace,
        env: { ...process.env },
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        // Force kill after 5 seconds if still running
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, timeout);

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        // Truncate if too large
        if (stdout.length > MAX_OUTPUT_SIZE) {
          stdout = stdout.substring(0, MAX_OUTPUT_SIZE);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        // Truncate if too large
        if (stderr.length > MAX_OUTPUT_SIZE) {
          stderr = stderr.substring(0, MAX_OUTPUT_SIZE);
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        if (killed) {
          context.logger.warn({ command, timeout }, 'Command killed due to timeout');
          resolve({
            success: false,
            output: stdout,
            error: `Command killed due to timeout (${timeout}ms)`,
          });
          return;
        }

        // Truncation notice
        let truncationNotice = '';
        if (stdout.length >= MAX_OUTPUT_SIZE) {
          truncationNotice = '\n[Output truncated at 30KB]';
        }

        if (code === 0) {
          context.logger.debug({ command, exitCode: code }, 'Command executed successfully');
          resolve({
            success: true,
            output: stdout + truncationNotice,
          });
        } else {
          context.logger.debug({ command, exitCode: code, stderr }, 'Command failed');
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Command exited with code ${code}`,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        context.logger.error({ command, error: err.message }, 'Command execution error');
        resolve({
          success: false,
          output: '',
          error: `Failed to execute command: ${err.message}`,
        });
      });
    });
  }
}
