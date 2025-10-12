import type { RouteConfig } from '@/shared/types/route-config';

export const clientsRoutesConfig: RouteConfig = {
  routes: [
    {
      method: 'GET',
      path: '/api/clients',
      handler: () => import('./api/clients.get'),
      config: {
        auth: true,
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    {
      method: 'POST',
      path: '/api/clients',
      handler: () => import('./api/clients.post'),
      config: {
        auth: true,
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    {
      method: 'GET',
      path: '/api/clients/:id',
      handler: () => import('./api/[id].get'),
      config: {
        auth: true,
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    {
      method: 'PATCH',
      path: '/api/clients/:id',
      handler: () => import('./api/[id].patch'),
      config: {
        auth: true,
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
  ],
};

// Legacy export for backward compatibility
export const routeConfig = clientsRoutesConfig;
