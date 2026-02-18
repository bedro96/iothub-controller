import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d', // Keep logs for 14 days
  format: fileFormat,
});

// Create daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d', // Keep error logs for 30 days
  level: 'error',
  format: fileFormat,
});

// Create daily rotate file transport for HTTP logs
const httpLogsTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'http-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d', // Keep HTTP logs for 7 days
  level: 'http',
  format: fileFormat,
});

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    allLogsTransport,
    errorLogsTransport,
    httpLogsTransport,
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Helper functions for structured logging
export const logRequest = (req: {
  method: string;
  url: string;
  ip?: string;
  userId?: string;
  statusCode?: number;
  responseTime?: number;
}) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userId: req.userId,
    statusCode: req.statusCode,
    responseTime: req.responseTime,
  });
};

export const logError = (error: Error, context?: Record<string, unknown>) => {
  logger.error(error.message, {
    error: error.name,
    stack: error.stack,
    ...context,
  });
};

export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  logger.info(message, meta);
};

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  logger.debug(message, meta);
};

// Log audit events
export const logAudit = async (
  action: string,
  userId: string | null,
  metadata?: Record<string, unknown>
) => {
  logger.info('Audit Event', {
    action,
    userId,
    ...metadata,
  });
  
  // Also store in database
  if (process.env.NODE_ENV === 'production') {
    try {
      const { prisma } = await import('./prisma');
      await prisma.auditLog.create({
        data: {
          action,
          userId,
          userEmail: (metadata?.userEmail as string) ?? null,
          ipAddress: (metadata?.ipAddress as string) ?? null,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });
    } catch (error) {
      logger.error('Failed to store audit log in database', { error });
    }
  }
};

export default logger;
