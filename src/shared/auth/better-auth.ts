// src/better-auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, organization, multiSession } from 'better-auth/plugins';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/schema';
import { eq, and } from 'drizzle-orm';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { EventType } from '@/shared/events/enums/event-types';
import { sanitizeError } from '@/shared/utils/logging';

/**
 * Create Better Auth instance with database connection
 * This is called once during plugin initialization
 */
const betterAuthInstance = (
  db: NodePgDatabase<typeof schema>,
  fastify?: FastifyInstance,
  // oxlint-disable-next-line explicit-function-return-type
) => {
  return betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,

    // Connect to database via Drizzle adapter with schema
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
      usePlural: true,
    }),

    // Plugins
    plugins: [bearer(), organization(), multiSession({ maximumSessions: 1 })],

    // Base path for auth routes (server already adds /api prefix)
    basePath: '/auth',

    // Database hooks for session management
    databaseHooks: {
      user: {
        create: {
          after: async (userData: {
            id: string;
            email: string;
            name: string;
            [key: string]: unknown;
          }) => {
            // Publish user created event if events are available
            if (fastify?.events) {
              try {
                await fastify.events.publish({
                  eventType: EventType.USER_CREATED,
                  eventVersion: '1.0.0',
                  actorId: userData.id,
                  actorType: 'user',
                  payload: {
                    userId: userData.id,
                    email: userData.email,
                    name: userData.name,
                  },
                  metadata: fastify.events.createMetadata('auth'),
                });
              } catch (error) {
                fastify.log.error(
                  { error, userId: userData.id },
                  'Failed to publish user created event',
                );
              }
            }
          },
        },
      },
      session: {
        create: {
          before: async (sessionData: {
            userId: string;
            [key: string]: unknown;
          }) => {
            // Get last active organization
            const lastActiveSession = await db
              .select({
                activeOrganizationId: schema.sessions.activeOrganizationId,
              })
              .from(schema.sessions)
              .where(eq(schema.sessions.userId, sessionData.userId))
              .limit(1);

            // Delete old sessions (maximumSessions: 1)
            await db
              .delete(schema.sessions)
              .where(eq(schema.sessions.userId, sessionData.userId));

            // Determine active organization (optional - can be null for users exploring the app)
            let activeOrganizationId: string | null = null;

            try {
              if (
                lastActiveSession.length > 0 &&
                lastActiveSession[0].activeOrganizationId
              ) {
                // Validate that the previous active organization still exists and user has access
                const orgValidation = await db
                  .select({ id: schema.organizations.id })
                  .from(schema.organizations)
                  .innerJoin(
                    schema.members,
                    eq(schema.organizations.id, schema.members.organizationId),
                  )
                  .where(
                    and(
                      eq(
                        schema.organizations.id,
                        lastActiveSession[0].activeOrganizationId,
                      ),
                      eq(schema.members.userId, sessionData.userId),
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
                  .select({ organizationId: schema.members.organizationId })
                  .from(schema.members)
                  .where(eq(schema.members.userId, sessionData.userId))
                  .limit(1);

                if (userOrgs.length > 0) {
                  activeOrganizationId = userOrgs[0].organizationId;
                }
                // If still no organization, that's OK - user can explore without one
              }
            } catch (error) {
              // If anything fails, just continue without an organization
              // Users can still access the app and create organizations later
              fastify?.log.warn(
                { error, userId: sessionData.userId },
                'Failed to set active organization, continuing without one',
              );
            }

            return { data: { ...sessionData, activeOrganizationId } };
          },
          after: async (sessionData: {
            userId: string;
            id: string;
            [key: string]: unknown;
          }) => {
            // Publish session created event if events are available
            if (fastify?.events) {
              try {
                // Publish user logged in event
                await fastify.events.publish({
                  eventType: EventType.AUTH_USER_LOGGED_IN,
                  eventVersion: '1.0.0',
                  actorId: sessionData.userId,
                  actorType: 'user',
                  payload: {
                    sessionId: sessionData.id,
                    activeOrganizationId: sessionData.activeOrganizationId,
                  },
                  metadata: fastify.events.createMetadata('auth'),
                });

                // Also publish session created event
                await fastify.events.publish({
                  eventType: EventType.SESSION_CREATED,
                  eventVersion: '1.0.0',
                  actorId: sessionData.userId,
                  actorType: 'user',
                  payload: {
                    sessionId: sessionData.id,
                    activeOrganizationId: sessionData.activeOrganizationId,
                  },
                  metadata: fastify.events.createMetadata('auth'),
                });
              } catch (error) {
                fastify.log.error(
                  { error, userId: sessionData.userId },
                  'Failed to publish session created event',
                );
              }
            }
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
      onError: (error: unknown, context?: Record<string, unknown>): void => {
        // Enhanced error logging with context
        const sanitizedError = sanitizeError(error);

        if (fastify?.log) {
          fastify.log.error(
            {
              error: sanitizedError,
              context: {
                component: 'BetterAuth',
                operation: context?.operation || 'unknown',
                endpoint: context?.endpoint,
                userId: context?.userId,
                sessionId: context?.sessionId,
                ...context,
              },
            },
            'Better Auth API error',
          );
        } else {
          console.error('Better Auth error:', sanitizedError);
        }
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
};

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

  // Create auth instance with database and fastify instance for events
  const betterAuth = betterAuthInstance(fastify.db, fastify);

  // Decorate Fastify instance with auth
  fastify.decorate('betterAuth', betterAuth);

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
            const response = await betterAuth.handler(webRequest);

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

export type BetterAuthInstance = ReturnType<typeof betterAuthInstance>;

export default betterAuthPlugin;
