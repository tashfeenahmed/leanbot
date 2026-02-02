/**
 * Tailscale integration types
 */

/**
 * Tailscale mode for gateway exposure
 */
export type TailscaleMode = 'off' | 'serve' | 'funnel';

/**
 * Tailscale configuration
 */
export interface TailscaleConfig {
  /** Mode: off (default), serve (tailnet only), or funnel (public) */
  mode: TailscaleMode;
  /** Hostname for MagicDNS (defaults to machine name) */
  hostname?: string;
  /** Port to expose (default: 3000) */
  port?: number;
  /** Reset serve/funnel on exit (default: true) */
  resetOnExit?: boolean;
}

/**
 * Tailscale status from `tailscale status --json`
 */
export interface TailscaleStatus {
  /** Whether tailscale is running and connected */
  connected: boolean;
  /** Tailscale version */
  version?: string;
  /** Current hostname in tailnet */
  hostname?: string;
  /** MagicDNS name (e.g., machine.tailnet-name.ts.net) */
  magicDNS?: string;
  /** Tailscale IP addresses */
  tailscaleIPs?: string[];
  /** Whether this node has funnel enabled */
  funnelEnabled?: boolean;
  /** Current user login */
  userLogin?: string;
  /** Error message if not connected */
  error?: string;
}

/**
 * Tailscale serve/funnel status
 */
export interface ServeStatus {
  /** Whether serve/funnel is currently active */
  active: boolean;
  /** Mode (serve or funnel) */
  mode?: 'serve' | 'funnel';
  /** URLs being served */
  urls?: string[];
  /** Port being served */
  port?: number;
}

/**
 * Result of serve/funnel setup
 */
export interface SetupResult {
  success: boolean;
  /** Public URL if funnel, tailnet URL if serve */
  url?: string;
  error?: string;
}
