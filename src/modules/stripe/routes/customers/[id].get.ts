import type { FastifyRequest, FastifyReply } from 'fastify';
import { getCustomer } from '@/modules/stripe/services/customers.service';

/**
 * Get customer by ID
 * GET /api/stripe/customers/:id
 */
export default async function getCustomerRoute(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = request.params;

  const customer = await getCustomer(request.server, id);

  if (!customer) {
    return reply.notFound('Customer not found');
  }

  return reply.send(customer);
}

