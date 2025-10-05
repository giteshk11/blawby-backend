import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import {
  createPracticeSchema,
  updatePracticeSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} from 'features/practice/validation';

// Practice API routes plugin - Forwards organization requests to Better Auth
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // Helper function to forward requests to Better Auth
  const forwardToBetterAuth = async function forwardToBetterAuth(
    request: FastifyRequest,
    reply: FastifyReply,
    betterAuthPath: string,
    method: string = 'GET',
    body?: any,
  ) {
    try {
      const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/auth${betterAuthPath}`;

      // Forward headers (especially authorization)
      const headers: Record<string, string> = {};
      if (request.headers.authorization) {
        headers.authorization = request.headers.authorization;
      }
      if (request.headers['content-type']) {
        headers['content-type'] = request.headers['content-type'];
      }
      if (request.headers.cookie) {
        headers.cookie = request.headers.cookie;
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      if (method !== 'GET' && body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      const responseData = await response.text();

      // Forward the response status and body
      reply.status(response.status);

      try {
        const jsonData = JSON.parse(responseData);
        return jsonData;
      } catch {
        return responseData;
      }
    } catch (error) {
      fastify.log.error('Error forwarding to Better Auth:', undefined, error);
      reply
        .status(500)
        .send({ error: 'Failed to forward request to authentication service' });
    }
  };

  // POST /practice/create - Create a new practice (organization)
  fastify.post(
    '/practice/create',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createPracticeSchema.parse(request.body);
      return await forwardToBetterAuth(
        request,
        reply,
        '/organization/create',
        'POST',
        body,
      );
    },
  );

  // GET /practice/list - List user's practices (organizations)
  fastify.get(
    '/practice/list',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return await forwardToBetterAuth(request, reply, '/organization/list');
    },
  );

  // GET /practice/:id - Get practice details (organization)
  fastify.get(
    '/practice/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      return await forwardToBetterAuth(request, reply, `/organization/${id}`);
    },
  );

  // practice/:id - Update practice (organization)
  fastify.put(
    '/practice/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = updatePracticeSchema.parse(request.body);
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}`,
        'PUT',
        body,
      );
    },
  );

  // practice/:id - Delete practice (organization)
  fastify.delete(
    '/practice/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}`,
        'DELETE',
      );
    },
  );

  // practice/:id/member - Add member to practice (organization)
  fastify.post(
    '/practice/:id/member',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = addMemberSchema.parse(request.body);
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}/member`,
        'POST',
        body,
      );
    },
  );

  // practice/:id/member/:userId - Remove member from practice
  fastify.delete(
    '/practice/:id/member/:userId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}/member/${userId}`,
        'DELETE',
      );
    },
  );

  // practice/:id/member/:userId - Update member role in practice
  fastify.put(
    '/practice/:id/member/:userId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const body = updateMemberRoleSchema.parse(request.body);
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}/member/${userId}`,
        'PUT',
        body,
      );
    },
  );

  // practice/:id/members - List practice members
  fastify.get(
    '/practice/:id/members',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}/members`,
      );
    },
  );

  // practice/:id/switch - Switch active practice (organization)
  fastify.post(
    '/practice/:id/switch',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      return await forwardToBetterAuth(
        request,
        reply,
        `/organization/${id}/switch`,
        'POST',
      );
    },
  );

  // practice/active - Get active practice (organization)
  fastify.get(
    '/practice/active',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return await forwardToBetterAuth(request, reply, '/organization/active');
    },
  );
});
