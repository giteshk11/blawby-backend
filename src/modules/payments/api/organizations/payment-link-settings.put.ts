import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/shared/database';
import { organizations } from '@/schema';
import { eq } from 'drizzle-orm';
import { paymentLinkSettingsSchema } from '@/shared/validations/payment-links';

type UpdatePaymentLinkSettingsRequest = FastifyRequest<{
  Body: {
    enabled: boolean;
    prefillAmount?: number;
  };
}>;

export default async function updatePaymentLinkSettings(
  request: UpdatePaymentLinkSettingsRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const validated = paymentLinkSettingsSchema.parse(request.body);
  const organizationId = request.activeOrganizationId;

  if (!organizationId) {
    return reply.code(401).send({ error: 'UNAUTHORIZED' });
  }

  // Update organization payment link settings
  const [updated] = await db
    .update(organizations)
    .set({
      paymentLinkEnabled: validated.enabled,
      paymentLinkPrefillAmount: validated.prefillAmount || 0,
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  return reply.send({
    paymentLinkEnabled: updated.paymentLinkEnabled,
    paymentLinkPrefillAmount: updated.paymentLinkPrefillAmount,
  });
}
