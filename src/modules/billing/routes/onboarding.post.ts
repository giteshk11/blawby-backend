import { FastifyRequest, FastifyReply } from 'fastify';
import { createOnboardingSession } from '../services/billing.service';
import { validateBody } from '@/shared/utils/validation';
import { createOnboardingSessionSchema } from '@/shared/validations/billing';

type CreateOnboardingSessionRequest = {
  Body: unknown; // Will be validated by Zod
};

/**
 * Create onboarding session for organization
 * POST /api/billing/onboarding
 */
export default async function createOnboardingSessionRoute(
  request: FastifyRequest<CreateOnboardingSessionRequest>,
  reply: FastifyReply,
) {
  const validatedData = await validateBody(
    request,
    reply,
    createOnboardingSessionSchema,
  );

  const session = await createOnboardingSession(
    validatedData,
    request.user,
    request.server,
  );

  return reply.send({ data: session });
}
