import { FastifyRequest, FastifyReply } from 'fastify';

export function requireRoles(
  allowedRoles: string[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!request.user) {
      return reply.unauthorized('Authentication required');
    }

    const userRole = request.user.role || 'user'; // Default role

    if (!allowedRoles.includes(userRole)) {
      return reply.forbidden('Insufficient permissions');
    }
  };
}

export function requireAdmin(): (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> {
  return requireRoles(['admin']);
}

export function requireOwner(): (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> {
  return requireRoles(['owner', 'admin']);
}
