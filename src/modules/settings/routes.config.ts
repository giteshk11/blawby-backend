import { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  // All settings routes require authentication
  protected: true,

  // Optional: Role-based access for sensitive operations
  roles: {
    'DELETE /user': ['admin'],
    'PUT /organization/[organizationId]': ['owner', 'admin'],
  },
};
