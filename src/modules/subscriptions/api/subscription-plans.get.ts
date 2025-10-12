import { FastifyRequest, FastifyReply } from 'fastify';
import { subscriptionPlans } from '../database/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get available subscription plans
 * GET /api/subscription-plans
 */
export default async function getSubscriptionPlansRoute(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  try {
    // Get all active, public plans ordered by sort order
    const plans = await request.server.db.query.subscriptionPlans.findMany({
      where: and(
        eq(subscriptionPlans.isActive, true),
        eq(subscriptionPlans.isPublic, true),
      ),
      orderBy: (subscriptionPlans, { asc }) => [
        asc(subscriptionPlans.sortOrder),
      ],
    });

    return reply.send({
      success: true,
      data: plans,
    });
  } catch (error) {
    request.server.logError(error, request);
    return reply.internalServerError('Failed to get subscription plans');
  }
}
