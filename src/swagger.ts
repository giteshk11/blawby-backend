import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0' as const,
  info: {
    title: 'Blawby API',
    version: '1.0.0',
    description: 'Blawby Law Practice Management API with Stripe integration',
    contact: {
      name: 'Blawby Support',
      email: 'support@blawby.com',
    },
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT ?? 3000}/api`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer' as const,
        bearerFormat: 'JWT',
      },
    },
  },
};

export async function initSwagger(app: FastifyInstance) {
  // Register Swagger with automatic route discovery
  await app.register(fastifySwagger, {
    openapi: swaggerDefinition,
    hideUntagged: false, // Show all routes, even without tags
    transform: ({ schema, url }) => {
      // Auto-generate tags from URL path for all routes
      const pathSegments = url.split('/').filter(Boolean);
      const tag = pathSegments[0] || 'General';

      // Hide Better Auth routes from Swagger documentation
      if (url.includes('/auth/')) {
        return { schema, url, hide: true }; // Hide Better Auth routes from Swagger
      }

      return {
        schema: {
          ...schema,
          tags: schema?.tags || [tag],
          summary: schema?.summary || `Endpoint for ${url}`,
          description: schema?.description || `API endpoint for ${url}`,
        },
        url,
      };
    },
  });

  // Register Swagger UI
  await app.register(fastifySwaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Write to generated swagger file on development
  if (process.env.NODE_ENV !== 'production') {
    app.ready(() => {
      const swaggerSpec = app.swagger();
      writeFileSync(
        join(__dirname, 'generated', 'swagger.json'),
        JSON.stringify(swaggerSpec, null, 2),
      );
      console.log('📖 Swagger documentation generated automatically!');
    });
  }
}
