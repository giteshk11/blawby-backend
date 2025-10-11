// src/types/fastify.d.ts
import type { betterAuth } from 'better-auth';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase;
    betterAuth: ReturnType<typeof betterAuth>;
    verifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      [key: string]: unknown;
    };
    session?: {
      id: string;
      userId: string;
      expiresAt: Date;
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
