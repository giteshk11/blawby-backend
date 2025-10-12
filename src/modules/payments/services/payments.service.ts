/**
 * Payments Service
 *
 * Handles payment intent creation, confirmation, and processing
 * Implements direct payment functionality (payment intents)
 */

import type { FastifyInstance } from 'fastify';
import { stripeConnectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import { clientsRepository } from '@/modules/clients/database/queries/clients.repository';
import { paymentIntentsRepository } from '@/modules/payments/database/queries/payment-intents.repository';
import { calculateFees } from '@/shared/services/fees.service';
import type {
  InsertPaymentIntent,
  SelectPaymentIntent,
} from '@/modules/payments/database/schema/payment-intents.schema';
import type { Json } from 'drizzle-orm/pg-core';

export interface CreatePaymentIntentRequest {
  organizationId: string;
  customerId?: string;
  amount: number; // in cents
  currency?: string;
  applicationFeeAmount?: number; // in cents
  paymentMethodTypes?: string[];
  customerEmail?: string;
  customerName?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentIntentResponse {
  success: boolean;
  paymentIntent?: {
    id: string;
    stripePaymentIntentId: string;
    clientSecret: string;
    amount: number;
    status: string;
  };
  error?: string;
}

export interface ConfirmPaymentRequest {
  paymentIntentId: string;
  organizationId: string;
  paymentMethodId?: string;
}

export interface ConfirmPaymentResponse {
  success: boolean;
  paymentIntent?: {
    id: string;
    status: string;
    chargeId?: string;
  };
  error?: string;
}

/**
 * Create payments service
 */
export const createPaymentsService = function createPaymentsService(
  fastify: FastifyInstance,
): {
  createPaymentIntent(
    request: CreatePaymentIntentRequest,
  ): Promise<CreatePaymentIntentResponse>;
  confirmPayment(
    request: ConfirmPaymentRequest,
  ): Promise<ConfirmPaymentResponse>;
  getPaymentIntent(
    paymentIntentId: string,
    organizationId: string,
  ): Promise<unknown>;
  listPaymentIntents(organizationId: string, limit?: number): Promise<unknown>;
} {
  return {
    /**
     * Create a new payment intent
     */
    async createPaymentIntent(
      request: CreatePaymentIntentRequest,
    ): Promise<CreatePaymentIntentResponse> {
      try {
        // 1. Validate organization has connected account
        const connectedAccount =
          await stripeConnectedAccountsRepository.findByOrganizationId(
            request.organizationId,
          );

        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        // 2. Get client if provided
        let client = null;
        if (request.customerId) {
          client = await clientsRepository.findById(request.customerId);
          if (!client) {
            return {
              success: false,
              error: 'Client not found',
            };
          }
        }

        // 3. Calculate application fee if not provided
        let applicationFeeAmount = request.applicationFeeAmount;
        if (!applicationFeeAmount) {
          // Calculate default fee (e.g., 2.9% + $0.30)
          const stripeFee = calculateFees(request.amount, 'card', 'US');
          applicationFeeAmount = Math.round(stripeFee * 0.1); // 10% of Stripe fee
        }

        // 4. Create payment intent on Stripe (direct charges)
        const stripePaymentIntent = await fastify.stripe.paymentIntents.create(
          {
            amount: request.amount,
            currency: request.currency || 'usd',
            customer: client?.stripeCustomerId,
            application_fee_amount: applicationFeeAmount,
            payment_method_types: request.paymentMethodTypes || ['card'],
            description: request.description,
            metadata: {
              organizationId: request.organizationId,
              ...request.metadata,
            },
            receipt_email: request.customerEmail,
          },
          {
            stripeAccount: connectedAccount.stripeAccountId,
          },
        );

        // 5. Store payment intent in database
        const paymentIntentData: InsertPaymentIntent = {
          connectedAccountId: connectedAccount.id,
          customerId: client?.id,
          stripePaymentIntentId: stripePaymentIntent.id,
          amount: request.amount,
          currency: request.currency || 'usd',
          applicationFeeAmount,
          status: stripePaymentIntent.status,
          customerEmail: request.customerEmail,
          customerName: request.customerName,
          metadata: request.metadata as Json,
        };

        const paymentIntent =
          await paymentIntentsRepository.create(paymentIntentData);

        // 6. Publish event
        await fastify.events.publish({
          eventType: 'BILLING_PAYMENT_INTENT_CREATED',
          eventVersion: '1.0.0',
          actorId: request.organizationId,
          actorType: 'organization',
          organizationId: request.organizationId,
          payload: {
            paymentIntentId: paymentIntent.id,
            amount: request.amount,
            customerId: request.customerId,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        return {
          success: true,
          paymentIntent: {
            id: paymentIntent.id,
            stripePaymentIntentId: stripePaymentIntent.id,
            clientSecret: stripePaymentIntent.client_secret!,
            amount: request.amount,
            status: stripePaymentIntent.status,
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to create payment intent');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Confirm a payment intent
     */
    async confirmPayment(
      request: ConfirmPaymentRequest,
    ): Promise<ConfirmPaymentResponse> {
      try {
        // 1. Get payment intent
        const paymentIntent = await paymentIntentsRepository.findById(
          request.paymentIntentId,
        );
        if (!paymentIntent) {
          return {
            success: false,
            error: 'Payment intent not found',
          };
        }

        // 2. Verify organization owns this payment intent
        const connectedAccount =
          await stripeConnectedAccountsRepository.findById(
            paymentIntent.connectedAccountId,
          );
        if (
          !connectedAccount ||
          connectedAccount.organizationId !== request.organizationId
        ) {
          return {
            success: false,
            error: 'Unauthorized access to payment intent',
          };
        }

        // 3. Confirm payment intent on Stripe
        const stripePaymentIntent = await fastify.stripe.paymentIntents.confirm(
          paymentIntent.stripePaymentIntentId,
          {
            payment_method: request.paymentMethodId,
          },
          {
            stripeAccount: connectedAccount.stripeAccountId,
          },
        );

        // 4. Update payment intent status
        await paymentIntentsRepository.update(paymentIntent.id, {
          status: stripePaymentIntent.status,
          paymentMethodId: stripePaymentIntent.payment_method as string,
          stripeChargeId: stripePaymentIntent.latest_charge as string,
          succeededAt:
            stripePaymentIntent.status === 'succeeded' ? new Date() : undefined,
        });

        // 5. Publish event
        await fastify.events.publish({
          eventType: 'BILLING_PAYMENT_INTENT_CONFIRMED',
          eventVersion: '1.0.0',
          actorId: request.organizationId,
          actorType: 'organization',
          organizationId: request.organizationId,
          payload: {
            paymentIntentId: paymentIntent.id,
            status: stripePaymentIntent.status,
            amount: paymentIntent.amount,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        return {
          success: true,
          paymentIntent: {
            id: paymentIntent.id,
            status: stripePaymentIntent.status,
            chargeId: stripePaymentIntent.latest_charge as string,
          },
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to confirm payment intent');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Get payment intent
     */
    async getPaymentIntent(
      paymentIntentId: string,
      organizationId: string,
    ): Promise<{
      success: boolean;
      paymentIntent?: SelectPaymentIntent;
      error?: string;
    }> {
      try {
        const paymentIntent =
          await paymentIntentsRepository.findById(paymentIntentId);
        if (!paymentIntent) {
          return {
            success: false,
            error: 'Payment intent not found',
          };
        }

        // Verify organization owns this payment intent
        const connectedAccount =
          await stripeConnectedAccountsRepository.findById(
            paymentIntent.connectedAccountId,
          );
        if (
          !connectedAccount ||
          connectedAccount.organizationId !== organizationId
        ) {
          return {
            success: false,
            error: 'Unauthorized access to payment intent',
          };
        }

        return {
          success: true,
          paymentIntent,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get payment intent');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * List payment intents for organization
     */
    async listPaymentIntents(
      organizationId: string,
      limit = 50,
      offset = 0,
    ): Promise<{
      success: boolean;
      paymentIntents?: SelectPaymentIntent[];
      error?: string;
    }> {
      try {
        // Get connected account
        const connectedAccount =
          await stripeConnectedAccountsRepository.findByOrganizationId(
            organizationId,
          );
        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        const paymentIntents =
          await paymentIntentsRepository.listByConnectedAccountId(
            connectedAccount.id,
            limit,
            offset,
          );

        return {
          success: true,
          paymentIntents,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to list payment intents');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    // Commented out - not in interface
    /*
    async cancelPaymentIntent(
      paymentIntentId: string,
      organizationId: string,
    ): Promise<{
      success: boolean;
      error?: string;
    }> {
      try {
        // 1. Get payment intent
        const paymentIntent =
          await paymentIntentsRepository.findById(paymentIntentId);
        if (!paymentIntent) {
          return {
            success: false,
            error: 'Payment intent not found',
          };
        }

        // 2. Verify organization owns this payment intent
        const connectedAccount =
          await stripeConnectedAccountsRepository.findById(
            paymentIntent.connectedAccountId,
          );
        if (
          !connectedAccount ||
          connectedAccount.organizationId !== organizationId
        ) {
          return {
            success: false,
            error: 'Unauthorized access to payment intent',
          };
        }

        // 3. Cancel payment intent on Stripe
        await fastify.stripe.paymentIntents.cancel(
          paymentIntent.stripePaymentIntentId,
          {},
          {
            stripeAccount: connectedAccount.stripeAccountId,
          },
        );

        // 4. Update payment intent status
        await paymentIntentsRepository.update(paymentIntent.id, {
          status: 'canceled',
        });

        // 5. Publish event
        await fastify.events.publish({
          eventType: 'BILLING_PAYMENT_INTENT_CANCELED',
          eventVersion: '1.0.0',
          actorId: organizationId,
          actorType: 'organization',
          organizationId,
          payload: {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        return { success: true };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to cancel payment intent');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
    */
  };
};
