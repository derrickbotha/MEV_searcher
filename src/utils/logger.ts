import pino from 'pino';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: LOG_LEVEL,
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Specialized loggers for different components
export const wsLogger = logger.child({ component: 'websocket' });
export const simLogger = logger.child({ component: 'simulation' });
export const strategyLogger = logger.child({ component: 'strategy' });
export const submissionLogger = logger.child({ component: 'submission' });
export const metricsLogger = logger.child({ component: 'metrics' });
