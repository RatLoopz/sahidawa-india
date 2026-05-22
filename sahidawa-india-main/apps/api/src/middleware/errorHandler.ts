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
  const clientMessage = statusCode >= 500 ? 'Internal Server Error' : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      message: clientMessage,
      ...(!isProduction && { stack: err.stack }),
    },
  });
}