import type { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  protected: true, // All payment routes require authentication
  public: [
    // No public routes for payments
  ],
  private: [
    // No private routes - all are protected by default
  ],
  roles: {
    // No specific role requirements - organization members can access
  },
};
