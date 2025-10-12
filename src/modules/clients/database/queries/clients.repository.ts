import { eq, and, type Json } from 'drizzle-orm';
import { db } from '@/database';
import {
  clients,
  type InsertClient,
  type SelectClient,
} from '@/modules/clients/database/schema/clients.schema';

export const clientsRepository = {
  /**
   * Find client by ID
   */
  async findById(id: string): Promise<SelectClient | null> {
    const results = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    return results[0]
      ? {
          ...results[0],
          metadata: results[0].metadata as Json,
          address: results[0].address as Json,
        }
      : null;
  },

  /**
   * Find client by Stripe customer ID
   */
  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<SelectClient | null> {
    const results = await db
      .select()
      .from(clients)
      .where(eq(clients.stripeCustomerId, stripeCustomerId))
      .limit(1);

    return results[0]
      ? {
          ...results[0],
          metadata: results[0].metadata as Json,
          address: results[0].address as Json,
        }
      : null;
  },

  /**
   * Find client by email
   */
  async findByEmail(email: string): Promise<SelectClient | null> {
    const results = await db
      .select()
      .from(clients)
      .where(eq(clients.email, email))
      .limit(1);

    return results[0]
      ? {
          ...results[0],
          metadata: results[0].metadata as Json,
          address: results[0].address as Json,
        }
      : null;
  },

  /**
   * Find client by user ID
   */
  async findByUserId(userId: string): Promise<SelectClient | null> {
    const results = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .limit(1);

    return results[0]
      ? {
          ...results[0],
          metadata: results[0].metadata as Json,
          address: results[0].address as Json,
        }
      : null;
  },

  /**
   * List clients by organization
   */
  async listByOrganizationId(organizationId: string): Promise<SelectClient[]> {
    const results = await db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, organizationId));

    return results.map((result) => ({
      ...result,
      metadata: result.metadata as Json,
      address: result.address as Json,
    }));
  },

  /**
   * Create a new client
   */
  async create(data: InsertClient): Promise<SelectClient> {
    const [result] = await db
      .insert(clients)
      .values({
        ...data,
        metadata: data.metadata as Json,
        address: data.address as Json,
      })
      .returning();

    return {
      ...result,
      metadata: result.metadata as Json,
      address: result.address as Json,
    };
  },

  /**
   * Update client
   */
  async update(
    id: string,
    data: Partial<InsertClient>,
  ): Promise<SelectClient | null> {
    const [result] = await db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date(),
        metadata: data.metadata as Json,
        address: data.address as Json,
      })
      .where(eq(clients.id, id))
      .returning();

    return result
      ? {
          ...result,
          metadata: result.metadata as Json,
          address: result.address as Json,
        }
      : null;
  },

  /**
   * Update by Stripe customer ID
   */
  async updateByStripeCustomerId(
    stripeCustomerId: string,
    data: Partial<InsertClient>,
  ): Promise<SelectClient | null> {
    const [result] = await db
      .update(clients)
      .set({
        ...data,
        updatedAt: new Date(),
        metadata: data.metadata as Json,
        address: data.address as Json,
      })
      .where(eq(clients.stripeCustomerId, stripeCustomerId))
      .returning();

    return result
      ? {
          ...result,
          metadata: result.metadata as Json,
          address: result.address as Json,
        }
      : null;
  },

  /**
   * Delete client
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));

    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Search clients by name or email
   */
  async search(
    query: string,
    organizationId?: string,
  ): Promise<SelectClient[]> {
    const conditions = [
      // Search by name or email (case-insensitive)
      // Note: This is a simplified search - in production you might want full-text search
    ];

    if (organizationId) {
      conditions.push(eq(clients.organizationId, organizationId));
    }

    const results = await db
      .select()
      .from(clients)
      .where(and(...conditions));

    return results.map((result) => ({
      ...result,
      metadata: result.metadata as Json,
      address: result.address as Json,
    }));
  },
};

// Legacy export for backward compatibility during migration
export const customersRepository = clientsRepository;
