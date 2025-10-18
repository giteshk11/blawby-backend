import type { FastifyRequest, FastifyReply } from 'fastify';
import { paymentLinksRepository } from '@/modules/payments/database/queries/payment-links.repository';
import { db } from '@/shared/database';
import { organizations } from '@/schema';
import { eq } from 'drizzle-orm';
import { getStripeClient } from '@/shared/services/stripe-client.service';

type PaymentStatusRequest = FastifyRequest<{
  Querystring: { payment_intent_id: string };
}>;

export default async function getPaymentStatus(
  request: PaymentStatusRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { payment_intent_id } = request.query;

  if (!payment_intent_id) {
    return reply.code(400).send({ error: 'MISSING_PAYMENT_INTENT_ID' });
  }

  // Find payment link
  const paymentLink =
    await paymentLinksRepository.findByStripePaymentIntentId(payment_intent_id);

  if (!paymentLink) {
    return reply.code(404).send({ error: 'PAYMENT_NOT_FOUND' });
  }

  // Get latest status from Stripe
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

  // Get organization details
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, paymentLink.organizationId),
  });

  return reply.send({
    payment: {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      receiptId: paymentLink.ulid,
    },
    organization: {
      name: organization?.name,
      logo: organization?.logo,
    },
  });
}
