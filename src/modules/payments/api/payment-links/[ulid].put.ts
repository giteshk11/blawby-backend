import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyCaptcha } from '@/shared/middleware/captcha';
import { paymentLinksRepository } from '@/modules/payments/database/queries/payment-links.repository';
import { getStripeClient } from '@/shared/services/stripe-client.service';

type UpdatePaymentLinkRequest = FastifyRequest<{
  Params: { ulid: string };
  Body: {
    paymentIntentId: string;
    amount: number;
  };
}>;

export default async function updatePaymentLink(
  request: UpdatePaymentLinkRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  // 1. CAPTCHA verification
  await verifyCaptcha(request, reply);
  if (reply.sent) return reply;

  const { ulid } = request.params;
  const { paymentIntentId, amount } = request.body;

  // 2. Find payment link
  const paymentLink = await paymentLinksRepository.findByUlid(ulid);

  if (!paymentLink) {
    return reply.code(404).send({ error: 'PAYMENT_NOT_FOUND' });
  }

  if (paymentLink.stripePaymentIntentId !== paymentIntentId) {
    return reply.code(400).send({ error: 'PAYMENT_INTENT_MISMATCH' });
  }

  // 3. Update Stripe payment intent
  const stripe = getStripeClient();
  const updatedIntent = await stripe.paymentIntents.update(paymentIntentId, {
    amount,
  });

  // 4. Update database
  await paymentLinksRepository.update(paymentLink.id, { amount });

  return reply.send({
    paymentIntentId: updatedIntent.id,
    clientSecret: updatedIntent.client_secret,
    amount: updatedIntent.amount,
    status: updatedIntent.status,
  });
}
