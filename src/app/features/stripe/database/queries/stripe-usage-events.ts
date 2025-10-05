import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeUsageEvents } from '../schema';
import {
  insertStripeUsageEventSchema,
  type InsertStripeUsageEvent,
} from '../../types';

type CreateStripeUsageEvent = InsertStripeUsageEvent;
type UpdateStripeUsageEvent = Partial<CreateStripeUsageEvent>;

export class StripeUsageEventQueries {
  // Create a new usage event
  static async createUsageEvent(data: CreateStripeUsageEvent) {
    // Validate input data using Drizzle-generated schema
    const validatedData = insertStripeUsageEventSchema.parse(data);

    const [event] = await db
      .insert(stripeUsageEvents)
      .values(validatedData)
      .returning();
    return event;
  }

  // Get usage events by customer ID
  static async getUsageEventsByCustomerId(stripeCustomerId: string) {
    return await db
      .select()
      .from(stripeUsageEvents)
      .where(eq(stripeUsageEvents.stripeCustomerId, stripeCustomerId));
  }

  // Get usage events by subscription ID
  static async getUsageEventsBySubscriptionId(
    trackStripeSubscriptionId: string,
  ) {
    return await db
      .select()
      .from(stripeUsageEvents)
      .where(
        eq(
          stripeUsageEvents.trackStripeSubscriptionId,
          trackStripeSubscriptionId,
        ),
      );
  }

  // Get usage events by connected account ID
  static async getUsageEventsByConnectedAccountId(connectedAccountId: string) {
    return await db
      .select()
      .from(stripeUsageEvents)
      .where(eq(stripeUsageEvents.connectedAccountId, connectedAccountId));
  }

  // Get usage events by event name
  static async getUsageEventsByEventName(eventName: string) {
    return await db
      .select()
      .from(stripeUsageEvents)
      .where(eq(stripeUsageEvents.eventName, eventName));
  }

  // Update usage event
  static async updateUsageEvent(id: string, data: UpdateStripeUsageEvent) {
    // Validate input data using Drizzle-generated schema
    const validatedData = insertStripeUsageEventSchema.partial().parse(data);

    const [event] = await db
      .update(stripeUsageEvents)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(stripeUsageEvents.id, id))
      .returning();
    return event;
  }

  // Delete usage event
  static async deleteUsageEvent(id: string) {
    await db.delete(stripeUsageEvents).where(eq(stripeUsageEvents.id, id));
  }
}
