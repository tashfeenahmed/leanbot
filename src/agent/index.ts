export { Agent, type AgentOptions, type AgentResult } from './agent.js';
export { SessionManager, type Session, type SessionMetadata } from './session.js';
export {
  RecoveryManager,
  withRecovery,
  type SessionState,
  type SessionStateEntry,
  type RecoveryContext,
  type RecoveryManagerOptions,
} from './recovery.js';

export {
  StyleManager,
  parseStyle,
  getStyleDescription,
  defaultStyleManager,
  STYLE_PRESETS,
  type ResponseStyle,
  type StyleConfig,
} from './style.js';
