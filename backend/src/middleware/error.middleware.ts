import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/types.js';
import { logger } from '../shared/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;

  // Log error
  logger.error(`[${req.method} ${req.path}] Error:`, err.message || err);

  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const field = issue.path.join('.');
      fieldErrors[field] = issue.message;
    }
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: 'The submitted data failed validation checks.',
      fieldErrors,
      requestId,
    });
  }

  // 2. Custom AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      fieldErrors: err.fieldErrors,
      requestId,
    });
  }

  // 3. Prisma Unique Constraint Error (P2002)
  if (err?.code === 'P2002') {
    const targets = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target || 'field';
    return res.status(409).json({
      code: 'CONFLICT',
      message: `A record with this ${targets} already exists.`,
      requestId,
    });
  }

  // 4. Default 500 Internal Error
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : err.message || 'Internal error',
    requestId,
  });
}
