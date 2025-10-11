import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  RouteOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import { join } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { RouteConfig } from '../types/route-config';
import { requireRoles } from '../middleware/roles';

// HTTP methods that can be used in filenames
const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

interface RouteModule {
  default: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<FastifyReply>;
  config?: {
    schema?: RouteOptions['schema'];
    config?: RouteOptions['config'];
  };
}

/**
 * Convert file path to URL path
 * Examples:
 *   index.get.ts -> /
 *   [id].get.ts -> /:id
 *   users/[id].get.ts -> /users/:id
 *   users/[id]/posts/[postId].get.ts -> /users/:id/posts/:postId
 */
function filePathToUrlPath(filePath: string): string {
  return (
    filePath
      // Remove file extension and method
      .replace(new RegExp(`\\.(${HTTP_METHODS.join('|')})\\.(ts|js)$`), '')
      // Convert [param] to :param
      .replace(/\[(\w+)\]/g, ':$1')
      // Convert index to empty string (root)
      .replace(/^index$/, '')
      // Convert /index to /
      .replace(/\/index$/, '')
      // Ensure it starts with /
      .replace(/^([^/])/, '/$1')
      // Handle root index - don't add trailing slash for root
      .replace(/^\/$/, '')
  );
}

/**
 * Extract HTTP method from filename
 */
function extractMethod(filename: string): HttpMethod | null {
  const match = filename.match(
    new RegExp(`\\.(${HTTP_METHODS.join('|')})\\.(ts|js)$`),
  );
  return match ? (match[1] as HttpMethod) : null;
}

/**
 * Load route config for a module
 */
async function loadRouteConfig(modulePath: string): Promise<RouteConfig> {
  try {
    const configPath = join(modulePath, 'routes.config.ts');
    if (existsSync(configPath)) {
      const configModule = await import(configPath);
      return configModule.routeConfig || { protected: true };
    }
  } catch {
    // Config file doesn't exist or has errors, use default
  }

  // Default: all routes protected
  return { protected: true };
}

/**
 * Check if a route should be public based on config
 */
function isRoutePublic(
  method: string,
  path: string,
  config: RouteConfig,
): boolean {
  const routePattern = `${method.toUpperCase()} ${path}`;

  // If default is public, check if route is explicitly protected
  if (config.protected === false) {
    return (
      !config.private?.includes(routePattern) && !config.private?.includes(path)
    );
  }

  // If default is protected, check if route is explicitly public
  return (
    config.public?.includes(routePattern) ||
    config.public?.includes(path) ||
    false
  );
}

/**
 * Register all file-based routes from modules directory
 */
export async function registerFileRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  const modulesDir = join(process.cwd(), 'src/modules');

  fastify.log.info('🚀 Starting file-based route registration...');
  fastify.log.info(`📁 Modules directory: ${modulesDir}`);

  // Check if modules directory exists
  if (!existsSync(modulesDir)) {
    fastify.log.warn(
      'Modules directory not found. Skipping file-based route registration.',
    );
    return;
  }

  // Find all route files manually
  const files: string[] = [];

  function findRouteFiles(dir: string, basePath: string = ''): void {
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = join(dir, item);
      const relativePath = basePath ? `${basePath}/${item}` : item;

      if (statSync(fullPath).isDirectory()) {
        findRouteFiles(fullPath, relativePath);
      } else if (
        item.match(new RegExp(`\\.(${HTTP_METHODS.join('|')})\\.ts$`))
      ) {
        files.push(relativePath);
      }
    }
  }

  findRouteFiles(modulesDir);

  fastify.log.info({ files }, `📁 Found ${files.length} route files:`);

  // Group files by module for config loading
  const filesByModule = new Map<string, string[]>();
  for (const file of files) {
    const moduleName = file.split('/')[0];
    if (!filesByModule.has(moduleName)) {
      filesByModule.set(moduleName, []);
    }
    filesByModule.get(moduleName)!.push(file);
  }

  for (const [moduleName, moduleFiles] of filesByModule) {
    // Load route config for this module
    const modulePath = join(modulesDir, moduleName);
    const routeConfig = await loadRouteConfig(modulePath);

    fastify.log.info({ routeConfig }, `📋 Module ${moduleName} config:`);

    for (const file of moduleFiles) {
      try {
        // Extract method from filename
        const method = extractMethod(file);
        if (!method) {
          fastify.log.warn(`Skipping invalid route file: ${file}`);
          continue;
        }

        // Import the route module
        const modulePath = join(modulesDir, file);
        const routeModule: RouteModule = await import(modulePath);

        if (!routeModule.default || typeof routeModule.default !== 'function') {
          fastify.log.warn(
            `Route file ${file} does not export a default function`,
          );
          continue;
        }

        // Convert file path to URL path (remove module name from path)
        const relativePath = file.substring(
          moduleName.length + '/routes/'.length,
        );
        const urlPath = filePathToUrlPath(relativePath);

        // Build full URL with module prefix (no /api prefix as server adds it)
        const fullUrl = `/${moduleName}${urlPath}`;

        // Check if route should be public
        const isPublic = isRoutePublic(method, urlPath, routeConfig);

        fastify.log.info(
          `🔗 Processing route: ${file} -> ${fullUrl} (${method.toUpperCase()}) ${isPublic ? '[PUBLIC]' : '[PROTECTED]'}`,
        );

        // Build pre-handlers
        const preHandlers = [];

        // Add auth if not public
        if (!isPublic) {
          preHandlers.push(fastify.verifyAuth);
        }

        // Add role-based middleware if specified
        const routePattern = `${method.toUpperCase()} ${urlPath}`;
        if (routeConfig.roles?.[routePattern] || routeConfig.roles?.[urlPath]) {
          const roles =
            routeConfig.roles[routePattern] || routeConfig.roles[urlPath];
          preHandlers.push(requireRoles(roles));
        }

        // Register route
        try {
          fastify.route({
            method: method.toUpperCase() as HttpMethod,
            url: fullUrl,
            preHandler: preHandlers.length > 0 ? preHandlers : undefined,
            schema: routeModule.config?.schema, // Optional schema from config
            config: routeModule.config?.config, // Pass through other config options
            handler: routeModule.default,
          });

          fastify.log.info(
            `✅ Registered: ${method.toUpperCase().padEnd(6)} ${fullUrl}`,
          );
        } catch (error) {
          fastify.log.error({ error }, `Failed to register route ${fullUrl}`);
        }
      } catch (error) {
        fastify.log.error({ error }, `Failed to register route ${file}`);
      }
    }
  }

  fastify.log.info('🎉 File-based route registration complete');
}

/**
 * Fastify plugin for file-based routing
 */
const fileRouterPlugin: FastifyPluginAsync = async (fastify) => {
  await registerFileRoutes(fastify);
};

export default fp(fileRouterPlugin);
