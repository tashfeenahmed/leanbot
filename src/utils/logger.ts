import pino from 'pino';
import type { LoggingConfig } from '../config/config.js';

export function createLogger(config: LoggingConfig): pino.Logger {
  // Use pino-pretty only in development (when available)
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    try {
      // Check if pino-pretty is available
      require.resolve('pino-pretty');
      return pino({
        level: config.level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      });
    } catch {
      // pino-pretty not available, fall through to JSON logging
    }
  }

  // Production: use JSON logging (no pino-pretty needed)
  return pino({
    level: config.level,
  });
}
