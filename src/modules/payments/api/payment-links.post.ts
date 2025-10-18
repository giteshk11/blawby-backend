import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyCaptcha } from '@/shared/middleware/captcha';
import { paymentLinksRepository } from '../database/queries/payment-links.repository';
import { stripeConnectedAccountsRepository as connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import { createPaymentLinkSchema } from '@/shared/validations/payment-links';
import { getStripeClient } from '@/shared/services/stripe-client.service';
import crypto from 'crypto';

type CreatePaymentLinkRequest = FastifyRequest<{
  Body: {
    organizationId: string;
    amount: number;
    email: string;
    name: string;
    onBehalfOf?: string;
  };
}>;

export default async function createPaymentLink(
  request: CreatePaymentLinkRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  // 1. CAPTCHA verification (blocks bots and abuse)
  await verifyCaptcha(request, reply);
  if (reply.sent) return reply; // CAPTCHA failed

  // 2. Validate request body
  const validated = createPaymentLinkSchema.parse(request.body);

  // 3. Get connected account
  const connectedAccount =
    await connectedAccountsRepository.findByOrganizationId(
      validated.organizationId,
    );

  if (!connectedAccount?.chargesEnabled) {
    return reply.badRequest(
      'Payment processing not enabled for this organization',
    );
  }

  // 4. Create Stripe payment intent with transfer_data
  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.create({
    amount: validated.amount,
    currency: 'usd',
    transfer_data: {
      destination: connectedAccount.stripeAccountId,
    },
    metadata: {
      organization_id: validated.organizationId,
      email: validated.email,
      name: validated.name,
      on_behalf_of: validated.onBehalfOf || '',
    },
    payment_method_types: ['card', 'us_bank_account'],
    payment_method_options: {
      us_bank_account: {
        financial_connections: {
          permissions: ['payment_method', 'balances'],
        },
      },
    },
  });

  // 5. Generate ULID for receipt
  const ulid = crypto.randomUUID(); // Use crypto.randomUUID or install ulid package

  // 6. Save to database
  const paymentLink = await paymentLinksRepository.create({
    ulid,
    organizationId: validated.organizationId,
    connectedAccountId: connectedAccount.id,
    stripePaymentIntentId: paymentIntent.id,
    amount: validated.amount,
    currency: 'usd',
    status: paymentIntent.status,
    metadata: {
      email: validated.email,
      name: validated.name,
      ...(validated.onBehalfOf && { on_behalf_of: validated.onBehalfOf }),
    },
    customerIp: request.ip,
  });

  request.log.info(
    {
      paymentLinkId: paymentLink.id,
      organizationId: validated.organizationId,
      amount: validated.amount,
    },
    'Payment link created',
  );

  return reply.send({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    status: paymentIntent.status,
    customPaymentId: paymentLink.ulid,
  });
}
