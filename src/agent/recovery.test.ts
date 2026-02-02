/**
 * Tests for Crash Recovery System
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { RecoveryManager, withRecovery } from './recovery.js';
import type { SessionManager, Session } from './session.js';
import type { Logger } from 'pino';

// Create mock logger
const createMockLogger = (): Logger =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }) as unknown as Logger;

// Create mock session manager
const createMockSessionManager = (sessions: Map<string, Session>): SessionManager =>
  ({
    getSession: vi.fn().mockImplementation(async (id: string) => sessions.get(id)),
    createSession: vi.fn().mockImplementation(async () => ({
      id: 'new-session',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    addMessage: vi.fn(),
    deleteSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
  }) as unknown as SessionManager;

describe('RecoveryManager', () => {
  let tempDir: string;
  let manager: RecoveryManager;
  let mockSessionManager: SessionManager;
  let sessions: Map<string, Session>;

  beforeEach(async () => {
    // Create temp directory
    tempDir = path.join(os.tmpdir(), `recovery-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    sessions = new Map();
    mockSessionManager = createMockSessionManager(sessions);

    manager = new RecoveryManager({
      sessionManager: mockSessionManager,
      stateDir: tempDir,
      logger: createMockLogger(),
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should start with empty state', async () => {
      const crashed = await manager.initialize();

      expect(crashed).toEqual([]);
    });

    it('should detect in_progress sessions as crashed', async () => {
      // Write state file with in_progress session
      const stateFile = path.join(tempDir, 'session-states.json');
      await fs.writeFile(
        stateFile,
        JSON.stringify([
          {
            sessionId: 'session-1',
            state: 'in_progress',
            startedAt: new Date(),
            lastActivity: new Date(),
            taskDescription: 'Test task',
          },
        ])
      );

      // Add session data
      sessions.set('session-1', {
        id: 'session-1',
        messages: [{ role: 'user', content: 'Do something' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session);

      const crashed = await manager.initialize();

      expect(crashed).toHaveLength(1);
      expect(crashed[0].sessionId).toBe('session-1');
      expect(crashed[0].taskDescription).toBe('Test task');
    });

    it('should not report completed sessions', async () => {
      const stateFile = path.join(tempDir, 'session-states.json');
      await fs.writeFile(
        stateFile,
        JSON.stringify([
          {
            sessionId: 'session-1',
            state: 'completed',
            lastActivity: new Date(),
          },
        ])
      );

      const crashed = await manager.initialize();

      expect(crashed).toEqual([]);
    });
  });

  describe('markInProgress', () => {
    it('should mark session as in_progress', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test task');

      const state = manager.getState('session-1');

      expect(state).toBe('in_progress');
    });

    it('should persist state to disk', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test task');

      // Read state file
      const stateFile = path.join(tempDir, 'session-states.json');
      const data = JSON.parse(await fs.readFile(stateFile, 'utf-8'));

      expect(data).toHaveLength(1);
      expect(data[0].sessionId).toBe('session-1');
      expect(data[0].state).toBe('in_progress');
    });
  });

  describe('markCompleted', () => {
    it('should mark session as completed', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test task');
      await manager.markCompleted('session-1');

      const state = manager.getState('session-1');

      expect(state).toBe('completed');
    });
  });

  describe('updateActivity', () => {
    it('should track tool usage', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test task');

      await manager.updateActivity('session-1', { toolUsed: 'read' });
      await manager.updateActivity('session-1', { toolUsed: 'write' });
      await manager.updateActivity('session-1', { toolUsed: 'read' }); // Duplicate

      // Read state
      const stateFile = path.join(tempDir, 'session-states.json');
      const data = JSON.parse(await fs.readFile(stateFile, 'utf-8'));

      expect(data[0].toolsUsed).toEqual(['read', 'write']);
    });

    it('should update last message', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test task');

      await manager.updateActivity('session-1', { lastMessage: 'Processing file...' });

      const stateFile = path.join(tempDir, 'session-states.json');
      const data = JSON.parse(await fs.readFile(stateFile, 'utf-8'));

      expect(data[0].lastMessage).toBe('Processing file...');
    });
  });

  describe('needsRecovery', () => {
    it('should return true for crashed sessions', async () => {
      const stateFile = path.join(tempDir, 'session-states.json');
      await fs.writeFile(
        stateFile,
        JSON.stringify([
          { sessionId: 'session-1', state: 'in_progress' },
        ])
      );

      sessions.set('session-1', {
        id: 'session-1',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session);

      await manager.initialize();

      expect(manager.needsRecovery('session-1')).toBe(true);
    });

    it('should return false for completed sessions', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test');
      await manager.markCompleted('session-1');

      expect(manager.needsRecovery('session-1')).toBe(false);
    });
  });

  describe('getRecoveryContext', () => {
    it('should return recovery context for crashed session', async () => {
      const stateFile = path.join(tempDir, 'session-states.json');
      await fs.writeFile(
        stateFile,
        JSON.stringify([
          {
            sessionId: 'session-1',
            state: 'in_progress',
            taskDescription: 'Refactor the auth module',
            toolsUsed: ['read', 'write'],
            lastActivity: new Date().toISOString(),
          },
        ])
      );

      sessions.set('session-1', {
        id: 'session-1',
        messages: [
          { role: 'user', content: 'Refactor the auth module' },
          { role: 'assistant', content: [{ type: 'text', text: 'I will start by...' }] },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session);

      await manager.initialize();

      const context = await manager.getRecoveryContext('session-1');

      expect(context).not.toBeNull();
      expect(context?.taskDescription).toBe('Refactor the auth module');
      expect(context?.toolsUsed).toEqual(['read', 'write']);
      expect(context?.recoveryPrompt).toContain('Session Recovery Notice');
      expect(context?.recoveryPrompt).toContain('Refactor the auth module');
    });

    it('should return null for non-crashed session', async () => {
      await manager.initialize();
      await manager.markInProgress('session-1', 'Test');
      await manager.markCompleted('session-1');

      const context = await manager.getRecoveryContext('session-1');

      expect(context).toBeNull();
    });
  });

  describe('acknowledgeRecovery', () => {
    it('should clear crashed state', async () => {
      const stateFile = path.join(tempDir, 'session-states.json');
      await fs.writeFile(
        stateFile,
        JSON.stringify([{ sessionId: 'session-1', state: 'in_progress' }])
      );

      sessions.set('session-1', {
        id: 'session-1',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session);

      await manager.initialize();
      expect(manager.needsRecovery('session-1')).toBe(true);

      await manager.acknowledgeRecovery('session-1');

      expect(manager.needsRecovery('session-1')).toBe(false);
      expect(manager.getState('session-1')).toBe('idle');
    });
  });

  describe('getCrashedSessions', () => {
    it('should return list of crashed session IDs', async () => {
      const stateFile = path.join(tempDir, 'session-states.json');
      await fs.writeFile(
        stateFile,
        JSON.stringify([
          { sessionId: 'session-1', state: 'in_progress' },
          { sessionId: 'session-2', state: 'in_progress' },
          { sessionId: 'session-3', state: 'completed' },
        ])
      );

      sessions.set('session-1', {
        id: 'session-1',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session);

      sessions.set('session-2', {
        id: 'session-2',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Session);

      await manager.initialize();

      const crashed = manager.getCrashedSessions();

      expect(crashed).toContain('session-1');
      expect(crashed).toContain('session-2');
      expect(crashed).not.toContain('session-3');
    });
  });

  describe('cleanup', () => {
    it('should remove old completed sessions', async () => {
      await manager.initialize();

      // Add old completed session
      const stateFile = path.join(tempDir, 'session-states.json');
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

      await fs.writeFile(
        stateFile,
        JSON.stringify([
          {
            sessionId: 'old-session',
            state: 'completed',
            lastActivity: oldDate.toISOString(),
          },
          {
            sessionId: 'new-session',
            state: 'completed',
            lastActivity: new Date().toISOString(),
          },
        ])
      );

      // Reload state
      manager = new RecoveryManager({
        sessionManager: mockSessionManager,
        stateDir: tempDir,
        logger: createMockLogger(),
      });
      await manager.initialize();

      const removed = await manager.cleanup(24 * 60 * 60 * 1000); // 24 hours

      expect(removed).toBe(1);
      expect(manager.getState('old-session')).toBeNull();
      expect(manager.getState('new-session')).toBe('completed');
    });
  });
});

describe('withRecovery', () => {
  let tempDir: string;
  let recoveryManager: RecoveryManager;
  let mockSessionManager: SessionManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `recovery-wrapper-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    mockSessionManager = createMockSessionManager(new Map());

    recoveryManager = new RecoveryManager({
      sessionManager: mockSessionManager,
      stateDir: tempDir,
      logger: createMockLogger(),
    });

    await recoveryManager.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should wrap processMessage and track state', async () => {
    const mockAgent = {
      processMessage: vi.fn().mockResolvedValue({ response: 'Done!' }),
    };

    const wrappedAgent = withRecovery(mockAgent, recoveryManager);

    await wrappedAgent.processMessage('session-1', 'Do something');

    expect(recoveryManager.getState('session-1')).toBe('completed');
  });

  it('should keep in_progress state on error', async () => {
    const mockAgent = {
      processMessage: vi.fn().mockRejectedValue(new Error('Agent crashed')),
    };

    const wrappedAgent = withRecovery(mockAgent, recoveryManager);

    await expect(
      wrappedAgent.processMessage('session-1', 'Do something')
    ).rejects.toThrow('Agent crashed');

    expect(recoveryManager.getState('session-1')).toBe('in_progress');
  });
});
