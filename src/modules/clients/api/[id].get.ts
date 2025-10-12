import type { FastifyRequest, FastifyReply } from 'fastify';
import { clientsRepository } from '@/modules/clients/database/queries/clients.repository';

type GetClientRequest = FastifyRequest<{
  Params: {
    id: string;
  };
}>;

/**
 * Get client by ID
 * GET /api/clients/:id
 */
export default async function getClientRoute(
  request: GetClientRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Get client
    const client = await clientsRepository.findById(request.params.id);
    if (!client) {
      return reply.notFound('Client not found');
    }

    // Verify organization owns this client
    if (client.organizationId !== organizationId) {
      return reply.forbidden('Unauthorized access to client');
    }

    return reply.send({
      success: true,
      data: client,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get client');
  }
}
