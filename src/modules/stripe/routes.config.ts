import type { RouteConfig } from '@/shared/types/route-config';

export const routeConfig: RouteConfig = {
  // Webhooks are public (they verify via signature)
  public: ['POST /webhooks'],
};
