import { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  // Default: all routes require authentication
  protected: true,

  // Make specific routes public
  public: [
    'GET /[id]', // Anyone can view a practice
    'GET /stats', // Public statistics
  ],

  // Optional: Custom middleware
  middleware: {
    'POST /': ['rateLimit'], // Rate limit practice creation
    'DELETE /[id]': ['adminOnly'], // Custom admin check
  },

  // Optional: Role-based access
  roles: {
    'DELETE /[id]': ['admin', 'owner'],
    'POST /organization': ['owner'],
  },
};
