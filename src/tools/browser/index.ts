/**
 * Browser automation tools
 *
 * Provides web automation capabilities using Playwright.
 * The browser tool is a unified interface for all browser operations.
 */

export { BrowserSession } from './session.js';
export { BrowserTool } from './browser.js';
export type {
  ElementRef,
  PageSnapshot,
  ScreenshotResult,
  BrowserSessionConfig,
  BrowserSessionState,
  BrowserCookie,
  NavigateOptions,
  ClickOptions,
  TypeOptions,
  WaitOptions,
  ExtractOptions,
} from './types.js';
