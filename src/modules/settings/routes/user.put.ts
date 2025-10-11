import { FastifyRequest, FastifyReply } from 'fastify';
import { updateUserSettings } from '../services/settings.service';
import { validateBody } from '@/shared/utils/validation';
import { updateUserSettingsSchema } from '@/shared/validations/settings';

type UpdateUserSettingsRequest = {
  Body: unknown; // Will be validated by Zod
};

/**
 * Update user settings
 * PUT /api/settings/user
 */
export default async function updateUserSettingsRoute(
  request: FastifyRequest<UpdateUserSettingsRequest>,
  reply: FastifyReply,
) {
  const validatedData = await validateBody(
    request,
    reply,
    updateUserSettingsSchema,
  );

  const settings = await updateUserSettings(
    request.userId!,
    validatedData,
    request.userId!, // changedBy
    request.server, // fastify instance for events
  );

  return reply.send({ data: settings });
}
