import type { RouteConfig } from '@/shared/types/route-config';

export const subscriptionRoutesConfig: RouteConfig = {
  routes: [
    {
      method: 'POST',
      path: '/api/subscriptions/setup-payment',
      handler: () => import('./api/setup-payment.post'),
      config: {
        auth: true,
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
    },
    {
      method: 'POST',
      path: '/api/subscriptions/complete-setup',
      handler: () => import('./api/complete-setup.post'),
      config: {
        auth: true,
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
        },
      },
    },
    {
      method: 'GET',
      path: '/api/subscription-plans',
      handler: () => import('./api/subscription-plans.get'),
      config: {
        auth: false, // Public endpoint for pricing page
        rateLimit: {
          max: 100,
          timeWindow: '1 hour',
        },
      },
    },
    {
      method: 'GET',
      path: '/api/organizations/:organizationId/subscription',
      handler: () =>
        import('./api/organization/[organizationId]/subscription.get'),
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
