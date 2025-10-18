import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { getDb, getPool } from './connection';

/**
 * Database Plugin for Fastify
 *
 * This plugin decorates the Fastify instance with the shared database connection.
 * It uses the same connection as the independent database module.
 */
const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    fastify.log.error('DATABASE_URL not set');
    throw new Error('DATABASE_URL not set');
  }

  // Get the shared database connection (will initialize if not already done)
  const db = getDb();
  const pool = getPool();

  // Add error handlers for connection pool
  pool.on('error', (err) => {
    fastify.log.error({ err }, 'Database pool error');
  });

  pool.on('connect', (_client) => {
    fastify.log.debug('Database client connected');
  });

  pool.on('remove', (_client) => {
    fastify.log.debug('Database client removed from pool');
  });

  // Test connection
  try {
    await pool.query('SELECT 1');
    fastify.log.info('✅ Database connection OK');
  } catch (err) {
    fastify.log.error(
      'pg: connection failed — check DATABASE_URL and migrations',
    );
    await pool.end();
    throw err;
  }

  // Decorate Fastify instance with the shared connection
  fastify.decorate('pgPool', pool);
  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    try {
      fastify.log.info('Closing database connection pool...');
      await pool.end();
      fastify.log.info('Database connection pool closed');
    } catch (e) {
      fastify.log.error({ err: e }, 'Error closing database pool');
    }
  });
};

export default fp(dbPlugin);
