import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { SettingsService } from '../services/settings-service';
import {
  organizationSettingsSchema,
  organizationSettingsCategorySchemas,
  organizationSettingsParamsSchema,
  organizationSettingsCategoryParamsSchema,
  settingsHistoryQuerySchema,
} from '../validation';

// Organization Settings API routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const settingsService = new SettingsService();

  // GET /api/settings/organization/:organizationId
  fastify.get(
    '/settings/organization/:organizationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { organizationId } = organizationSettingsParamsSchema.parse(
          request.params,
        );
        const activeOrganizationId = request.activeOrganizationId;
        if (!activeOrganizationId) {
          return reply
            .status(400)
            .send({ error: 'Active organization not found' });
        }

        // Check if user has permission to access this organization
        if (activeOrganizationId !== organizationId) {
          return reply
            .status(403)
            .send({ error: 'Access denied to organization settings' });
        }

        const settings =
          await settingsService.getOrganizationSettings(organizationId);

        return { data: settings };
      } catch (error) {
        fastify.log.error(
          'Error getting organization settings:',
          undefined,
          error,
        );
        reply
          .status(500)
          .send({ error: 'Failed to get organization settings' });
      }
    },
  );

  // PUT /api/settings/organization/:organizationId
  fastify.put(
    '/settings/organization/:organizationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }
        const { organizationId } = organizationSettingsParamsSchema.parse(
          request.params,
        );
        const activeOrganizationId = request.activeOrganizationId;
        if (!activeOrganizationId) {
          return reply
            .status(400)
            .send({ error: 'Active organization not found' });
        }

        // Check if user has permission to modify this organization
        if (activeOrganizationId !== organizationId) {
          return reply
            .status(403)
            .send({ error: 'Access denied to organization settings' });
        }

        const body = organizationSettingsSchema.parse(request.body);

        const settings = await settingsService.updateOrganizationSettings(
          organizationId,
          body,
          userId,
        );

        return { data: settings };
      } catch (error) {
        fastify.log.error(
          'Error updating organization settings:',
          undefined,
          error,
        );
        reply
          .status(500)
          .send({ error: 'Failed to update organization settings' });
      }
    },
  );

  // PUT /api/settings/organization/:organizationId/:category
  fastify.put(
    '/settings/organization/:organizationId/:category',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }
        const { organizationId, category } =
          organizationSettingsCategoryParamsSchema.parse(request.params);
        const activeOrganizationId = request.activeOrganizationId;
        if (!activeOrganizationId) {
          return reply
            .status(400)
            .send({ error: 'Active organization not found' });
        }

        // Check if user has permission to modify this organization
        if (activeOrganizationId !== organizationId) {
          return reply
            .status(403)
            .send({ error: 'Access denied to organization settings' });
        }

        const schema = organizationSettingsCategorySchemas[category];
        const data = schema.parse(request.body);
        const settings =
          await settingsService.updateOrganizationSettingsCategory(
            organizationId,
            category,
            data,
            userId,
          );

        return { data: settings };
      } catch (error) {
        fastify.log.error(
          'Error updating organization settings category:',
          undefined,
          error,
        );
        reply
          .status(500)
          .send({ error: 'Failed to update organization settings category' });
      }
    },
  );

  // GET /api/settings/organization/:organizationId/history
  fastify.get(
    '/settings/organization/:organizationId/history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { organizationId } = organizationSettingsParamsSchema.parse(
          request.params,
        );
        const activeOrganizationId = request.activeOrganizationId;
        if (!activeOrganizationId) {
          return reply
            .status(400)
            .send({ error: 'Active organization not found' });
        }

        // Check if user has permission to access this organization
        if (activeOrganizationId !== organizationId) {
          return reply
            .status(403)
            .send({ error: 'Access denied to organization settings' });
        }

        const { limit = 50 } = settingsHistoryQuerySchema.parse(request.query);

        const history = await settingsService.getSettingsHistory(
          'organization',
          organizationId,
          limit,
        );

        return { data: history };
      } catch (error) {
        fastify.log.error(
          'Error getting organization settings history:',
          undefined,
          error,
        );
        reply
          .status(500)
          .send({ error: 'Failed to get organization settings history' });
      }
    },
  );
});
