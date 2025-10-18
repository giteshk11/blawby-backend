import { eq, and } from 'drizzle-orm';
import { db } from '@/shared/database';
import {
  clients,
  type InsertClient,
  type SelectClient,
} from '@/modules/clients/database/schema/clients.schema';
import type { ClientAddress } from '@/modules/clients/database/schema/clients.schema';

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

    return results[0] ?? null;
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
          metadata: results[0].metadata,
          address: results[0].address as ClientAddress,
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
          metadata: results[0].metadata as JSON,
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
          metadata: results[0].metadata as JSON,
          address: results[0].address as ClientAddress,
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

    return results;
  },

  /**
   * Create a new client
   */
  async create(data: InsertClient): Promise<SelectClient> {
    const [result] = await db.insert(clients).values(data).returning();

    return result;
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
      })
      .where(eq(clients.id, id))
      .returning();

    return result ?? null;
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
        metadata: data.metadata as JSON,
        address: data.address as ClientAddress,
      })
      .where(eq(clients.stripeCustomerId, stripeCustomerId))
      .returning();

    return result
      ? {
          ...result,
          metadata: result.metadata as JSON,
          address: result.address as ClientAddress,
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
      metadata: result.metadata as JSON,
      address: result.address as ClientAddress,
    }));
  },
};

// Legacy export for backward compatibility during migration
export const customersRepository = clientsRepository;
