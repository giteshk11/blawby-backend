import type Stripe from 'stripe';
import { db } from '@/database';
import { stripeConnectedAccounts } from '@/modules/onboarding/schemas/onboarding.schema';
import { eq } from 'drizzle-orm';

export const handleCapabilityUpdated = async (
  event: Stripe.Event,
): Promise<void> => {
  const capability = event.data.object as Stripe.Capability;

  console.log(`Handling capability.updated for account: ${capability.account}`);

  try {
    // Ensure account is a string
    const accountId =
      typeof capability.account === 'string'
        ? capability.account
        : capability.account.id;

    // Get current capabilities
    const currentAccount = await db
      .select()
      .from(stripeConnectedAccounts)
      .where(eq(stripeConnectedAccounts.stripeAccountId, accountId))
      .limit(1);

    if (!currentAccount[0]) {
      throw new Error(`Connected account not found: ${accountId}`);
    }

    const currentCapabilities = currentAccount[0].capabilities || {};

    // Update the specific capability
    const updatedCapabilities = {
      ...currentCapabilities,
      [capability.id]: {
        status: capability.status,
        requirements: capability.requirements,
        requested_at: capability.requested_at,
        // Note: granted_at doesn't exist on Stripe.Capability type
      },
    };

    await db
      .update(stripeConnectedAccounts)
      .set({
        capabilities: updatedCapabilities,
        lastRefreshedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stripeConnectedAccounts.stripeAccountId, accountId));

    console.log(
      `Successfully updated capability ${capability.id} for account: ${accountId}`,
    );
  } catch (error) {
    console.error(`Failed to update capability ${capability.id}:`, error);
    throw error;
  }
};
