// src/plugins/db.ts
import fp from 'fastify-plugin';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { FastifyPluginAsync } from 'fastify';

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    fastify.log.error('DATABASE_URL not set');
    throw new Error('DATABASE_URL not set');
  }

  const pool = new Pool({
    connectionString: cs,
    max: Number(process.env.PG_MAX_CLIENTS ?? 10),
  });

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

  // fail fast so startup errors are obvious
  try {
    await pool.query('SELECT 1');
    fastify.log.info('pg: connection OK');
  } catch (err) {
    fastify.log.error(
      'pg: connection failed — check DATABASE_URL and migrations',
    );
    await pool.end();
    throw err;
  }

  const db = drizzle(pool); // optionally pass schema if you use that form

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
