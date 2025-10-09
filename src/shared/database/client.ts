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

  // fail fast so startup errors are obvious
  try {
    await pool.query('SELECT 1');
    fastify.log.info('pg: connection OK');
  } catch (err) {
    fastify.log.error(
      { err },
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
      await pool.end();
    } catch (e) {
      fastify.log.error(e);
    }
  });
};

export default fp(dbPlugin);
