import type Stripe from 'stripe';

export const handleCustomerUpdated = async (
  event: Stripe.Event,
): Promise<void> => {
  const customer = event.data.object as Stripe.Customer;

  console.log(`Handling customer.updated for customer: ${customer.id}`);

  try {
    // TODO: Implement customer update logic
    // For now, just log the event
    console.log(`Customer updated: ${customer.id}`, {
      email: customer.email,
      name: customer.name,
    });

    console.log(`Successfully processed customer.updated: ${customer.id}`);
  } catch (error) {
    console.error(`Failed to process customer.updated ${customer.id}:`, error);
    throw error;
  }
};
