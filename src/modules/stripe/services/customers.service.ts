import Stripe from 'stripe';
import type { FastifyInstance } from 'fastify';
import { getStripeCustomers } from '@/shared/services/stripe-client.service';
import {
  findByEmail,
  findByStripeId,
  createCustomer,
  updateCustomerByStripeId,
} from '@/modules/stripe/repositories/customers.repository';
import type {
  Customer,
  NewCustomer,
  CreateCustomerRequest,
  CreateCustomerResponse,
} from '@/modules/stripe/schemas/customers.schema';
import { sanitizeError } from '@/shared/utils/logging';

export const createOrGetCustomer = async (
  fastify: FastifyInstance,
  organizationId: string,
  customerData: CreateCustomerRequest,
): Promise<CreateCustomerResponse> => {
  try {
    fastify.log.info(
      {
        context: {
          service: 'StripeCustomerService',
          operation: 'createOrGetCustomer',
          organizationId,
          customerEmail: customerData.email,
          customerName: customerData.name,
        },
      },
      'Creating or getting Stripe customer',
    );

    // Check if customer exists by email
    let customer = await findByEmail(fastify.db, customerData.email);

    if (customer) {
      fastify.log.info(
        {
          context: {
            service: 'StripeCustomerService',
            operation: 'createOrGetCustomer',
            organizationId,
            customerId: customer.id,
            foundExisting: true,
          },
        },
        'Found existing customer',
      );

      return {
        customerId: customer.id,
        stripeCustomerId: customer.stripeCustomerId,
        email: customer.email,
        name: customer.name,
      };
    }

    // Create new Stripe customer
    const stripeCustomer = await getStripeCustomers().create({
      email: customerData.email,
      name: customerData.name,
      phone: customerData.phone,
      address: customerData.address,
      metadata: {
        organizationId,
        ...customerData.metadata,
      },
    });

    // Save to database
    const newCustomer: NewCustomer = {
      userId: null, // Optional
      organizationId,
      stripeCustomerId: stripeCustomer.id,
      email: stripeCustomer.email || customerData.email,
      name: stripeCustomer.name || customerData.name,
      phone: stripeCustomer.phone || customerData.phone,
      address: stripeCustomer.address as unknown,
      defaultPaymentMethodId:
        (stripeCustomer.invoice_settings?.default_payment_method as string) ||
        null,
      metadata: stripeCustomer.metadata as Record<string, unknown>,
    };

    customer = await createCustomer(fastify.db, newCustomer);

    fastify.log.info(
      {
        context: {
          service: 'StripeCustomerService',
          operation: 'createOrGetCustomer',
          organizationId,
          customerId: customer.id,
          stripeCustomerId: customer.stripeCustomerId,
          createdNew: true,
        },
      },
      'Created new Stripe customer',
    );

    return {
      customerId: customer.id,
      stripeCustomerId: customer.stripeCustomerId,
      email: customer.email,
      name: customer.name,
    };
  } catch (error) {
    fastify.log.error(
      {
        error: sanitizeError(error),
        context: {
          service: 'StripeCustomerService',
          operation: 'createOrGetCustomer',
          organizationId,
          customerEmail: customerData.email,
          customerName: customerData.name,
        },
      },
      'Failed to create or get Stripe customer',
    );

    throw error; // Re-throw so global handler also logs it
  }
};

export const getCustomer = async (
  fastify: FastifyInstance,
  customerId: string,
): Promise<Customer | null> => {
  return await findByEmail(fastify.db, customerId);
};

export const getCustomerByStripeId = async (
  fastify: FastifyInstance,
  stripeCustomerId: string,
): Promise<Customer | null> => {
  return await findByStripeId(fastify.db, stripeCustomerId);
};

export const updateCustomer = async (
  fastify: FastifyInstance,
  stripeCustomerId: string,
  customerData: Partial<CreateCustomerRequest>,
): Promise<Customer> => {
  // Update in Stripe
  const stripeCustomer = await getStripeCustomers().update(stripeCustomerId, {
    email: customerData.email,
    name: customerData.name,
    phone: customerData.phone,
    address: customerData.address,
    metadata: customerData.metadata,
  });

  // Update in database
  const updateData: Partial<NewCustomer> = {
    email: stripeCustomer.email || customerData.email,
    name: stripeCustomer.name || customerData.name,
    phone: stripeCustomer.phone || customerData.phone,
    address: stripeCustomer.address as unknown,
    defaultPaymentMethodId:
      (stripeCustomer.invoice_settings?.default_payment_method as string) ||
      null,
    metadata: stripeCustomer.metadata as Record<string, unknown>,
  };

  return await updateCustomerByStripeId(
    fastify.db,
    stripeCustomerId,
    updateData,
  );
};

export const handleCustomerCreated = async (
  fastify: FastifyInstance,
  stripeCustomerId: string,
  customerData: Stripe.Customer,
): Promise<void> => {
  // Check if customer already exists
  const existingCustomer = await findByStripeId(fastify.db, stripeCustomerId);

  if (existingCustomer) {
    fastify.log.info(`Customer already exists: ${stripeCustomerId}`);
    return;
  }

  // Create new customer record
  const newCustomer: NewCustomer = {
    userId: null,
    organizationId: customerData.metadata?.organizationId || null,
    stripeCustomerId: customerData.id,
    email: customerData.email || '',
    name: customerData.name,
    phone: customerData.phone,
    address: customerData.address as unknown,
    defaultPaymentMethodId:
      (customerData.invoice_settings?.default_payment_method as string) || null,
    metadata: customerData.metadata as Record<string, unknown>,
  };

  await createCustomer(fastify.db, newCustomer);
  fastify.log.info(`Created customer from webhook: ${stripeCustomerId}`);
};

export const handleCustomerUpdated = async (
  fastify: FastifyInstance,
  stripeCustomerId: string,
  customerData: Stripe.Customer,
): Promise<void> => {
  const customer = await findByStripeId(fastify.db, stripeCustomerId);

  if (!customer) {
    fastify.log.warn(`Customer not found for Stripe ID: ${stripeCustomerId}`);
    return;
  }

  // Update customer data
  const updateData: Partial<NewCustomer> = {
    email: customerData.email || customer.email,
    name: customerData.name,
    phone: customerData.phone,
    address: customerData.address as unknown,
    defaultPaymentMethodId:
      (customerData.invoice_settings?.default_payment_method as string) || null,
    metadata: customerData.metadata as Record<string, unknown>,
  };

  await updateCustomerByStripeId(fastify.db, stripeCustomerId, updateData);
  fastify.log.info(`Updated customer from webhook: ${stripeCustomerId}`);
};
