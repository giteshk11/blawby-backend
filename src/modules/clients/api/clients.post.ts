import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Request validation schema
const createClientSchema = z.object({
  email: z.string().email('Invalid email address'),
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

type CreateClientRequest = FastifyRequest<{
  Body: z.infer<typeof createClientSchema>;
}>;

/**
 * Create a new client
 * POST /api/clients
 */
export default async function createClientRoute(
  request: CreateClientRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Validate request body
    const validatedData = createClientSchema.parse(request.body);

    // Get organization ID from request
    const organizationId = request.activeOrganizationId;
    if (!organizationId) {
      return reply.unauthorized('Organization ID is required');
    }

    // Check if customer already exists with this email
    const existingCustomer = await customersRepository.findByEmail(
      validatedData.email,
    );
    if (existingCustomer) {
      return reply.conflict('Customer with this email already exists');
    }

    // Create customer on Stripe
    const stripeCustomer = await request.server.stripe.customers.create({
      email: validatedData.email,
      name: validatedData.name,
      phone: validatedData.phone,
      address: validatedData.address,
      metadata: {
        organizationId,
        ...validatedData.metadata,
      },
    });

    // Store customer in database
    const customer = await customersRepository.create({
      userId: request.userId,
      organizationId,
      stripeCustomerId: stripeCustomer.id,
      email: validatedData.email,
      name: validatedData.name,
      phone: validatedData.phone,
      address: validatedData.address,
      metadata: validatedData.metadata,
    });

    // Publish event
    await request.server.events.publish({
      eventType: 'BILLING_CUSTOMER_CREATED',
      eventVersion: '1.0.0',
      actorId: request.userId || organizationId,
      actorType: 'user',
      organizationId,
      payload: {
        customerId: customer.id,
        email: validatedData.email,
        stripeCustomerId: stripeCustomer.id,
      },
      metadata: request.server.events.createMetadata('api'),
    });

    return reply.status(201).send({
      success: true,
      data: customer,
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
    return reply.internalServerError('Failed to create customer');
  }
}
