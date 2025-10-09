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
      [key: string]: any;
    };
    session?: {
      id: string;
      userId: string;
      expiresAt: Date;
      [key: string]: any;
    };
    userId?: string;
    activeOrganizationId?: string;
  }

  interface FastifyReply {
    // Sensible plugin methods (only error responses)
    send(payload?: any): FastifyReply;
    badRequest(message?: string): FastifyReply;
    unauthorized(message?: string): FastifyReply;
    forbidden(message?: string): FastifyReply;
    notFound(message?: string): FastifyReply;
    conflict(message?: string): FastifyReply;
    internalServerError(message?: string): FastifyReply;
  }
}
