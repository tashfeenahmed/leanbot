/**
 * Reminder Tool
 * Allows the agent to set reminders that trigger messages back to the user
 * Supports:
 * - Time intervals: "5 minutes", "1 hour", "30 min"
 * - Absolute times: "at 10am", "3:30pm", "10:00"
 * - Recurring schedules: "every day at 10am", "daily at 9am", "every Monday at 10am"
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
  recurring?: RecurringSchedule;
}

export interface RecurringSchedule {
  type: 'daily' | 'weekly' | 'weekdays' | 'weekends';
  time: { hour: number; minute: number };
  dayOfWeek?: number; // 0=Sunday, 1=Monday, etc. (for weekly)
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
 * Parse time string like "10am", "3:30pm", "14:00", "10:00am"
 */
function parseTime(input: string): { hour: number; minute: number } | null {
  const lower = input.toLowerCase().trim();

  // 24-hour format: "14:00", "9:30"
  const time24Match = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (time24Match) {
    const hour = parseInt(time24Match[1], 10);
    const minute = parseInt(time24Match[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  // 12-hour format: "10am", "3pm", "10:30am", "3:30pm"
  const time12Match = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (time12Match) {
    let hour = parseInt(time12Match[1], 10);
    const minute = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const period = time12Match[3];

    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      return { hour, minute };
    }
  }

  return null;
}

/**
 * Parse day of week
 */
function parseDayOfWeek(input: string): number | null {
  const lower = input.toLowerCase().trim();
  const days: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };
  return days[lower] ?? null;
}

/**
 * Calculate next occurrence for a recurring schedule
 */
function getNextOccurrence(schedule: RecurringSchedule): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(schedule.time.hour, schedule.time.minute, 0, 0);

  switch (schedule.type) {
    case 'daily':
      // If time already passed today, schedule for tomorrow
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      break;

    case 'weekly':
      if (schedule.dayOfWeek !== undefined) {
        const currentDay = now.getDay();
        let daysUntil = schedule.dayOfWeek - currentDay;
        if (daysUntil < 0 || (daysUntil === 0 && target <= now)) {
          daysUntil += 7;
        }
        target.setDate(target.getDate() + daysUntil);
      }
      break;

    case 'weekdays':
      // Monday-Friday
      while (target <= now || target.getDay() === 0 || target.getDay() === 6) {
        target.setDate(target.getDate() + 1);
      }
      break;

    case 'weekends':
      // Saturday-Sunday
      while (target <= now || (target.getDay() !== 0 && target.getDay() !== 6)) {
        target.setDate(target.getDate() + 1);
      }
      break;
  }

  return target;
}

/**
 * Parse recurring schedule from input
 */
function parseRecurring(input: string): { schedule: RecurringSchedule; message?: string } | null {
  const lower = input.toLowerCase().trim();

  // "every day at 10am", "daily at 9:30am"
  const dailyMatch = lower.match(/^(?:every\s*day|daily)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})(?:\s+(?:to\s+)?(.+))?$/i);
  if (dailyMatch) {
    const time = parseTime(dailyMatch[1]);
    if (time) {
      return {
        schedule: { type: 'daily', time },
        message: dailyMatch[2]?.trim(),
      };
    }
  }

  // "every Monday at 10am", "every friday at 3pm"
  const weeklyMatch = lower.match(/^every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})(?:\s+(?:to\s+)?(.+))?$/i);
  if (weeklyMatch) {
    const dayOfWeek = parseDayOfWeek(weeklyMatch[1]);
    const time = parseTime(weeklyMatch[2]);
    if (dayOfWeek !== null && time) {
      return {
        schedule: { type: 'weekly', time, dayOfWeek },
        message: weeklyMatch[3]?.trim(),
      };
    }
  }

  // "every weekday at 9am", "weekdays at 9am"
  const weekdaysMatch = lower.match(/^(?:every\s+)?weekdays?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})(?:\s+(?:to\s+)?(.+))?$/i);
  if (weekdaysMatch) {
    const time = parseTime(weekdaysMatch[1]);
    if (time) {
      return {
        schedule: { type: 'weekdays', time },
        message: weekdaysMatch[2]?.trim(),
      };
    }
  }

  // "every weekend at 10am", "weekends at 10am"
  const weekendsMatch = lower.match(/^(?:every\s+)?weekends?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})(?:\s+(?:to\s+)?(.+))?$/i);
  if (weekendsMatch) {
    const time = parseTime(weekendsMatch[1]);
    if (time) {
      return {
        schedule: { type: 'weekends', time },
        message: weekendsMatch[2]?.trim(),
      };
    }
  }

  return null;
}

/**
 * Parse absolute time like "at 10am", "at 3:30pm"
 */
function parseAbsoluteTime(input: string): Date | null {
  const lower = input.toLowerCase().trim();

  // "at 10am", "at 3:30pm", "at 14:00"
  const atTimeMatch = lower.match(/^(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})$/);
  if (atTimeMatch) {
    const time = parseTime(atTimeMatch[1]);
    if (time) {
      const now = new Date();
      const target = new Date();
      target.setHours(time.hour, time.minute, 0, 0);

      // If time already passed today, schedule for tomorrow
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      return target;
    }
  }

  // "tomorrow at 10am"
  const tomorrowMatch = lower.match(/^tomorrow\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})$/);
  if (tomorrowMatch) {
    const time = parseTime(tomorrowMatch[1]);
    if (time) {
      const target = new Date();
      target.setDate(target.getDate() + 1);
      target.setHours(time.hour, time.minute, 0, 0);
      return target;
    }
  }

  return null;
}

/**
 * Parse natural language time expressions (intervals)
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

/**
 * Schedule a reminder and handle recurring
 */
function scheduleReminder(reminder: Reminder): void {
  const delayMs = reminder.triggerAt.getTime() - Date.now();

  const timer = setTimeout(async () => {
    activeReminders.delete(reminder.id);

    if (reminderCallback) {
      try {
        await reminderCallback(reminder);
      } catch (error) {
        console.error('[REMINDER] Failed to trigger reminder:', error);
      }
    }

    // Reschedule if recurring
    if (reminder.recurring) {
      const nextTrigger = getNextOccurrence(reminder.recurring);
      const newReminder: Reminder = {
        ...reminder,
        id: nanoid(8), // New ID for the new occurrence
        triggerAt: nextTrigger,
        createdAt: new Date(),
      };
      scheduleReminder(newReminder);
    }
  }, Math.max(0, delayMs));

  activeReminders.set(reminder.id, { reminder, timer });
}

export class ReminderTool implements Tool {
  name = 'reminder';
  category = 'meta' as ToolCategory;
  description = `Set reminders for the user. Supports:
- Time intervals: "5 minutes", "1 hour", "30 min"
- Absolute times: "at 10am", "3:30pm", "tomorrow at 9am"
- Recurring: "every day at 10am", "every Monday at 9am", "weekdays at 8am"
Returns immediately after scheduling.`;

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
        time: {
          type: 'string',
          description: 'When to trigger. Examples: "5 minutes", "at 10am", "tomorrow at 9am", "every day at 10am", "every Monday at 3pm", "weekdays at 8am"',
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
    // Support both 'time' and legacy 'delay' parameters
    const timeStr = (input.time || input.delay) as string;
    let message = input.message as string;

    if (!timeStr) {
      return {
        success: false,
        output: 'Missing required parameter: time. Examples: "5 minutes", "at 10am", "every day at 10am"',
      };
    }

    if (!reminderCallback) {
      return {
        success: false,
        output: 'Reminder system not initialized. Cannot set reminders.',
      };
    }

    const now = new Date();
    let triggerAt: Date;
    let recurring: RecurringSchedule | undefined;
    let scheduleDescription: string;

    // Try parsing as recurring schedule first
    const recurringResult = parseRecurring(timeStr);
    if (recurringResult) {
      recurring = recurringResult.schedule;
      triggerAt = getNextOccurrence(recurring);

      // Use message from pattern if not provided
      if (!message && recurringResult.message) {
        message = recurringResult.message;
      }

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const timeFormatted = `${recurring.time.hour % 12 || 12}:${recurring.time.minute.toString().padStart(2, '0')} ${recurring.time.hour >= 12 ? 'PM' : 'AM'}`;

      switch (recurring.type) {
        case 'daily':
          scheduleDescription = `every day at ${timeFormatted}`;
          break;
        case 'weekly':
          scheduleDescription = `every ${dayNames[recurring.dayOfWeek!]} at ${timeFormatted}`;
          break;
        case 'weekdays':
          scheduleDescription = `weekdays at ${timeFormatted}`;
          break;
        case 'weekends':
          scheduleDescription = `weekends at ${timeFormatted}`;
          break;
      }
    } else {
      // Try parsing as absolute time
      const absoluteTime = parseAbsoluteTime(timeStr);
      if (absoluteTime) {
        triggerAt = absoluteTime;
        const timeFormatted = triggerAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const dateFormatted = triggerAt.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        scheduleDescription = `${dateFormatted} at ${timeFormatted}`;
      } else {
        // Try parsing as delay interval
        const delayMinutes = parseDelay(timeStr);
        if (delayMinutes === null || delayMinutes <= 0) {
          return {
            success: false,
            output: `Could not parse time: "${timeStr}". Try:\n- Intervals: "5 minutes", "1 hour"\n- Absolute: "at 10am", "3:30pm"\n- Recurring: "every day at 10am", "every Monday at 9am"`,
          };
        }
        triggerAt = new Date(now.getTime() + delayMinutes * 60 * 1000);
        scheduleDescription = `in ${delayMinutes} minute${delayMinutes === 1 ? '' : 's'}`;
      }
    }

    if (!message) {
      return {
        success: false,
        output: 'Missing required parameter: message. What should I remind you about?',
      };
    }

    const reminder: Reminder = {
      id: nanoid(8),
      message,
      triggerAt,
      userId: context.userId || 'unknown',
      sessionId: context.sessionId,
      createdAt: now,
      recurring,
    };

    scheduleReminder(reminder);

    const nextTriggerStr = triggerAt.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const recurringNote = recurring ? ' (recurring)' : '';

    return {
      success: true,
      output: `Reminder set${recurringNote}! I'll remind you "${message}" ${scheduleDescription}. Next trigger: ${nextTriggerStr}. ID: ${reminder.id}`,
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
      const timeStr = r.triggerAt.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const minsLeft = Math.round((r.triggerAt.getTime() - Date.now()) / 60000);
      const recurringLabel = r.recurring ? ' 🔄' : '';
      return `- [${r.id}]${recurringLabel} "${r.message}" at ${timeStr} (${minsLeft} min left)`;
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
