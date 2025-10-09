import { FastifyRequest, FastifyReply } from 'fastify';

export function requireRoles(allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.unauthorized('Authentication required');
    }

    const userRole = request.user.role || 'user'; // Default role

    if (!allowedRoles.includes(userRole)) {
      return reply.forbidden('Insufficient permissions');
    }
  };
}

export function requireAdmin() {
  return requireRoles(['admin']);
}

export function requireOwner() {
  return requireRoles(['owner', 'admin']);
}
