// src/plugins/auth-core.ts
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import {
  sessions as sessionTable,
  organizations as organizationTable,
  members as memberTable,
} from '@/schema';
import { ExtendedSession } from '@/shared/types/auth';

/**
 * Auth Core Plugin
 * Decorates Fastify with verifyAuth method
 */
export default fp(async function authCore(fastify: FastifyInstance) {
  fastify.decorate(
    'verifyAuth',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get authorization header
        const authHeader = request.headers.authorization;

        if (!authHeader) {
          return reply.unauthorized('No authorization header');
        }

        fastify.log.info(`Auth header: ${authHeader.substring(0, 20)}...`);

        // Use Better Auth's session API to verify
        const session = (await fastify.betterAuth.api.getSession({
          headers: request.headers,
        })) as ExtendedSession;

        fastify.log.info(
          `Session result: ${session ? JSON.stringify({ userId: session.user?.id, sessionId: session.session?.id, hasOrg: !!session.session?.activeOrganizationId }) : 'null'}`,
        );

        if (!session) {
          fastify.log.warn(
            'Session validation failed - token may be expired or invalid',
          );
          return reply.unauthorized('Invalid or expired session');
        }

        // Check if the active organization still exists and user has access
        let activeOrganizationId =
          session.session.activeOrganizationId || undefined;

        if (activeOrganizationId) {
          try {
            // Verify the organization exists and user has access
            const orgCheck = await fastify.db
              .select({ id: organizationTable.id })
              .from(organizationTable)
              .innerJoin(
                memberTable,
                eq(organizationTable.id, memberTable.organizationId),
              )
              .where(
                and(
                  eq(organizationTable.id, activeOrganizationId),
                  eq(memberTable.userId, session.user.id),
                ),
              )
              .limit(1);

            if (orgCheck.length === 0) {
              // Update the session in the database to clear the invalid activeOrganizationId
              await fastify.db
                .update(sessionTable)
                .set({ activeOrganizationId: null })
                .where(eq(sessionTable.id, session.session.id));

              // Clear from request session as well
              activeOrganizationId = undefined;
            }
          } catch {
            // If organization validation fails, clear the organization context
            activeOrganizationId = undefined;
          }
        }

        // Attach user and session to request
        request.user = {
          ...session.user,
          image: session.user.image ?? null,
        };
        request.session = {
          ...session.session,
          activeOrganizationId: session.session.activeOrganizationId ?? null,
          ipAddress: session.session.ipAddress ?? null,
          userAgent: session.session.userAgent ?? null,
        };
        request.userId = session.user.id;
        request.activeOrganizationId = activeOrganizationId;
      } catch (error) {
        fastify.log.error(
          {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    cause: (error as Error & { cause?: unknown }).cause,
                  }
                : error,
            headers: request.headers.authorization?.substring(0, 20),
          },
          'Authentication error',
        );
        return reply.unauthorized('Authentication failed');
      }
    },
  );

  fastify.log.info('✅ Auth core plugin registered (verifyAuth decorated)');
});
