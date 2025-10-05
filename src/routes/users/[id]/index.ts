import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

// User by ID routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // GET /users/:id
  fastify.get(
    '/users/:id',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      return {
        user: {
          id: parseInt(id),
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
    },
  );

  // PUT /users/:id
  fastify.put(
    '/users/:id',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { name?: string; email?: string };

      return {
        message: 'User updated successfully',
        user: {
          id: parseInt(id),
          ...body,
        },
      };
    },
  );

  // DELETE /users/:id
  fastify.delete(
    '/users/:id',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      return {
        message: `User ${id} deleted successfully`,
      };
    },
  );
});
