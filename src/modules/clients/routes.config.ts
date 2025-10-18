import type { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  protected: true, // Default: client routes require authentication
  roles: {
    // All client routes require admin role
    '/api/clients': ['admin'],
    '/api/clients/:id': ['admin'],
  },
};
