import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/shared/database';
import { organizations } from '@/schema';
import { eq } from 'drizzle-orm';
import { connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';

type GetPaymentPageRequest = FastifyRequest<{
  Params: { slug: string };
  Querystring: { amount?: string };
}>;

export default async function getPublicPaymentPage(
  request: GetPaymentPageRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { slug } = request.params;
  const { amount } = request.query;

  // Find organization by slug
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });

  if (!organization || !organization.paymentLinkEnabled) {
    return reply.code(404).send({
      error: 'NOT_FOUND',
      message: 'Payment page not found',
    });
  }

  // Verify connected account is active
  const connectedAccount =
    await connectedAccountsRepository.findByOrganizationId(organization.id);

  if (!connectedAccount?.chargesEnabled) {
    return reply.code(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Payment processing not available',
    });
  }

  return reply.send({
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logo: organization.logo,
    },
    paymentConfig: {
      prefillAmount: amount
        ? Math.round(parseFloat(amount) * 100) // Convert dollars to cents
        : organization.paymentLinkPrefillAmount || 0,
      currency: 'usd',
    },
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY, // For client integration
  });
}
