import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { SettingsService } from '../services/settings-service';
import {
  userSettingsSchema,
  userSettingsCategorySchemas,
  userSettingsCategoryParamsSchema,
  settingsHistoryQuerySchema,
} from '../validation';

// User Settings API routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const settingsService = new SettingsService();

  // GET /api/settings/user
  fastify.get(
    '/settings/user',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }
        const settings = await settingsService.getUserSettings(userId);

        return { data: settings };
      } catch (error) {
        fastify.log.error('Error getting user settings:', undefined, error);
        reply.status(500).send({ error: 'Failed to get user settings' });
      }
    },
  );

  // PUT /api/settings/user
  fastify.put(
    '/settings/user',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }
        const body = userSettingsSchema.parse(request.body);

        const settings = await settingsService.updateUserSettings(
          userId,
          body,
          userId, // changedBy
        );

        return { data: settings };
      } catch (error) {
        fastify.log.error('Error updating user settings:', undefined, error);
        reply.status(500).send({ error: 'Failed to update user settings' });
      }
    },
  );

  // PUT /api/settings/user/:category
  fastify.put(
    '/settings/user/:category',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }
        const { category } = userSettingsCategoryParamsSchema.parse(
          request.params,
        );
        const schema = userSettingsCategorySchemas[category];
        const data = schema.parse(request.body);
        const settings = await settingsService.updateUserSettingsCategory(
          userId,
          category,
          data,
          userId,
        );

        return { data: settings };
      } catch (error) {
        fastify.log.error(
          'Error updating user settings category:',
          undefined,
          error,
        );
        reply
          .status(500)
          .send({ error: 'Failed to update user settings category' });
      }
    },
  );

  // GET /api/settings/user/history
  fastify.get(
    '/settings/user/history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }
        const { limit = 50 } = settingsHistoryQuerySchema.parse(request.query);

        const history = await settingsService.getSettingsHistory(
          'user',
          userId,
          limit,
        );

        return { data: history };
      } catch (error) {
        fastify.log.error(
          'Error getting user settings history:',
          undefined,
          error,
        );
        reply
          .status(500)
          .send({ error: 'Failed to get user settings history' });
      }
    },
  );
});
