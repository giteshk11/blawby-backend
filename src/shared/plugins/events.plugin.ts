import fp from 'fastify-plugin';
import {
  publishEvent,
  createEventMetadata,
} from '@/shared/events/event-publisher';
import {
  subscribeToEvent,
  subscribeToAllEvents,
} from '@/shared/events/event-consumer';

declare module 'fastify' {
  interface FastifyInstance {
    events: {
      publish: typeof publishEvent;
      subscribe: typeof subscribeToEvent;
      subscribeToAll: typeof subscribeToAllEvents;
      createMetadata: typeof createEventMetadata;
    };
  }
}

export default fp(async (fastify) => {
  fastify.decorate('events', {
    publish: publishEvent,
    subscribe: subscribeToEvent,
    subscribeToAll: subscribeToAllEvents,
    createMetadata: createEventMetadata,
  });

  fastify.log.info('✅ Events plugin registered');
});
