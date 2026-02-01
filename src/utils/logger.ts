import pino from 'pino';
import type { LoggingConfig } from '../config/config.js';

export function createLogger(config: LoggingConfig): pino.Logger {
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
}
