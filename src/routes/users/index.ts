import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

// Users routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // GET /users
  fastify.get(
    '/users',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      return {
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com' },
          { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
        ],
      };
    },
  );

  // POST /users
  fastify.post(
    '/users',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = request.body as { name: string; email: string };

      return {
        message: 'User created successfully',
        user: {
          id: Math.floor(Math.random() * 1000),
          ...body,
        },
      };
    },
  );
});
