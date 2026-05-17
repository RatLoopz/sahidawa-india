import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/client';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  req.user = user;
  next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const role = req.user?.app_metadata?.role;

  if (role !== 'admin' && role !== 'moderator') {
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    return;
  }

  next();
};
