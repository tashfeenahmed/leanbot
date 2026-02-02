/**
 * Tailscale integration for secure remote access
 *
 * Provides two modes:
 * - serve: Tailnet-only access (private, encrypted)
 * - funnel: Public internet access (requires password auth)
 *
 * Usage:
 * ```typescript
 * import { Tailscale, createTailscaleFromEnv } from './tailscale';
 *
 * // From environment
 * const tailscale = createTailscaleFromEnv(logger);
 * const status = await tailscale.getStatus();
 *
 * // Manual configuration
 * const tailscale = new Tailscale({
 *   mode: 'serve',
 *   port: 3000,
 * }, logger);
 * await tailscale.setup();
 * ```
 */

export { Tailscale, createTailscaleFromEnv } from './tailscale.js';
export type {
  TailscaleMode,
  TailscaleConfig,
  TailscaleStatus,
  ServeStatus,
  SetupResult,
} from './types.js';
