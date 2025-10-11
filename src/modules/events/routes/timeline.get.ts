import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database';
import {
  events,
  eventTimelineQuerySchema,
} from '@/shared/events/schemas/events.schema';
import { eq, and, inArray } from 'drizzle-orm';
import { desc } from 'drizzle-orm';

// GET /api/events/timeline
export default async function getEventTimelineRoute(
  request: FastifyRequest<{
    Querystring: {
      userId?: string;
      organizationId?: string;
      eventTypes?: string[];
      limit?: number;
      offset?: number;
    };
  }>,
  reply: FastifyReply,
) {
  // Validate query parameters
  const query = eventTimelineQuerySchema.parse(request.query);

  try {
    // Build where conditions
    const conditions = [];

    if (query.userId) {
      conditions.push(eq(events.userId, query.userId));
    }

    if (query.organizationId) {
      conditions.push(eq(events.organizationId, query.organizationId));
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      conditions.push(inArray(events.eventType, query.eventTypes));
    }

    // Query events
    const eventList = await db
      .select({
        id: events.id,
        eventId: events.eventId,
        eventType: events.eventType,
        eventVersion: events.eventVersion,
        userId: events.userId,
        organizationId: events.organizationId,
        payload: events.payload,
        metadata: events.metadata,
        processed: events.processed,
        retryCount: events.retryCount,
        lastError: events.lastError,
        processedAt: events.processedAt,
        createdAt: events.createdAt,
      })
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(events.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    // Get total count for pagination
    const totalCount = await db
      .select({ count: events.id })
      .from(events)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return reply.send({
      events: eventList,
      pagination: {
        total: totalCount.length,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < totalCount.length,
      },
    });
  } catch (error) {
    request.server.log.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        query,
      },
      'Failed to get event timeline',
    );

    return reply.internalServerError('Failed to get event timeline');
  }
}
