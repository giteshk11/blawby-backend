import type { FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceService } from '@/modules/invoices/services/invoices.service';

type SendInvoiceRequest = FastifyRequest<{
  Params: {
    id: string;
  };
}>;

/**
 * Send invoice to customer
 * POST /api/invoices/:id/send
 */
export default async function sendInvoiceRoute(
  request: SendInvoiceRequest,
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

    // Send invoice
    const result = await invoiceService.sendInvoice({
      invoiceId: request.params.id,
      organizationId,
    });

    if (!result.success) {
      if (result.error === 'Invoice not found') {
        return reply.notFound('Invoice not found');
      }
      return reply.badRequest(result.error || 'Failed to send invoice');
    }

    return reply.send({
      success: true,
      data: {
        invoiceUrl: result.invoiceUrl,
      },
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to send invoice');
  }
}
