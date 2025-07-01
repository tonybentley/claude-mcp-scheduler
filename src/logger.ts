import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL ?? 'info';
const isProduction = process.env.NODE_ENV === 'production';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...metadata } = info as {
      timestamp?: string;
      level: string;
      message: unknown;
      stack?: string;
      [key: string]: unknown;
    };
    
    const messageStr = String(message);
    let log = `${timestamp ?? ''} [${level.toUpperCase()}]: ${messageStr}`;
    
    const metadataKeys = Object.keys(metadata).filter(key => key !== 'timestamp' && key !== 'level' && key !== 'message');
    if (metadataKeys.length > 0) {
      const metadataObj: Record<string, unknown> = {};
      metadataKeys.forEach(key => {
        metadataObj[key] = metadata[key];
      });
      log += ` ${JSON.stringify(metadataObj)}`;
    }
    
    if (stack !== undefined && stack !== null && stack !== '') {
      log += `\n${String(stack)}`;
    }
    
    return log;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    )
  }),
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: logFormat
  }),
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: logFormat
  })
];

export const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports,
  exitOnError: false
});

if (!isProduction) {
  logger.debug('Logger initialized in development mode');
}

export function createChildLogger(service: string): winston.Logger {
  return logger.child({ service });
}