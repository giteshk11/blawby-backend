import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import {
  stripeConnectedAccounts,
  type Requirements,
  type Capabilities,
  type CompanyInfo,
  type IndividualInfo,
  ExternalAccounts,
} from '@/modules/onboarding/schemas/onboarding.schema';
import { db } from '@/shared/database';
import { publishSystemEvent } from '@/shared/events/event-publisher';
import { EventType } from '@/shared/events/enums/event-types';

/**
 * Handle account.updated webhook event
 *
 * Updates the connected account record in the database with latest status
 * and publishes an ONBOARDING_ACCOUNT_UPDATED event.
 * This is a pure function that doesn't depend on FastifyInstance.
 */
export const handleAccountUpdated = async (
  account: Stripe.Account,
): Promise<void> => {
  try {
    // First, get the current account data to retrieve organizationId
    const existingAccount = await db
      .select()
      .from(stripeConnectedAccounts)
      .where(eq(stripeConnectedAccounts.stripeAccountId, account.id))
      .limit(1);

    if (!existingAccount.length) {
      console.error(`Account not found for Stripe ID: ${account.id}`);
      return;
    }

    const currentAccount = existingAccount[0];

    const updateData = {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      businessType: account.business_type,
      company: account.company as CompanyInfo,
      individual: account.individual as IndividualInfo,
      requirements: account.requirements as Requirements,
      capabilities: account.capabilities as Capabilities,
      externalAccounts: account.external_accounts as ExternalAccounts,
      metadata: account.metadata as Stripe.Metadata,
      lastRefreshedAt: new Date(),
    };

    // Update the account in the database
    await db
      .update(stripeConnectedAccounts)
      .set(updateData)
      .where(eq(stripeConnectedAccounts.stripeAccountId, account.id));

    // Publish account updated event
    await publishSystemEvent(
      EventType.ONBOARDING_ACCOUNT_UPDATED,
      {
        stripeAccountId: account.id,
        organizationId: currentAccount.organizationId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        businessType: account.business_type,
        requirements: account.requirements,
        capabilities: account.capabilities,
        previousChargesEnabled: currentAccount.chargesEnabled,
        previousPayoutsEnabled: currentAccount.payoutsEnabled,
        previousDetailsSubmitted: currentAccount.detailsSubmitted,
        updatedAt: new Date().toISOString(),
      },
      'stripe-webhook',
      'webhook',
      currentAccount.organizationId,
    );

    console.log(`Account updated and event published for: ${account.id}`);
  } catch (error) {
    console.error(`Failed to update account: ${account.id}`, error);
    throw error;
  }
};
