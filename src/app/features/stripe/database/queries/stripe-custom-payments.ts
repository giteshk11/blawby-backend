import { eq } from 'drizzle-orm';
import { db } from '@/database';
import { stripeCustomPayments } from '../schema';
import {
  insertStripeCustomPaymentSchema,
  type InsertStripeCustomPayment,
} from '../../types';

type CreateStripeCustomPayment = InsertStripeCustomPayment;
type UpdateStripeCustomPayment = Partial<CreateStripeCustomPayment>;

export class StripeCustomPaymentQueries {
  // Create a new custom payment
  static async createCustomPayment(data: CreateStripeCustomPayment) {
    // Validate input data using Drizzle-generated schema
    const validatedData = insertStripeCustomPaymentSchema.parse(data);

    const [payment] = await db
      .insert(stripeCustomPayments)
      .values(validatedData)
      .returning();
    return payment;
  }

  // Get custom payment by payment intent ID
  static async getCustomPaymentByPaymentIntent(paymentIntentId: string) {
    const [payment] = await db
      .select()
      .from(stripeCustomPayments)
      .where(eq(stripeCustomPayments.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return payment;
  }

  // Get custom payments by team ID
  static async getCustomPaymentsByTeamId(teamId: string) {
    return await db
      .select()
      .from(stripeCustomPayments)
      .where(eq(stripeCustomPayments.teamId, teamId));
  }

  // Get custom payments by connected account ID
  static async getCustomPaymentsByConnectedAccountId(
    connectedAccountId: string,
  ) {
    return await db
      .select()
      .from(stripeCustomPayments)
      .where(eq(stripeCustomPayments.connectedAccountId, connectedAccountId));
  }

  // Get custom payments by status
  static async getCustomPaymentsByStatus(status: string) {
    return await db
      .select()
      .from(stripeCustomPayments)
      .where(eq(stripeCustomPayments.status, status));
  }

  // Update custom payment
  static async updateCustomPayment(
    id: string,
    data: UpdateStripeCustomPayment,
  ) {
    // Validate input data using Drizzle-generated schema
    const validatedData = insertStripeCustomPaymentSchema.partial().parse(data);

    const [payment] = await db
      .update(stripeCustomPayments)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(stripeCustomPayments.id, id))
      .returning();
    return payment;
  }

  // Delete custom payment
  static async deleteCustomPayment(id: string) {
    await db
      .delete(stripeCustomPayments)
      .where(eq(stripeCustomPayments.id, id));
  }
}
