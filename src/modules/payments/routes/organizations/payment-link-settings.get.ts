import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/shared/database';
import { organizations } from '@/schema';
import { eq } from 'drizzle-orm';

export default async function getPaymentLinkSettings(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const organizationId = request.activeOrganizationId;

  if (!organizationId) {
    return reply.code(401).send({ error: 'UNAUTHORIZED' });
  }

  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: {
      id: true,
      name: true,
      slug: true,
      paymentLinkEnabled: true,
      paymentLinkPrefillAmount: true,
    },
  });

  if (!organization) {
    return reply.code(404).send({ error: 'ORGANIZATION_NOT_FOUND' });
  }

  return reply.send({
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    paymentLinkSettings: {
      enabled: organization.paymentLinkEnabled,
      prefillAmount: organization.paymentLinkPrefillAmount,
      publicUrl: `${process.env.BASE_URL}/pay/${organization.slug}`,
    },
  });
}
