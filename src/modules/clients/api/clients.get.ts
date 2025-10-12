import type { FastifyRequest, FastifyReply } from 'fastify';
import { clientsRepository } from '@/modules/clients/database/queries/clients.repository';

/**
 * List clients for organization
 * GET /api/clients
 */
export default async function listClientsRoute(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Get query parameters
    const limit = Math.min(Number(request.query.limit) || 50, 100);
    const offset = Number(request.query.offset) || 0;

    // List clients
    const clients =
      await clientsRepository.listByOrganizationId(organizationId);

    // Apply pagination
    const paginatedClients = clients.slice(offset, offset + limit);

    return reply.send({
      success: true,
      data: paginatedClients,
      pagination: {
        limit,
        offset,
        total: clients.length,
        hasMore: offset + limit < clients.length,
      },
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to list clients');
  }
}
