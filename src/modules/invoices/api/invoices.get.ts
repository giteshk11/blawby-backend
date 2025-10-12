import type { FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceService } from '@/modules/invoices/services/invoices.service';

/**
 * List invoices for organization
 * GET /api/invoices
 */
export default async function listInvoicesRoute(
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

    // Create invoice service
    const invoiceService = createInvoiceService(request.server);

    // List invoices
    const result = await invoiceService.listInvoices(
      organizationId,
      limit,
      offset,
    );

    if (!result.success) {
      return reply.badRequest(result.error || 'Failed to list invoices');
    }

    return reply.send({
      success: true,
      data: result.invoices,
      pagination: {
        limit,
        offset,
        hasMore: result.invoices!.length === limit,
      },
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to list invoices');
  }
}
