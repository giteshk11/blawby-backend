// Require library to exit fastify process, gracefully (if possible)
import closeWithGrace from 'close-with-grace';
import * as dotenvx from '@dotenvx/dotenvx';
// Require the framework
import Fastify from 'fastify';
import { consola } from 'consola';
import { FastifyRequest } from 'fastify';
import app from './app';
import { initSwagger } from './swagger';

// Load environment variables with dotenvx (supports template literals natively)
dotenvx.config();

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Configure Consola for beautiful logging
consola.level = isProduction ? 3 : 4; // Error level in production, Info level in development

// Development optimizations
if (isDevelopment) {
  // Faster startup in development
  process.env.NODE_OPTIONS = '--max-old-space-size=4096';

  // Enable source maps for better debugging
  process.env.NODE_ENV = 'development';
}

// Custom logger using pino-pretty
const logger = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
  },
};

// Instantiate Fastify with optimized config
const server = Fastify({
  logger: isProduction ? true : logger,
  // Development optimizations
  ...(isDevelopment && {
    // Disable request logging in dev for performance
    disableRequestLogging: false,
    // Faster JSON parsing
    bodyLimit: 1048576, // 1MB
    // Enable compression in dev
    compression: true,
    // Faster serialization
    serializers: {
      req: (req: FastifyRequest) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
      }),
    },
  }),
});

// Add custom logging methods using Consola
server.decorate('consola', consola);

// Init Swagger first (before registering app with prefix)
void initSwagger(server);

// Register your application as a normal plugin with API prefix.
void server.register(app, { prefix: '/api' });

// Delay is the number of milliseconds for the graceful close to finish
const closeListeners = closeWithGrace({ delay: 500 }, async (opts: any) => {
  if (opts.err) {
    server.log.error(opts.err);
  }

  await server.close();
});

server.addHook('onClose', (_instance, done) => {
  closeListeners.uninstall();
  done();
});

// Start listening.
void server.listen({
  port: Number(process.env.PORT ?? 3000),
  host: process.env.SERVER_HOSTNAME ?? '127.0.0.1',
});

void server.ready((err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }

  server.log.info(
    'All routes loaded! Check your console for the route details.',
  );

  // Just for debugging purposes
  for (const route of server.printRoutes().split('\n')) {
    server.log.info(route);
  }

  server.log.info(
    `Server listening on port ${Number(process.env.PORT ?? 3000)}`,
  );
});

export { server as app };
