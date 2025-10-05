import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripePayouts } from '../schema';
import { insertStripePayoutSchema, type InsertStripePayout } from '../../types';

type CreateStripePayout = InsertStripePayout;
type UpdateStripePayout = Partial<CreateStripePayout>;

export class StripePayoutQueries {
  // Create a new payout
  static async createPayout(data: CreateStripePayout) {
    // Validate input data using Drizzle-generated schema
    const validatedData = insertStripePayoutSchema.parse(data);

    const [payout] = await db
      .insert(stripePayouts)
      .values(validatedData)
      .returning();
    return payout;
  }

  // Get payout by Stripe payout ID
  static async getPayoutByStripeId(stripePayoutId: string) {
    const [payout] = await db
      .select()
      .from(stripePayouts)
      .where(eq(stripePayouts.stripePayoutId, stripePayoutId))
      .limit(1);
    return payout;
  }

  // Get payouts by team ID
  static async getPayoutsByTeamId(teamId: string) {
    return await db
      .select()
      .from(stripePayouts)
      .where(eq(stripePayouts.teamId, teamId));
  }

  // Get payouts by Stripe account ID
  static async getPayoutsByStripeAccountId(stripeAccountId: string) {
    return await db
      .select()
      .from(stripePayouts)
      .where(eq(stripePayouts.stripeAccountId, stripeAccountId));
  }

  // Update payout
  static async updatePayout(id: string, data: UpdateStripePayout) {
    // Validate input data using Drizzle-generated schema
    const validatedData = insertStripePayoutSchema.partial().parse(data);

    const [payout] = await db
      .update(stripePayouts)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(stripePayouts.id, id))
      .returning();
    return payout;
  }

  // Delete payout
  static async deletePayout(id: string) {
    await db.delete(stripePayouts).where(eq(stripePayouts.id, id));
  }
}
