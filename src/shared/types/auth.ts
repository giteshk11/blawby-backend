import { FastifyInstance } from 'fastify';

export type ExtendedSession = Awaited<
  ReturnType<FastifyInstance['betterAuth']['api']['getSession']>
> & {
  session: {
    activeOrganizationId?: string;
  };
};
