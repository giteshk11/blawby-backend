/**
 * Payment Setup Service
 *
 * Handles payment method collection for platform billing
 * Creates Stripe customers on platform account (not Connect)
 */

import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { organizations } from '@/schema/better-auth-schema';
import { db } from '@/database';

export interface CreatePlatformCustomerRequest {
  organizationId: string;
  email: string;
  name?: string;
}

export interface CreatePlatformCustomerResponse {
  success: boolean;
  customerId?: string;
  error?: string;
}

export interface CreateSetupIntentRequest {
  customerId: string;
  organizationId: string;
}

export interface CreateSetupIntentResponse {
  success: boolean;
  clientSecret?: string;
  error?: string;
}

export interface AttachPaymentMethodRequest {
  organizationId: string;
  paymentMethodId: string;
  customerId: string;
}

export interface AttachPaymentMethodResponse {
  success: boolean;
  error?: string;
}

/**
 * Create payment setup service
 */
export const createPaymentSetupService = function createPaymentSetupService(
  fastify: FastifyInstance,
): {
  createPlatformCustomer(
    request: CreatePlatformCustomerRequest,
  ): Promise<CreatePlatformCustomerResponse>;
  createSetupIntent(
    request: CreateSetupIntentRequest,
  ): Promise<CreateSetupIntentResponse>;
  attachPaymentMethod(
    request: AttachPaymentMethodRequest,
  ): Promise<AttachPaymentMethodResponse>;
  verifyPaymentMethod(organizationId: string): Promise<unknown>;
} {
  return {
    /**
     * Create Stripe customer on platform account for billing
     */
    async createPlatformCustomer(
      request: CreatePlatformCustomerRequest,
    ): Promise<CreatePlatformCustomerResponse> {
      try {
        // 1. Check if organization already has a platform customer
        const existingOrg = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, request.organizationId))
          .limit(1);

        if (existingOrg[0]?.stripeCustomerId) {
          return {
            success: true,
            customerId: existingOrg[0].stripeCustomerId,
          };
        }

        // 2. Create Stripe customer on platform account (not Connect)
        const stripeCustomer = await fastify.stripe.customers.create({
          email: request.email,
          name: request.name,
          metadata: {
            organizationId: request.organizationId,
            type: 'platform_billing',
          },
        });

        // 3. Update organization with platform customer ID
        await db
          .update(organizations)
          .set({
            stripeCustomerId: stripeCustomer.id,
            billingEmail: request.email,
          })
          .where(eq(organizations.id, request.organizationId));

        fastify.log.info(
          {
            organizationId: request.organizationId,
            customerId: stripeCustomer.id,
          },
          'Created platform customer for organization',
        );

        return {
          success: true,
          customerId: stripeCustomer.id,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId: request.organizationId,
          },
          'Failed to create platform customer',
        );

        return {
          success: false,
          error: 'Failed to create platform customer',
        };
      }
    },

    /**
     * Create setup intent for payment method collection
     */
    async createSetupIntent(
      request: CreateSetupIntentRequest,
    ): Promise<CreateSetupIntentResponse> {
      try {
        // 1. Verify organization has platform customer
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, request.organizationId))
          .limit(1);

        if (!org[0]?.stripeCustomerId) {
          return {
            success: false,
            error: 'Organization does not have a platform customer',
          };
        }

        // 2. Create setup intent on platform account
        const setupIntent = await fastify.stripe.setupIntents.create({
          customer: org[0].stripeCustomerId,
          payment_method_types: ['card'],
          usage: 'off_session', // For future payments
          metadata: {
            organizationId: request.organizationId,
            type: 'subscription_billing',
          },
        });

        fastify.log.info(
          {
            organizationId: request.organizationId,
            setupIntentId: setupIntent.id,
          },
          'Created setup intent for payment method collection',
        );

        return {
          success: true,
          clientSecret: setupIntent.client_secret!,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId: request.organizationId,
          },
          'Failed to create setup intent',
        );

        return {
          success: false,
          error: 'Failed to create setup intent',
        };
      }
    },

    /**
     * Attach payment method to customer and set as default
     */
    async attachPaymentMethod(
      request: AttachPaymentMethodRequest,
    ): Promise<AttachPaymentMethodResponse> {
      try {
        // 1. Attach payment method to customer
        await fastify.stripe.paymentMethods.attach(request.paymentMethodId, {
          customer: request.customerId,
        });

        // 2. Set as default payment method
        await fastify.stripe.customers.update(request.customerId, {
          invoice_settings: {
            default_payment_method: request.paymentMethodId,
          },
        });

        // 3. Update organization with payment method
        await db
          .update(organizations)
          .set({
            stripePaymentMethodId: request.paymentMethodId,
            paymentMethodSetupAt: new Date(),
          })
          .where(eq(organizations.id, request.organizationId));

        fastify.log.info(
          {
            organizationId: request.organizationId,
            paymentMethodId: request.paymentMethodId,
          },
          'Attached payment method to platform customer',
        );

        return {
          success: true,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId: request.organizationId,
            paymentMethodId: request.paymentMethodId,
          },
          'Failed to attach payment method',
        );

        return {
          success: false,
          error: 'Failed to attach payment method',
        };
      }
    },

    /**
     * Verify payment method is valid
     */
    async verifyPaymentMethod(paymentMethodId: string): Promise<boolean> {
      try {
        const paymentMethod =
          await fastify.stripe.paymentMethods.retrieve(paymentMethodId);
        return paymentMethod.type === 'card';
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            paymentMethodId,
          },
          'Failed to verify payment method',
        );
        return false;
      }
    },
  };
};
