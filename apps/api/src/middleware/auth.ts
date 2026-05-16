import { NextFunction, Request, Response } from 'express';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { supabase } from '../db/client';

export type AuthRole = 'user' | 'admin';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: AuthRole;
  raw: User;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

type SupabaseAuthClient = Pick<SupabaseClient, 'auth'>;

const getBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const getUserRole = (user: User): AuthRole => {
  const metadataRole = user.app_metadata?.role || user.user_metadata?.role;
  return metadataRole === 'admin' ? 'admin' : 'user';
};

export const createAuthMiddleware =
  (client: SupabaseAuthClient = supabase) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: 'Authorization bearer token is required' });
      return;
    }

    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired authentication token' });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      role: getUserRole(data.user),
      raw: data.user,
    };

    next();
  };

export const requireAuth = createAuthMiddleware();

export const requireRole =
  (...allowedRoles: AuthRole[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication is required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
