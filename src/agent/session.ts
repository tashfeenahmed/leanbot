import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';
import type { Message, TokenUsage } from '../providers/types.js';

export interface SessionMetadata {
  userId?: string;
  channelId?: string;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: SessionMetadata;
  tokenUsage?: TokenUsage;
}

interface SessionEntry {
  type: 'session' | 'message' | 'metadata' | 'token_usage';
  timestamp: string;
  data: unknown;
}

export class SessionManager {
  private sessionsDir: string;
  private cache: Map<string, Session> = new Map();

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
  }

  async createSession(metadata?: SessionMetadata): Promise<Session> {
    // Ensure sessions directory exists
    await fs.mkdir(this.sessionsDir, { recursive: true });

    const session: Session = {
      id: nanoid(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
      tokenUsage: { inputTokens: 0, outputTokens: 0 },
    };

    // Write initial session entry to JSONL file
    await this.appendEntry(session.id, {
      type: 'session',
      timestamp: session.createdAt.toISOString(),
      data: {
        id: session.id,
        metadata: session.metadata,
      },
    });

    this.cache.set(session.id, session);
    return session;
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    session.updatedAt = new Date();

    await this.appendEntry(sessionId, {
      type: 'message',
      timestamp: session.updatedAt.toISOString(),
      data: message,
    });

    this.cache.set(sessionId, session);
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    // Check cache first
    if (this.cache.has(sessionId)) {
      return this.cache.get(sessionId);
    }

    // Try to load from file
    const filePath = this.getFilePath(sessionId);
    try {
      await fs.access(filePath);
    } catch {
      return undefined;
    }

    const session = await this.loadSession(sessionId);
    if (session) {
      this.cache.set(sessionId, session);
    }
    return session;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const filePath = this.getFilePath(sessionId);
    try {
      await fs.unlink(filePath);
      this.cache.delete(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<{ id: string; createdAt: Date }[]> {
    try {
      const files = await fs.readdir(this.sessionsDir);
      const sessions: { id: string; createdAt: Date }[] = [];

      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const id = file.replace('.jsonl', '');
          const session = await this.getSession(id);
          if (session) {
            sessions.push({ id, createdAt: session.createdAt });
          }
        }
      }

      return sessions;
    } catch {
      return [];
    }
  }

  async updateMetadata(sessionId: string, metadata: Partial<SessionMetadata>): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.metadata = { ...session.metadata, ...metadata };
    session.updatedAt = new Date();

    await this.appendEntry(sessionId, {
      type: 'metadata',
      timestamp: session.updatedAt.toISOString(),
      data: metadata,
    });

    this.cache.set(sessionId, session);
  }

  async recordTokenUsage(sessionId: string, usage: TokenUsage): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (!session.tokenUsage) {
      session.tokenUsage = { inputTokens: 0, outputTokens: 0 };
    }

    session.tokenUsage.inputTokens += usage.inputTokens;
    session.tokenUsage.outputTokens += usage.outputTokens;
    session.updatedAt = new Date();

    await this.appendEntry(sessionId, {
      type: 'token_usage',
      timestamp: session.updatedAt.toISOString(),
      data: usage,
    });

    this.cache.set(sessionId, session);
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.jsonl`);
  }

  private async appendEntry(sessionId: string, entry: SessionEntry): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(filePath, line, 'utf-8');
  }

  private async loadSession(sessionId: string): Promise<Session | undefined> {
    const filePath = this.getFilePath(sessionId);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      let session: Session | undefined;
      const messages: Message[] = [];
      let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let metadata: SessionMetadata = {};

      for (const line of lines) {
        if (!line.trim()) continue;

        const entry: SessionEntry = JSON.parse(line);

        switch (entry.type) {
          case 'session': {
            const data = entry.data as { id: string; metadata?: SessionMetadata };
            session = {
              id: data.id,
              messages: [],
              createdAt: new Date(entry.timestamp),
              updatedAt: new Date(entry.timestamp),
              metadata: data.metadata,
              tokenUsage: { inputTokens: 0, outputTokens: 0 },
            };
            if (data.metadata) {
              metadata = { ...metadata, ...data.metadata };
            }
            break;
          }
          case 'message':
            messages.push(entry.data as Message);
            break;
          case 'metadata':
            metadata = { ...metadata, ...(entry.data as Partial<SessionMetadata>) };
            break;
          case 'token_usage': {
            const usage = entry.data as TokenUsage;
            tokenUsage.inputTokens += usage.inputTokens;
            tokenUsage.outputTokens += usage.outputTokens;
            break;
          }
        }
      }

      if (session) {
        session.messages = messages;
        session.metadata = metadata;
        session.tokenUsage = tokenUsage;
        session.updatedAt = new Date();
      }

      return session;
    } catch {
      return undefined;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
