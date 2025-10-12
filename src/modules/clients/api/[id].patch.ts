import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClientsService } from '../services/clients.service';
import { z } from 'zod';

// Request validation schema
const updateClientSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postal_code: z.string().optional(),
      country: z.string().length(2).optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

type UpdateClientRequest = FastifyRequest<{
  Params: {
    id: string;
  };
  Body: z.infer<typeof updateClientSchema>;
}>;

/**
 * Update client
 * PATCH /api/clients/:id
 */
export default async function updateClientRoute(
  request: UpdateClientRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = updateClientSchema.parse(request.body);

    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create clients service
    const clientsService = createClientsService(request.server);

    // Update client
    const result = await clientsService.updateClient({
      clientId: request.params.id,
      organizationId,
      name: validatedData.name,
      phone: validatedData.phone,
      address: validatedData.address,
      metadata: validatedData.metadata,
    });

    if (!result.success) {
      if (result.error === 'Client not found') {
        return reply.notFound('Client not found');
      }
      return reply.badRequest(result.error || 'Failed to update client');
    }

    return reply.send({
      success: true,
      data: result.client,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.badRequest({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    }

    request.server.logError(error, request);
    return reply.internalServerError('Failed to update client');
  }
}
