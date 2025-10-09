import { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  // All billing routes require authentication by default
  protected: true,
  
  // Webhooks are public (they verify via signature)
  public: [
    'POST /webhooks/stripe',
  ],
  
  // Admin-only routes
  roles: {
    'GET /accounts': ['admin'],
    'DELETE /accounts/[id]': ['admin'],
  },
};
