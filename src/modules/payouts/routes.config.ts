import type { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  protected: true, // All payout routes require authentication
  public: [
    // No public routes for payouts
  ],
  private: [
    // No private routes - all are protected by default
  ],
  roles: {
    // No specific role requirements - organization members can access
  },
};
