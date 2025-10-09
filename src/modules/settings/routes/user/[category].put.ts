import { FastifyRequest, FastifyReply } from 'fastify';
import { updateUserSettingsCategory } from '@/modules/settings/services/settings.service';

type UpdateUserSettingsCategoryRequest = {
  Params: {
    category: string;
  };
  Body: any;
};

/**
 * Update specific user settings category
 * PUT /api/settings/user/:category
 */
export default async function updateUserSettingsCategoryRoute(
  request: FastifyRequest<UpdateUserSettingsCategoryRequest>,
  reply: FastifyReply,
) {
  const settings = await updateUserSettingsCategory(
    request.userId,
    request.params.category,
    request.body,
    request.userId, // changedBy
  );

  return reply.send({ data: settings });
}

export const config = {};
