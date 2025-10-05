import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, bearer, organization, multiSession } from 'better-auth/plugins';
import { db } from '@/database';
import { member, session } from '@/schema';
import { eq } from 'drizzle-orm';

export const auth = betterAuth({
  // Secret key for signing sessions and tokens
  secret: process.env.BETTER_AUTH_SECRET,

  // JWT, Bearer token, Organization, and Multi-Session plugins for API authentication
  plugins: [
    jwt(),
    bearer(),
    organization(),
    multiSession({
      maximumSessions: 1, // Only allow 1 active session per user
    }),
  ],

  // Base path for API routes
  basePath: '/api/auth',

  // Use Drizzle database with PostgreSQL
  database: drizzleAdapter(db, {
    provider: 'pg', // PostgreSQL
  }),

  // Database hooks to automatically set active organization and revoke old sessions
  databaseHooks: {
    session: {
      create: {
        before: async (sessionData) => {
          // First, get the last active organization from existing sessions
          const lastActiveSession = await db
            .select({ activeOrganizationId: session.activeOrganizationId })
            .from(session)
            .where(eq(session.userId, sessionData.userId))
            .limit(1);

          // Then, revoke all existing sessions for this user (security measure)
          await db
            .delete(session)
            .where(eq(session.userId, sessionData.userId));

          // Determine which organization to set as active
          let activeOrganizationId: string | null = null;

          if (
            lastActiveSession.length > 0 &&
            lastActiveSession[0].activeOrganizationId
          ) {
            // Use the last selected organization
            activeOrganizationId = lastActiveSession[0].activeOrganizationId;
          } else {
            // Fallback: get the user's first organization
            const userOrganizations = await db
              .select({ organizationId: member.organizationId })
              .from(member)
              .where(eq(member.userId, sessionData.userId))
              .limit(1);

            if (userOrganizations.length > 0) {
              activeOrganizationId = userOrganizations[0].organizationId;
            }
          }

          // Return session with the determined active organization
          return {
            data: {
              ...sessionData,
              activeOrganizationId,
            },
          };
        },
      },
    },
  },

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Session configuration - Use JWT for stateless API authentication
  session: {
    expiresIn: 60 * 60 * 24, // Access token: 1 day
    updateAge: 60 * 60, // Update session every hour if active
    freshAge: 60 * 60 * 24, // Refresh if older than 1 day
    strategy: 'jwt',
  },

  organization: {
    enabled: true,
    allowPersonalAccounts: true,
  },

  // Custom error handling to override default Better Auth error format
  onAPIError: {
    throw: false, // Don't throw, let Fastify handle the response
    onError: (error: unknown, ctx: unknown) => {
      // Log the error for debugging
      console.error('🔐 [Better Auth] Error:', error);

      // Type guard for context
      const isContextWithResponse = (
        ctx: unknown,
      ): ctx is { response?: Response } => {
        return typeof ctx === 'object' && ctx !== null;
      };

      // Type guard for error with message
      const isErrorWithMessage = (err: unknown): err is { message: string } => {
        return typeof err === 'object' && err !== null && 'message' in err;
      };

      // Transform Better Auth error format to match your preferred structure
      const transformedError = {
        code: 'AUTH_ERROR',
        message: isErrorWithMessage(error)
          ? error.message
          : 'Authentication error occurred',
      };

      // Set the transformed error in the response
      if (isContextWithResponse(ctx) && ctx.response) {
        ctx.response = new Response(JSON.stringify(transformedError), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    },
  },

  // Advanced options
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
  },

  // Trusted origins for CORS
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || 'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
});
