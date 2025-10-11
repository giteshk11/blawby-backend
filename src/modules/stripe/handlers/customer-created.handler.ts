import type Stripe from 'stripe';

export const handleCustomerCreated = async (
  event: Stripe.Event,
): Promise<void> => {
  const customer = event.data.object as Stripe.Customer;

  console.log(`Handling customer.created for customer: ${customer.id}`);

  try {
    // TODO: Implement customer creation logic
    // For now, just log the event
    console.log(`Customer created: ${customer.id}`, {
      email: customer.email,
      name: customer.name,
    });

    console.log(`Successfully processed customer.created: ${customer.id}`);
  } catch (error) {
    console.error(`Failed to process customer.created ${customer.id}:`, error);
    throw error;
  }
};
