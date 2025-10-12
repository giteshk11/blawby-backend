import type { FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceService } from '@/modules/invoices/services/invoices.service';

type GetInvoiceRequest = FastifyRequest<{
  Params: {
    id: string;
  };
}>;

/**
 * Get invoice by ID
 * GET /api/invoices/:id
 */
export default async function getInvoiceRoute(
  request: GetInvoiceRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create invoice service
    const invoiceService = createInvoiceService(request.server);

    // Get invoice
    const result = await invoiceService.getInvoice(
      request.params.id,
      organizationId,
    );

    if (!result.success) {
      if (result.error === 'Invoice not found') {
        return reply.notFound('Invoice not found');
      }
      return reply.badRequest(result.error || 'Failed to get invoice');
    }

    return reply.send({
      success: true,
      data: result.invoice,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get invoice');
  }
}
