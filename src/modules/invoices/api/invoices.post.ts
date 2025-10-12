import type { FastifyRequest, FastifyReply } from 'fastify';
import { createInvoiceService } from '@/modules/invoices/services/invoices.service';
import { z } from 'zod';

// Request validation schema
const createInvoiceSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  invoiceType: z.enum(['customer', 'platform']),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1'),
        unitPrice: z
          .number()
          .int()
          .min(1, 'Unit price must be at least 1 cent'),
      }),
    )
    .min(1, 'At least one line item is required'),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

type CreateInvoiceRequest = FastifyRequest<{
  Body: z.infer<typeof createInvoiceSchema>;
}>;

/**
 * Create a new invoice
 * POST /api/invoices
 */
export default async function createInvoiceRoute(
  request: CreateInvoiceRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = createInvoiceSchema.parse(request.body);

    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Create invoice service
    const invoiceService = createInvoiceService(request.server);

    // Create invoice
    const result = await invoiceService.createInvoice({
      organizationId,
      customerId: validatedData.customerId,
      invoiceType: validatedData.invoiceType,
      lineItems: validatedData.lineItems,
      dueDate: validatedData.dueDate
        ? new Date(validatedData.dueDate)
        : undefined,
      metadata: validatedData.metadata,
    });

    if (!result.success) {
      return reply.badRequest(result.error || 'Failed to create invoice');
    }

    return reply.status(201).send({
      success: true,
      data: result.invoice,
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
    return reply.internalServerError('Failed to create invoice');
  }
}
