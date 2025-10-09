// src/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, bearer, organization, multiSession } from 'better-auth/plugins';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/schema';
import { eq, and } from 'drizzle-orm';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

/**
 * Create Better Auth instance with database connection
 * This is called once during plugin initialization
 */
function createAuthInstance(db: NodePgDatabase) {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,

    // Connect to database via Drizzle adapter with schema
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),

    // Plugins
    plugins: [
      jwt(),
      bearer(),
      organization(),
      multiSession({ maximumSessions: 1 }),
    ],

    // Base path for auth routes (server already adds /api prefix)
    basePath: '/auth',

    // Database hooks for session management
    databaseHooks: {
      session: {
        create: {
          before: async (sessionData: {
            userId: string;
            [key: string]: unknown;
          }) => {
            // Get last active organization
            const lastActiveSession = await db
              .select({
                activeOrganizationId: schema.session.activeOrganizationId,
              })
              .from(schema.session)
              .where(eq(schema.session.userId, sessionData.userId))
              .limit(1);

            // Delete old sessions (maximumSessions: 1)
            await db
              .delete(schema.session)
              .where(eq(schema.session.userId, sessionData.userId));

            // Determine active organization
            let activeOrganizationId: string | null = null;
            if (
              lastActiveSession.length > 0 &&
              lastActiveSession[0].activeOrganizationId
            ) {
              // Validate that the previous active organization still exists and user has access
              const orgValidation = await db
                .select({ id: schema.organization.id })
                .from(schema.organization)
                .innerJoin(
                  schema.member,
                  eq(schema.organization.id, schema.member.organizationId),
                )
                .where(
                  and(
                    eq(
                      schema.organization.id,
                      lastActiveSession[0].activeOrganizationId,
                    ),
                    eq(schema.member.userId, sessionData.userId),
                  ),
                )
                .limit(1);

              if (orgValidation.length > 0) {
                activeOrganizationId =
                  lastActiveSession[0].activeOrganizationId;
              }
            }

            // If no valid active organization from previous session, get first available
            if (!activeOrganizationId) {
              const userOrgs = await db
                .select({ organizationId: schema.member.organizationId })
                .from(schema.member)
                .where(eq(schema.member.userId, sessionData.userId))
                .limit(1);

              if (userOrgs.length > 0) {
                activeOrganizationId = userOrgs[0].organizationId;
              }
            }

            return { data: { ...sessionData, activeOrganizationId } };
          },
        },
      },
    },

    // Email & Password settings
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    // Session configuration
    session: {
      expiresIn: 60 * 60 * 24, // 24 hours
      updateAge: 60 * 60, // 1 hour
      freshAge: 60 * 60 * 24, // 24 hours
      strategy: 'jwt',
    },

    // Organization settings
    organization: {
      enabled: true,
      allowPersonalAccounts: true,
      // Disable organization validation to prevent errors
      requireActiveOrganization: false,
    },

    // Error handling
    onAPIError: {
      throw: false,
      onError: (error: unknown) => {
        console.error('Better Auth error:', error);
      },
    },

    // Advanced settings
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      useSecureCookies: process.env.NODE_ENV === 'production',
    },

    // Trusted origins
    trustedOrigins: [
      process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
  });
}

/**
 * Better Auth Fastify Plugin
 * Registers Better Auth with database and decorates fastify.betterAuth
 */
const betterAuthPlugin = fp(async function betterAuthPlugin(
  fastify: FastifyInstance,
) {
  // Ensure database is available
  if (!fastify.db) {
    throw new Error(
      'Database plugin must be registered before Better Auth plugin',
    );
  }

  // Create auth instance with database
  const auth = createAuthInstance(fastify.db);

  // Decorate Fastify instance with auth
  fastify.decorate('betterAuth', auth);

  // Register Better Auth routes in an encapsulated context
  await fastify.register(
    async function betterAuthRoutesPlugin(authFastify) {
      // Register a catch-all route within this context
      authFastify.route({
        method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        url: '/*',
        handler: async (request, reply) => {
          try {
            // Convert Fastify request to Web Request
            const url = new URL(request.url, `http://${request.headers.host}`);

            const headers = new Headers();
            Object.entries(request.headers).forEach(([key, value]) => {
              if (value) headers.append(key, value.toString());
            });

            const requestInit: RequestInit = {
              method: request.method,
              headers,
            };

            if (
              request.method !== 'GET' &&
              request.method !== 'HEAD' &&
              request.body
            ) {
              requestInit.body = JSON.stringify(request.body);
            }

            const webRequest = new Request(url.toString(), requestInit);

            authFastify.log.info(
              `🔐 [BetterAuth] Handling ${request.method} ${request.url}`,
            );

            // Let Better Auth handle the request
            const response = await auth.handler(webRequest);

            // Forward response
            reply.status(response.status);
            response.headers.forEach((value, key) => reply.header(key, value));

            const body = await response.text();
            return reply.send(body);
          } catch (error) {
            authFastify.log.error(
              { err: error },
              'Better Auth route handler error',
            );
            throw authFastify.httpErrors.internalServerError(
              'Internal server error',
            );
          }
        },
      });
    },
    { prefix: '/auth' },
  );

  fastify.log.info(
    '✅ Better Auth plugin registered at /auth/* (server adds /api prefix)',
  );
});

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    betterAuth: ReturnType<typeof createAuthInstance>;
  }
}

export default betterAuthPlugin;
