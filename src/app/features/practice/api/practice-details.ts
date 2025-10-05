import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { PracticeService } from '../services';
import {
  createPracticeDetailsSchema,
  updatePracticeDetailsSchema,
} from '../validation';

// Practice API routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  const practiceService = new PracticeService();

  // POST /practice/details
  fastify.post(
    '/practice/details',
    {
      schema: {
        summary: 'Create practice details',
        description: 'Creates practice details for the active organization',
        tags: ['Practice Management'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createPracticeDetailsSchema.parse(request.body);
        const organizationId = request.activeOrganizationId;

        if (!organizationId) {
          return reply
            .status(400)
            .send({ error: 'Active organization not found' });
        }

        // Ensure the organizationId in the body matches the active organization
        if (body.organizationId !== organizationId) {
          return reply.status(403).send({
            error:
              'Cannot create practice details for a different organization',
          });
        }

        const practiceDetails =
          await practiceService.createPracticeDetails(body);

        return { data: practiceDetails };
      } catch (error) {
        fastify.log.error('Error creating practice details:', undefined, error);
        reply.status(500).send({ error: 'Failed to create practice details' });
      }
    },
  );

  // GET /api/practice/details/:organizationId
  fastify.get(
    '/practice/details/:organizationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { organizationId } = request.params as { organizationId: string };
        const activeOrganizationId = request.activeOrganizationId;

        // Check if user can access this organization
        if (activeOrganizationId !== organizationId) {
          return reply.status(403).send({
            error: 'Access denied to organization',
            code: 'ACCESS_DENIED',
          });
        }

        const practiceDetails =
          await practiceService.getPracticeDetails(organizationId);

        if (!practiceDetails) {
          return reply
            .status(404)
            .send({ error: 'Practice details not found' });
        }

        return { data: practiceDetails };
      } catch (error) {
        fastify.log.error('Error getting practice details:', undefined, error);
        reply.status(500).send({ error: 'Failed to get practice details' });
      }
    },
  );

  // PUT /api/practice/details/:organizationId
  fastify.put(
    '/practice/details/:organizationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { organizationId } = request.params as { organizationId: string };
        const body = updatePracticeDetailsSchema.parse(request.body);
        const activeOrganizationId = request.activeOrganizationId;

        // Check if user can manage this organization
        if (activeOrganizationId !== organizationId) {
          return reply.status(403).send({
            error: 'Access denied to organization',
            code: 'ACCESS_DENIED',
          });
        }

        const practiceDetails = await practiceService.updatePracticeDetails(
          organizationId,
          body,
        );

        if (!practiceDetails) {
          return reply
            .status(404)
            .send({ error: 'Practice details not found' });
        }

        return { data: practiceDetails };
      } catch (error) {
        fastify.log.error('Error updating practice details:', undefined, error);
        reply.status(500).send({ error: 'Failed to update practice details' });
      }
    },
  );

  // DELETE /api/practice/details/:organizationId
  fastify.delete(
    '/practice/details/:organizationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { organizationId } = request.params as { organizationId: string };
        const activeOrganizationId = request.activeOrganizationId;

        // Check if user can manage this organization
        if (activeOrganizationId !== organizationId) {
          return reply.status(403).send({
            error: 'Access denied to organization',
            code: 'ACCESS_DENIED',
          });
        }

        const deleted =
          await practiceService.deletePracticeDetails(organizationId);

        if (!deleted) {
          return reply
            .status(404)
            .send({ error: 'Practice details not found' });
        }

        return { message: 'Practice details deleted successfully' };
      } catch (error) {
        fastify.log.error('Error deleting practice details:', undefined, error);
        reply.status(500).send({ error: 'Failed to delete practice details' });
      }
    },
  );

  // GET /practice/details (uses active organization)
  fastify.get(
    '/practice/details',
    {
      schema: {
        summary: 'Get practice details',
        description: 'Retrieves practice details for the active organization',
        tags: ['Practice Management'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.userId;
        if (!userId) {
          return reply.status(401).send({ error: 'User not authenticated' });
        }

        const activeOrganizationId = request.activeOrganizationId;
        if (!activeOrganizationId) {
          return reply.status(400).send({
            error: 'No active organization found',
            code: 'NO_ACTIVE_ORGANIZATION',
            message: 'Please set an active organization first',
          });
        }

        const practiceDetails =
          await practiceService.getPracticeDetailsWithFallback(
            activeOrganizationId,
          );

        if (!practiceDetails) {
          return reply
            .status(404)
            .send({ error: 'Practice details not found' });
        }

        return { data: practiceDetails };
      } catch (error) {
        fastify.log.error('Error getting practice details:', undefined, error);
        reply.status(500).send({ error: 'Failed to get practice details' });
      }
    },
  );
});
