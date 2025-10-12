import type { FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceService } from '@/modules/invoices/services/invoices.service';

type VoidInvoiceRequest = FastifyRequest<{
  Params: {
    id: string;
  };
}>;

/**
 * Void an invoice
 * POST /api/invoices/:id/void
 */
export default async function voidInvoiceRoute(
  request: VoidInvoiceRequest,
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

    // Void invoice
    const result = await invoiceService.voidInvoice(
      request.params.id,
      organizationId,
    );

    if (!result.success) {
      if (result.error === 'Invoice not found') {
        return reply.notFound('Invoice not found');
      }
      return reply.badRequest(result.error || 'Failed to void invoice');
    }

    return reply.send({
      success: true,
      message: 'Invoice voided successfully',
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to void invoice');
  }
}
