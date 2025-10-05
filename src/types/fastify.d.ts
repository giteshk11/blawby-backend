import { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    activeOrganizationId?: string;
  }
}
