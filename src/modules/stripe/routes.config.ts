import type { RouteConfig } from '@/shared/types/route-config';

export const routeConfig = {
  // Webhooks are public (they verify via signature)
  public: [
    {
      method: 'POST',
      endpoint: '/webhooks',
    },
    {
      method: 'POST',
      endpoint: '/connect/webhook-events',
    },
  ],
} satisfies RouteConfig;
