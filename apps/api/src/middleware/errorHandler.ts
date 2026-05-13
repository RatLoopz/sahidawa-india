import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

export function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;
  const level = statusCode >= 500 ? 'error' : 'warn';

  logger.log({
    level,
    message: `${req.method} ${req.originalUrl} - ${err.message}`,
    statusCode,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}