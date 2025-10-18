// src/types/fastify.d.ts
import { User } from '@/schema';
import type { BetterAuthInstance } from '@/shared/auth/better-auth';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/schema';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
    betterAuth: BetterAuthInstance;
    verifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
  interface FastifyRequest {
    user?: User;
    session?: typeof schema.sessions.$inferSelect & {
      id: string;
      userId: string;
      expiresAt: Date;
      activeOrganizationId: string | null;
      [key: string]: unknown;
    };
    userId?: string;
    activeOrganizationId?: string;
    startTime?: number;
    rawBody?: Buffer;
  }

  interface FastifyReply {
    // Sensible plugin methods (only error responses)
    send(payload?: unknown): FastifyReply;
    badRequest(message?: string): FastifyReply;
    unauthorized(message?: string): FastifyReply;
    forbidden(message?: string): FastifyReply;
    notFound(message?: string): FastifyReply;
    conflict(message?: string): FastifyReply;
    internalServerError(message?: string): FastifyReply;
  }
}
