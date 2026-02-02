/**
 * Crash Recovery System
 *
 * Detects interrupted sessions and provides recovery prompts on restart.
 *
 * Session states:
 * - idle: No active task
 * - in_progress: Task is being processed
 * - completed: Task completed successfully
 * - crashed: Session was interrupted (detected on restart)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Logger } from 'pino';
import type { SessionManager } from './session.js';
import type { Message } from '../providers/types.js';

/**
 * Session execution state
 */
export type SessionState = 'idle' | 'in_progress' | 'completed' | 'crashed';

/**
 * Session state entry stored in the state file
 */
export interface SessionStateEntry {
  sessionId: string;
  state: SessionState;
  startedAt?: Date;
  lastActivity?: Date;
  taskDescription?: string;
  toolsUsed?: string[];
  lastMessage?: string;
}

/**
 * Recovery context provided to the agent
 */
export interface RecoveryContext {
  sessionId: string;
  crashedAt: Date;
  taskDescription?: string;
  lastMessages: Message[];
  toolsUsed: string[];
  recoveryPrompt: string;
}

/**
 * Recovery manager options
 */
export interface RecoveryManagerOptions {
  sessionManager: SessionManager;
  stateDir: string;
  logger: Logger;
  maxRecoveryMessages?: number;
}

/**
 * Crash Recovery Manager
 *
 * Tracks session states and provides recovery prompts for interrupted sessions.
 */
export class RecoveryManager {
  private sessionManager: SessionManager;
  private stateDir: string;
  private stateFile: string;
  private logger: Logger;
  private maxRecoveryMessages: number;
  private sessionStates: Map<string, SessionStateEntry> = new Map();

  constructor(options: RecoveryManagerOptions) {
    this.sessionManager = options.sessionManager;
    this.stateDir = options.stateDir;
    this.stateFile = path.join(options.stateDir, 'session-states.json');
    this.logger = options.logger.child({ component: 'recovery' });
    this.maxRecoveryMessages = options.maxRecoveryMessages ?? 10;
  }

  /**
   * Initialize the recovery manager
   * Loads existing state and marks in_progress sessions as crashed
   */
  async initialize(): Promise<RecoveryContext[]> {
    await this.loadState();

    // Find sessions that were in_progress (indicating a crash)
    const crashedSessions: RecoveryContext[] = [];

    for (const [sessionId, entry] of this.sessionStates) {
      if (entry.state === 'in_progress') {
        this.logger.warn({ sessionId }, 'Found interrupted session');

        // Mark as crashed
        entry.state = 'crashed';
        await this.saveState();

        // Generate recovery context
        const context = await this.generateRecoveryContext(sessionId, entry);
        if (context) {
          crashedSessions.push(context);
        }
      }
    }

    return crashedSessions;
  }

  /**
   * Mark a session as starting a task
   */
  async markInProgress(
    sessionId: string,
    taskDescription?: string
  ): Promise<void> {
    const entry: SessionStateEntry = {
      sessionId,
      state: 'in_progress',
      startedAt: new Date(),
      lastActivity: new Date(),
      taskDescription,
      toolsUsed: [],
    };

    this.sessionStates.set(sessionId, entry);
    await this.saveState();

    this.logger.debug({ sessionId, taskDescription }, 'Session marked in_progress');
  }

  /**
   * Update last activity and track tool usage
   */
  async updateActivity(
    sessionId: string,
    options?: { toolUsed?: string; lastMessage?: string }
  ): Promise<void> {
    const entry = this.sessionStates.get(sessionId);
    if (!entry) return;

    entry.lastActivity = new Date();

    if (options?.toolUsed && !entry.toolsUsed?.includes(options.toolUsed)) {
      entry.toolsUsed = entry.toolsUsed || [];
      entry.toolsUsed.push(options.toolUsed);
    }

    if (options?.lastMessage) {
      entry.lastMessage = options.lastMessage.substring(0, 500);
    }

    this.sessionStates.set(sessionId, entry);
    await this.saveState();
  }

  /**
   * Mark a session as completed
   */
  async markCompleted(sessionId: string): Promise<void> {
    const entry = this.sessionStates.get(sessionId);
    if (entry) {
      entry.state = 'completed';
      entry.lastActivity = new Date();
      this.sessionStates.set(sessionId, entry);
      await this.saveState();
    }

    this.logger.debug({ sessionId }, 'Session marked completed');
  }

  /**
   * Mark a session as idle
   */
  async markIdle(sessionId: string): Promise<void> {
    const entry = this.sessionStates.get(sessionId);
    if (entry) {
      entry.state = 'idle';
      this.sessionStates.set(sessionId, entry);
      await this.saveState();
    }
  }

  /**
   * Check if a session needs recovery
   */
  needsRecovery(sessionId: string): boolean {
    const entry = this.sessionStates.get(sessionId);
    return entry?.state === 'crashed';
  }

  /**
   * Get recovery context for a crashed session
   */
  async getRecoveryContext(sessionId: string): Promise<RecoveryContext | null> {
    const entry = this.sessionStates.get(sessionId);
    if (!entry || entry.state !== 'crashed') {
      return null;
    }
    return this.generateRecoveryContext(sessionId, entry);
  }

  /**
   * Acknowledge recovery (clear crashed state)
   */
  async acknowledgeRecovery(sessionId: string): Promise<void> {
    const entry = this.sessionStates.get(sessionId);
    if (entry && entry.state === 'crashed') {
      entry.state = 'idle';
      this.sessionStates.set(sessionId, entry);
      await this.saveState();
    }

    this.logger.info({ sessionId }, 'Recovery acknowledged');
  }

  /**
   * Get current state of a session
   */
  getState(sessionId: string): SessionState | null {
    return this.sessionStates.get(sessionId)?.state ?? null;
  }

  /**
   * Get all crashed sessions
   */
  getCrashedSessions(): string[] {
    const crashed: string[] = [];
    for (const [sessionId, entry] of this.sessionStates) {
      if (entry.state === 'crashed') {
        crashed.push(sessionId);
      }
    }
    return crashed;
  }

  /**
   * Clean up old completed/idle sessions from state
   */
  async cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let removed = 0;

    for (const [sessionId, entry] of this.sessionStates) {
      if (entry.state === 'completed' || entry.state === 'idle') {
        const lastActivity = entry.lastActivity
          ? new Date(entry.lastActivity).getTime()
          : 0;

        if (now - lastActivity > maxAgeMs) {
          this.sessionStates.delete(sessionId);
          removed++;
        }
      }
    }

    if (removed > 0) {
      await this.saveState();
      this.logger.info({ removed }, 'Cleaned up old session states');
    }

    return removed;
  }

  /**
   * Generate recovery context for a crashed session
   */
  private async generateRecoveryContext(
    sessionId: string,
    entry: SessionStateEntry
  ): Promise<RecoveryContext | null> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      this.logger.warn({ sessionId }, 'Session not found for recovery');
      return null;
    }

    // Get the last N messages for context
    const lastMessages = session.messages.slice(-this.maxRecoveryMessages);

    // Extract the last user message to understand the task
    const lastUserMessage = [...session.messages]
      .reverse()
      .find((m) => m.role === 'user');

    const taskDescription = entry.taskDescription || this.extractTaskDescription(lastUserMessage);

    // Generate recovery prompt
    const recoveryPrompt = this.buildRecoveryPrompt({
      taskDescription,
      toolsUsed: entry.toolsUsed || [],
      lastMessage: entry.lastMessage,
      crashedAt: entry.lastActivity || new Date(),
    });

    return {
      sessionId,
      crashedAt: entry.lastActivity || new Date(),
      taskDescription,
      lastMessages,
      toolsUsed: entry.toolsUsed || [],
      recoveryPrompt,
    };
  }

  /**
   * Extract task description from a message
   */
  private extractTaskDescription(message?: Message): string {
    if (!message) return 'Unknown task';

    const content = typeof message.content === 'string'
      ? message.content
      : message.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join(' ');

    // Truncate if too long
    return content.length > 200 ? content.substring(0, 197) + '...' : content;
  }

  /**
   * Build a recovery prompt for the agent
   */
  private buildRecoveryPrompt(context: {
    taskDescription: string;
    toolsUsed: string[];
    lastMessage?: string;
    crashedAt: Date;
  }): string {
    const lines: string[] = [
      '## Session Recovery Notice',
      '',
      'The previous session was interrupted unexpectedly. Here is the context:',
      '',
      `**Original Task:** ${context.taskDescription}`,
    ];

    if (context.toolsUsed.length > 0) {
      lines.push(`**Tools Used:** ${context.toolsUsed.join(', ')}`);
    }

    if (context.lastMessage) {
      lines.push(`**Last Activity:** ${context.lastMessage}`);
    }

    lines.push(`**Interrupted At:** ${context.crashedAt.toISOString()}`);
    lines.push('');
    lines.push('Would you like to:');
    lines.push('1. **Resume** - Continue from where we left off');
    lines.push('2. **Restart** - Start the task fresh');
    lines.push('3. **Cancel** - Dismiss this recovery and start something new');

    return lines.join('\n');
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const entries = JSON.parse(data) as SessionStateEntry[];

      this.sessionStates.clear();
      for (const entry of entries) {
        // Convert date strings back to Date objects
        if (entry.startedAt) entry.startedAt = new Date(entry.startedAt);
        if (entry.lastActivity) entry.lastActivity = new Date(entry.lastActivity);
        this.sessionStates.set(entry.sessionId, entry);
      }

      this.logger.debug({ count: entries.length }, 'Loaded session states');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        this.logger.error({ error: err.message }, 'Failed to load session states');
      }
      // File doesn't exist, start fresh
      this.sessionStates.clear();
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
      const entries = Array.from(this.sessionStates.values());
      await fs.writeFile(this.stateFile, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (error) {
      const err = error as Error;
      this.logger.error({ error: err.message }, 'Failed to save session states');
    }
  }
}

/**
 * Create a recovery-aware agent wrapper
 * Automatically tracks session state for crash recovery
 */
export function withRecovery<T extends {
  processMessage(sessionId: string, message: string): Promise<unknown>;
}>(
  agent: T,
  recoveryManager: RecoveryManager
): T {
  const originalProcessMessage = agent.processMessage.bind(agent);

  agent.processMessage = async (sessionId: string, message: string) => {
    // Extract first line as task description
    const taskDescription = message.split('\n')[0].substring(0, 200);

    // Mark session as in_progress
    await recoveryManager.markInProgress(sessionId, taskDescription);

    try {
      const result = await originalProcessMessage(sessionId, message);
      await recoveryManager.markCompleted(sessionId);
      return result;
    } catch (error) {
      // Keep state as in_progress on error (will be detected as crashed on restart)
      throw error;
    }
  };

  return agent;
}
