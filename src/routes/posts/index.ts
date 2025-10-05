import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

// Posts routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // GET /posts
  fastify.get(
    '/posts',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      return {
        posts: [
          { id: 1, title: 'Hello World', content: 'This is my first post' },
          {
            id: 2,
            title: 'Fastify Routes',
            content: 'File-based routing is awesome!',
          },
        ],
      };
    },
  );

  // POST /posts
  fastify.post(
    '/posts',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const body = request.body as { title: string; content: string };

      return {
        message: 'Post created successfully',
        post: {
          id: Math.floor(Math.random() * 1000),
          ...body,
        },
      };
    },
  );
});
