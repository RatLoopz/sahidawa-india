import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { getDbErrorStatus } from '../utils/dbErrors';

const SENSITIVE_FIELDS = ['password', 'apiKey', 'api_key', 'token', 'secret', 'authorization', 'cookie'];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function redactErrorMessage(message: string): string {
  // Remove file paths, connection strings, and sensitive patterns
  return message
    .replace(/\/[^\s]+\/[^\s]+\.\w+/g, '[FILE_PATH]')
    .replace(/mongodb:\/\/[^\s]+/gi, '[REDACTED_DB_URL]')
    .replace(/postgres:\/\/[^\s]+/gi, '[REDACTED_DB_URL]')
    .replace(/mysql:\/\/[^\s]+/gi, '[REDACTED_DB_URL]')
    .replace(/password[=:][^\s]+/gi, 'password=[REDACTED]')
    .replace(/api[_-]?key[=:][^\s]+/gi, 'api_key=[REDACTED]')
    .replace(/token[=:][^\s]+/gi, 'token=[REDACTED]');
}

export function errorHandler(
  err: Error & { statusCode?: number; status?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || err.status || 500;

  if (err.code) {
    const dbStatus = getDbErrorStatus(err.code);
    if (dbStatus) {
      statusCode = dbStatus;
    }
  }

  const level = statusCode >= 500 ? 'error' : 'warn';

  logger.log({
    level,
    message: `${req.method} ${req.originalUrl} - ${err.message}`,
    statusCode,
    stack: err.stack,
    body: req.body ? sanitize(req.body as Record<string, unknown>) : undefined,
    query: req.query,
    params: req.params,
  });

  const isProduction = process.env.NODE_ENV === 'production';

  // In production, always return generic error messages
  // Stack traces are never sent to clients, only logged server-side
  const clientMessage = isProduction
    ? (statusCode >= 500 ? 'Internal Server Error' : 'Request Failed')
    : redactErrorMessage(err.message);

  res.status(statusCode).json({
    success: false,
    error: {
      message: clientMessage,
      // Stack traces are NEVER sent to clients, only logged server-side
      ...(process.env.DEBUG === 'true' && !isProduction && { stack: err.stack }),
    },
  });
}