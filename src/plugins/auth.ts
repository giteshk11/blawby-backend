import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { auth } from '../auth';

/**
 * Generate Better Auth compatible error messages
 */
const createBetterAuthErrorMessage = function createBetterAuthErrorMessage(
  status: number,
  path: string,
): string {
  switch (status) {
    case 400:
      return 'Bad Request - Invalid authentication data provided';
    case 401:
      return 'Unauthorized - Authentication required or invalid credentials';
    case 403:
      return 'Forbidden - Insufficient permissions for this action';
    case 404:
      if (path.includes('/organization/')) {
        return 'Organization endpoint not found - Check if organization plugin is properly configured';
      }
      return 'Authentication endpoint not found - Check the API path';
    case 409:
      return 'Conflict - Resource already exists (e.g., user already registered)';
    case 422:
      return 'Validation Error - Invalid input data provided';
    case 429:
      return 'Too Many Requests - Rate limit exceeded';
    case 500:
      return 'Internal Server Error - Authentication service error';
    default:
      return `Authentication error (${status}) - ${path}`;
  }
};

/**
 * Better Auth Fastify Plugin
 * Official integration following Better Auth documentation
 */
async function authPlugin(fastify: FastifyInstance) {
  // Log that the auth plugin is loading
  fastify.log.info('🔐 [AuthPlugin] Loading Better Auth plugin...');

  // Register Better Auth authentication handler
  fastify.route({
    method: ['GET', 'POST'],
    url: '/auth/*',
    async handler(request: FastifyRequest, reply: FastifyReply) {
      try {
        fastify.log.info(
          `🔐 [AuthPlugin] Handling ${request.method} ${request.url}`,
        );

        // Construct request URL
        const url = new URL(request.url, `http://${request.headers.host}`);

        // Convert Fastify headers to standard Headers object
        const headers = new Headers();
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) headers.append(key, value.toString());
        });

        // Create Fetch API-compatible request
        const requestOptions: RequestInit = {
          method: request.method,
          headers,
        };

        // Only add body for POST requests
        if (request.method === 'POST' && request.body) {
          requestOptions.body = JSON.stringify(request.body);
        }

        const req = new Request(url.toString(), requestOptions);

        // Process authentication request - let Better Auth handle everything
        const response = await auth.handler(req);

        // Forward response to client exactly as Better Auth returns it
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));

        // Forward the response body as-is (Better Auth handles error messages)
        const responseBody = response.body ? await response.text() : undefined;

        // Send the response body directly (Better Auth's onAPIError handles formatting)
        if (responseBody) {
          reply.send(responseBody);
        } else if (response.status >= 400) {
          // Fallback for errors without body (shouldn't happen with onAPIError configured)
          const errorMessage = createBetterAuthErrorMessage(
            response.status,
            request.url,
          );

          const error = new Error(errorMessage) as Error & {
            statusCode: number;
          };
          error.statusCode = response.status;
          throw error;
        } else {
          reply.send();
        }
      } catch (error) {
        console.error('🔐 [AuthPlugin] Error:', error);
        reply.internalServerError(
          'Internal authentication error - ' +
            (error instanceof Error ? error.message : 'Unknown error'),
        );
      }
    },
  });
}

export default fastifyPlugin(authPlugin);
