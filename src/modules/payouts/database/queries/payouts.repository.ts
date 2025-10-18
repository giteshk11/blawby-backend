import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/shared/database';
import {
  payouts,
  type InsertPayout,
  type SelectPayout,
} from '@/modules/payouts/database/schema/payouts.schema';

export const payoutsRepository = {
  /**
   * Find payout by ID
   */
  async findById(id: string): Promise<SelectPayout | null> {
    const results = await db
      .select()
      .from(payouts)
      .where(eq(payouts.id, id))
      .limit(1);

    return results[0] || null;
  },

  /**
   * Find payout by Stripe payout ID
   */
  async findByStripePayoutId(
    stripePayoutId: string,
  ): Promise<SelectPayout | null> {
    const results = await db
      .select()
      .from(payouts)
      .where(eq(payouts.stripePayoutId, stripePayoutId))
      .limit(1);

    return results[0] || null;
  },

  /**
   * List payouts by connected account
   */
  async listByConnectedAccountId(
    connectedAccountId: string,
    limit = 50,
    offset = 0,
  ): Promise<SelectPayout[]> {
    return await db
      .select()
      .from(payouts)
      .where(eq(payouts.connectedAccountId, connectedAccountId))
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * Create a new payout
   */
  async create(data: InsertPayout): Promise<SelectPayout> {
    const [result] = await db.insert(payouts).values(data).returning();

    return result;
  },

  /**
   * Update payout
   */
  async update(
    id: string,
    data: Partial<InsertPayout>,
  ): Promise<SelectPayout | null> {
    const [result] = await db
      .update(payouts)
      .set(data)
      .where(eq(payouts.id, id))
      .returning();

    return result || null;
  },

  /**
   * Update by Stripe payout ID
   */
  async updateByStripePayoutId(
    stripePayoutId: string,
    data: Partial<InsertPayout>,
  ): Promise<SelectPayout | null> {
    const [result] = await db
      .update(payouts)
      .set(data)
      .where(eq(payouts.stripePayoutId, stripePayoutId))
      .returning();

    return result || null;
  },

  /**
   * Delete payout
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(payouts).where(eq(payouts.id, id));

    return result?.rowCount ? result.rowCount > 0 : false;
  },

  /**
   * Get payouts by status
   */
  async listByStatus(
    status: string,
    limit = 50,
    offset = 0,
  ): Promise<SelectPayout[]> {
    return await db
      .select()
      .from(payouts)
      .where(
        eq(
          payouts.status,
          status as 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed',
        ),
      )
      .orderBy(desc(payouts.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /**
   * Get total payout amount for a connected account
   */
  async getTotalAmount(connectedAccountId: string): Promise<number> {
    const results = await db
      .select({ total: payouts.amount })
      .from(payouts)
      .where(
        and(
          eq(payouts.connectedAccountId, connectedAccountId),
          eq(
            payouts.status,
            'paid' as 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed',
          ),
        ),
      );

    return results.reduce((sum, row) => sum + row.total, 0);
  },

  /**
   * Get pending payouts
   */
  async getPendingPayouts(
    connectedAccountId?: string,
  ): Promise<SelectPayout[]> {
    const conditions = [
      eq(
        payouts.status,
        'pending' as 'paid' | 'pending' | 'in_transit' | 'canceled' | 'failed',
      ),
    ];

    if (connectedAccountId) {
      conditions.push(eq(payouts.connectedAccountId, connectedAccountId));
    }

    return await db
      .select()
      .from(payouts)
      .where(and(...conditions))
      .orderBy(payouts.createdAt);
  },

  /**
   * Get payouts summary for a connected account
   */
  async getPayoutsSummary(connectedAccountId: string): Promise<{
    totalPaid: number;
    totalPending: number;
    totalFailed: number;
    count: number;
  }> {
    const results = await db
      .select({
        status: payouts.status,
        amount: payouts.amount,
      })
      .from(payouts)
      .where(eq(payouts.connectedAccountId, connectedAccountId));

    const summary = {
      totalPaid: 0,
      totalPending: 0,
      totalFailed: 0,
      count: results.length,
    };

    for (const payout of results) {
      switch (payout.status) {
        case 'paid':
          summary.totalPaid += payout.amount;
          break;
        case 'pending':
        case 'in_transit':
          summary.totalPending += payout.amount;
          break;
        case 'failed':
        case 'canceled':
          summary.totalFailed += payout.amount;
          break;
      }
    }

    return summary;
  },
};
