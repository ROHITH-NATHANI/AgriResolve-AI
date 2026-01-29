import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// interface AppError removed (merged with class)

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || false;

  // Log error details
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    statusCode,
    isOperational,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production for non-operational errors
  const message = isOperational || process.env.NODE_ENV === 'development'
    ? error.message
    : 'Internal Server Error';

  const errorResponse = {
    error: true,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: {
        url: req.url,
        method: req.method,
        headers: req.headers
      }
    })
  };

  res.status(statusCode).json(errorResponse);
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Common error creators
export const createNotFoundError = (resource: string) => {
  return new AppError(`${resource} not found`, 404);
};

export const createValidationError = (message: string) => {
  return new AppError(`Validation Error: ${message}`, 400);
};

export const createUnauthorizedError = (message: string = 'Unauthorized') => {
  return new AppError(message, 401);
};

export const createForbiddenError = (message: string = 'Forbidden') => {
  return new AppError(message, 403);
};

export const createConflictError = (message: string) => {
  return new AppError(`Conflict: ${message}`, 409);
};

export const createServiceUnavailableError = (service: string) => {
  return new AppError(`Service Unavailable: ${service}`, 503);
};