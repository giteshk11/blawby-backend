// Require library to exit fastify process, gracefully (if possible)
import closeWithGrace from 'close-with-grace';
import * as dotenvx from '@dotenvx/dotenvx';
// Require the framework
import Fastify from 'fastify';
import { FastifyRequest } from 'fastify';
import app from './app';
import fs from 'fs';

// Directory where .env files usually live
const envDir = process.cwd();

// List all files in that directory
const files = fs.readdirSync(envDir);

// Regex to match .env files (e.g., .env, .env.local, .env.production)
const envRegex = /^\.env(\..+)?$/;

// Filter matching files
const envFiles = files.filter((file) => envRegex.test(file));

if (envFiles.length > 0) {
  console.log(`[Env check] ✅ Found env files: ${envFiles.join(', ')}`);
} else {
  console.log('[Env check] ⚠️ No .env files found');
}

// Load environment variables with dotenvx (supports template literals natively)
// --- Safely ignore missing .env files (prevents MISSING_ENV_FILE errors in Render)
try {
  // Option A: ask dotenvx to ignore missing files
  dotenvx.config({
    path: ['.env.local', '.env', 'env.staging'],
    ignore: ['MISSING_ENV_FILE'],
    // quiet: true, // uncomment if you want even less logging
  });
} catch (e) {
  // Fallback: don't let dotenvx crash the startup if something unexpected happens
  // (should be rare because of `ignore`, but this keeps startup robust)
  // eslint-disable-next-line no-console
  console.warn(
    'dotenvx failed to load (continuing with process.env):',
    (e as Error).message,
  );
}

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

// Logger configuration is handled by pino-pretty transport

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
// NOTE: Render sets PORT and expects host 0.0.0.0 — prefer that in cloud environments.
const port = Number(process.env.PORT ?? 3000);
const host = process.env.SERVER_HOSTNAME ?? '0.0.0.0';

void server.listen({ port, host });

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

  server.log.info(`Server listening on ${host}:${port}`);
});

export { server as app };
