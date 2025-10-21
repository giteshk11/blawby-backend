import type { MiddlewareHandler } from 'hono';
import { createBetterAuthInstance } from '@/shared/auth/better-auth';
import { db } from '@/shared/database';
import type { Variables } from '@/shared/types/hono';

/**
 * Authentication Middleware - Sets user context and blocks unauthenticated users
 *
 * This middleware:
 * 1. Extracts session from Better Auth
 * 2. Sets user data in context
 * 3. Blocks requests if user is not authenticated
 */
export const requireAuth = (): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    try {
      // Get auth instance (singleton pattern - cached after first creation)
      const authInstance = createBetterAuthInstance(db);

      // Get session from Better Auth
      const session = await authInstance.api.getSession({
        headers: c.req.raw.headers,
      });

      // Set session and user in context
      if (session?.user) {
        c.set('session', session);
        c.set('user', session.user);
        c.set('userId', session.user.id);
        c.set('activeOrganizationId', session.session.activeOrganizationId ?? null);
      }

      // Block request if no user
      if (!session?.user) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
      }

      return next();
    } catch (error) {
      // Log the error and block the request
      console.error('Error in requireAuth middleware:', error);
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }
  };
};

/**
 * Guest Middleware - Redirects authenticated users
 *
 * Use this for routes that should only be accessible to non-authenticated users
 * (like login, register pages)
 */
export const requireGuest = (): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    const user = c.get('user');

    if (user) {
      // User is already authenticated, return error
      return c.json({ error: 'Bad Request', message: 'Already authenticated' }, 400);
    }

    return next();
  };
};

/**
 * Admin Middleware - Requires admin role
 *
 * Use this for admin-only routes
 */
export const requireAdmin = (): MiddlewareHandler<{ Variables: Variables }> => {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401);
    }

    // TODO: Check if user has admin role
    // For now, we'll assume all authenticated users are admins
    // You can implement role checking here

    return next();
  };
};

/**
 * Rate Limiting Middleware
 *
 * Simple rate limiting implementation
 */
export const throttle = (requestsPerMinute: number = 60): MiddlewareHandler => {
  const requests = new Map<string, number[]>();

  return async (c, next) => {
    const clientId = c.req.header('x-forwarded-for')
      || c.req.header('x-real-ip')
      || 'unknown';

    const now = Date.now();
    const minuteAgo = now - 60000;

    // Clean old requests
    const clientRequests = requests.get(clientId) || [];
    const recentRequests = clientRequests.filter((time) => time > minuteAgo);

    if (recentRequests.length >= requestsPerMinute) {
      return c.json({ error: 'Too Many Requests', message: 'Rate limit exceeded' }, 429);
    }

    // Add current request
    recentRequests.push(now);
    requests.set(clientId, recentRequests);

    return next();
  };
};
