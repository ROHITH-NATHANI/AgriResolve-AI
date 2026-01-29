import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

interface User {
  id: string;
  email: string;
  role: 'farmer' | 'expert' | 'admin';
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip auth for health checks and public endpoints
  if (req.path === '/health' || req.path.startsWith('/public')) {
    return next();
  }

  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    // For development, create a default user
    if (process.env.NODE_ENV === 'development') {
      req.user = {
        id: 'dev-user-1',
        email: 'developer@agriresolve.ai',
        role: 'farmer',
        permissions: ['read', 'write', 'collaborate']
      };
      return next();
    }

    res.status(401).json({
      error: 'Access Denied',
      message: 'No token provided',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    logger.debug(`Authenticated user: ${req.user.email} (${req.user.role})`);
    next();
  } catch (error) {
    logger.warn('Invalid token provided:', error);
    res.status(401).json({
      error: 'Invalid Token',
      message: 'Token is not valid',
      timestamp: new Date().toISOString()
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient Permissions',
        message: `Required role: ${roles.join(' or ')}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication Required',
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!req.user.permissions.includes(permission)) {
      res.status(403).json({
        error: 'Insufficient Permissions',
        message: `Required permission: ${permission}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
};

export const generateToken = (user: Omit<User, 'permissions'> & { permissions?: string[] }): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || []
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};