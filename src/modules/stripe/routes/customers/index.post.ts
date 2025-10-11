import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOrGetCustomer } from '@/modules/stripe/services/customers.service';
import { createCustomerRequestSchema } from '@/modules/stripe/schemas/customers.schema';

type CreateCustomerBody = {
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, any>;
};

/**
 * Create or get customer
 * POST /api/stripe/customers
 */
export default async function createCustomerRoute(
  request: FastifyRequest<{ Body: CreateCustomerBody }>,
  reply: FastifyReply,
) {
  // Validate request body
  const validatedData = createCustomerRequestSchema.parse(request.body);

  const customer = await createOrGetCustomer(
    request.server,
    request.activeOrganizationId || '',
    validatedData,
  );

  return reply.send(customer);
}

