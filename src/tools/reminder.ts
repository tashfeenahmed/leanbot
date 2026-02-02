/**
 * Reminder Tool
 * Allows the agent to set reminders that trigger messages back to the user
 */

import type { Tool, ToolContext, ToolResult, ToolCategory } from './types.js';
import type { ToolDefinition } from '../providers/types.js';
import { nanoid } from 'nanoid';

export interface Reminder {
  id: string;
  message: string;
  triggerAt: Date;
  userId: string;
  sessionId: string;
  createdAt: Date;
}

export type ReminderCallback = (reminder: Reminder) => Promise<void>;

// Global state for reminders
let reminderCallback: ReminderCallback | null = null;
const activeReminders: Map<string, { reminder: Reminder; timer: NodeJS.Timeout }> = new Map();

/**
 * Initialize the reminder system with a callback for when reminders trigger
 */
export function initializeReminders(callback: ReminderCallback): void {
  reminderCallback = callback;
}

/**
 * Get all active reminders
 */
export function getActiveReminders(): Reminder[] {
  return Array.from(activeReminders.values()).map(r => r.reminder);
}

/**
 * Cancel a reminder by ID
 */
export function cancelReminder(id: string): boolean {
  const entry = activeReminders.get(id);
  if (entry) {
    clearTimeout(entry.timer);
    activeReminders.delete(id);
    return true;
  }
  return false;
}

/**
 * Parse natural language time expressions
 */
function parseDelay(input: string): number | null {
  const lower = input.toLowerCase().trim();

  // Direct minutes
  const minutesMatch = lower.match(/^(\d+)\s*(?:min(?:ute)?s?)?$/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  // Hours
  const hoursMatch = lower.match(/^(\d+)\s*(?:hour|hr)s?$/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1], 10) * 60;
  }

  // Seconds (convert to minutes, minimum 1)
  const secondsMatch = lower.match(/^(\d+)\s*(?:second|sec)s?$/);
  if (secondsMatch) {
    return Math.max(1, Math.ceil(parseInt(secondsMatch[1], 10) / 60));
  }

  // Combined format: "1 hour 30 minutes", "1h 30m", etc.
  let totalMinutes = 0;

  const hourPart = lower.match(/(\d+)\s*(?:hour|hr|h)s?/);
  if (hourPart) {
    totalMinutes += parseInt(hourPart[1], 10) * 60;
  }

  const minPart = lower.match(/(\d+)\s*(?:min(?:ute)?|m)s?/);
  if (minPart) {
    totalMinutes += parseInt(minPart[1], 10);
  }

  if (totalMinutes > 0) {
    return totalMinutes;
  }

  // Natural language
  if (lower.includes('half hour') || lower.includes('30 min')) {
    return 30;
  }
  if (lower.includes('quarter hour') || lower.includes('15 min')) {
    return 15;
  }

  return null;
}

export class ReminderTool implements Tool {
  name = 'reminder';
  category = 'meta' as ToolCategory;
  description = 'Set a reminder to trigger a message after a delay. Use for "remind me in X minutes about Y" requests. Returns immediately after scheduling.';

  definition: ToolDefinition = {
    name: 'reminder',
    description: this.description,
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set', 'list', 'cancel'],
          description: 'Action to perform: set a new reminder, list active reminders, or cancel one',
        },
        delay: {
          type: 'string',
          description: 'When to trigger (for "set"): e.g., "5", "5 minutes", "1 hour", "30 min", "1h 30m"',
        },
        message: {
          type: 'string',
          description: 'The reminder message to send when triggered (for "set")',
        },
        reminder_id: {
          type: 'string',
          description: 'Reminder ID to cancel (for "cancel" action)',
        },
      },
      required: ['action'],
    },
  };

  async execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const action = input.action as string;

    switch (action) {
      case 'set':
        return this.setReminder(input, context);
      case 'list':
        return this.listReminders();
      case 'cancel':
        return this.cancelReminder(input);
      default:
        return {
          success: false,
          output: `Unknown action: ${action}. Use 'set', 'list', or 'cancel'.`,
        };
    }
  }

  private async setReminder(
    input: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const delayStr = input.delay as string;
    const message = input.message as string;

    if (!delayStr) {
      return {
        success: false,
        output: 'Missing required parameter: delay. Example: "5 minutes", "1 hour"',
      };
    }

    if (!message) {
      return {
        success: false,
        output: 'Missing required parameter: message. What should I remind you about?',
      };
    }

    const delayMinutes = parseDelay(delayStr);
    if (delayMinutes === null || delayMinutes <= 0) {
      return {
        success: false,
        output: `Could not parse delay: "${delayStr}". Try "5 minutes", "1 hour", "30 min", etc.`,
      };
    }

    if (!reminderCallback) {
      return {
        success: false,
        output: 'Reminder system not initialized. Cannot set reminders.',
      };
    }

    const now = new Date();
    const triggerAt = new Date(now.getTime() + delayMinutes * 60 * 1000);

    const reminder: Reminder = {
      id: nanoid(8),
      message,
      triggerAt,
      userId: context.userId || 'unknown',
      sessionId: context.sessionId,
      createdAt: now,
    };

    // Schedule the reminder
    const timer = setTimeout(async () => {
      activeReminders.delete(reminder.id);
      if (reminderCallback) {
        try {
          await reminderCallback(reminder);
        } catch (error) {
          console.error('[REMINDER] Failed to trigger reminder:', error);
        }
      }
    }, delayMinutes * 60 * 1000);

    activeReminders.set(reminder.id, { reminder, timer });

    const timeStr = triggerAt.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return {
      success: true,
      output: `Reminder set! I'll remind you "${message}" in ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'} (at ${timeStr}). Reminder ID: ${reminder.id}`,
    };
  }

  private listReminders(): ToolResult {
    const reminders = getActiveReminders();

    if (reminders.length === 0) {
      return {
        success: true,
        output: 'No active reminders.',
      };
    }

    const lines = reminders.map(r => {
      const timeStr = r.triggerAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const minsLeft = Math.round((r.triggerAt.getTime() - Date.now()) / 60000);
      return `- [${r.id}] "${r.message}" at ${timeStr} (${minsLeft} min left)`;
    });

    return {
      success: true,
      output: `Active reminders:\n${lines.join('\n')}`,
    };
  }

  private cancelReminder(input: Record<string, unknown>): ToolResult {
    const id = input.reminder_id as string;

    if (!id) {
      return {
        success: false,
        output: 'Missing required parameter: reminder_id. Use "list" action to see reminder IDs.',
      };
    }

    if (cancelReminder(id)) {
      return {
        success: true,
        output: `Reminder ${id} cancelled.`,
      };
    } else {
      return {
        success: false,
        output: `Reminder ${id} not found. Use "list" action to see active reminders.`,
      };
    }
  }
}
