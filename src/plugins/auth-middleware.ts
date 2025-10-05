import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import {
  getUserId,
  getActiveOrganizationId,
} from '../app/features/settings/services/better-auth-integration';

/**
 * Global Authentication Middleware Plugin
 * Protects all API routes except public ones
 */
async function authMiddlewarePlugin(fastify: FastifyInstance) {
  // Log that the auth middleware is loading
  fastify.log.info(
    '🔒 [AuthMiddleware] Loading global authentication middleware...',
  );

  // Add preHandler hook to all routes
  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip authentication for public routes
      const publicRoutes = [
        '/api/auth/', // Better Auth endpoints
        '/api/health', // Health check
        '/docs', // API documentation
        '/swagger', // Swagger UI
        '/documentation', // Swagger UI
        '/api/webhooks/stripe', // Stripe webhooks (they have their own verification)
      ];

      const isPublicRoute = publicRoutes.some((route) =>
        request.url.startsWith(route),
      );

      if (isPublicRoute) {
        return; // Skip authentication for public routes
      }

      try {
        // Extract user information using Better Auth integration
        const userId = await getUserId(request);
        const activeOrganizationId = await getActiveOrganizationId(request);

        // Store user info in request for use in route handlers
        request.userId = userId;
        request.activeOrganizationId = activeOrganizationId ?? undefined;

        fastify.log.debug(
          `🔒 [AuthMiddleware] Authenticated user: ${userId}, org: ${activeOrganizationId}`,
        );
      } catch (error) {
        fastify.log.warn(
          `🔒 [AuthMiddleware] Authentication failed for ${request.url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );

        // Return consistent error response
        reply.status(401).send({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          message: 'Please sign in to access this resource',
        });
      }
    },
  );

  fastify.log.info(
    '✅ [AuthMiddleware] Global authentication middleware loaded',
  );
}

export default fastifyPlugin(authMiddlewarePlugin);
