import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/shared/database';
import {
  stripeConnectedAccounts,
  ExternalAccounts,
} from '@/modules/onboarding/schemas/onboarding.schema';
import { publishSystemEvent } from '@/shared/events/event-publisher';
import { EventType } from '@/shared/events/enums/event-types';

/**
 * Handle account.external_account.created webhook event
 *
 * Stores external account information (bank accounts, cards) in the database
 * and publishes an ONBOARDING_EXTERNAL_ACCOUNT_CREATED event.
 * This is a pure function that doesn't depend on FastifyInstance.
 */
export const handleExternalAccountCreated = async (
  externalAccount: Stripe.ExternalAccount,
): Promise<void> => {
  try {
    const accountType =
      (externalAccount as Stripe.ExternalAccount & { type?: string }).type ||
      'unknown';
    console.log(
      `Processing external_account.created: ${externalAccount.id} (${accountType}) for account: ${externalAccount.account}`,
    );

    // Get current account record
    const account = await db
      .select()
      .from(stripeConnectedAccounts)
      .where(
        eq(
          stripeConnectedAccounts.stripeAccountId,
          externalAccount.account as string,
        ),
      )
      .limit(1);

    if (account.length === 0) {
      console.warn(
        `Account not found for external account creation: ${externalAccount.account}`,
      );
      return;
    }

    const currentAccount = account[0];

    // Update external accounts JSONB field
    const currentExternalAccounts =
      (currentAccount.externalAccounts as Record<string, unknown>) || {};
    const updatedExternalAccounts = {
      ...currentExternalAccounts,
      [externalAccount.id]: {
        id: externalAccount.id,
        type: accountType,
        status: externalAccount.status,
        metadata: externalAccount.metadata,
        // Store additional fields based on type
        ...(accountType === 'card' && {
          brand: (externalAccount as Stripe.Card).brand,
          last4: (externalAccount as Stripe.Card).last4,
          exp_month: (externalAccount as Stripe.Card).exp_month,
          exp_year: (externalAccount as Stripe.Card).exp_year,
        }),
        ...(accountType === 'bank_account' && {
          bank_name: (externalAccount as Stripe.BankAccount).bank_name,
          last4: (externalAccount as Stripe.BankAccount).last4,
          routing_number: (externalAccount as Stripe.BankAccount)
            .routing_number,
        }),
      },
    };

    // Update the account external accounts in the database
    await db
      .update(stripeConnectedAccounts)
      .set({
        externalAccounts:
          updatedExternalAccounts as unknown as ExternalAccounts,
        lastRefreshedAt: new Date(),
      })
      .where(
        eq(
          stripeConnectedAccounts.stripeAccountId,
          externalAccount.account as string,
        ),
      );

    // Publish external account created event
    await publishSystemEvent(
      EventType.ONBOARDING_EXTERNAL_ACCOUNT_CREATED,
      {
        stripeAccountId: externalAccount.account,
        organizationId: currentAccount.organizationId,
        externalAccountId: externalAccount.id,
        externalAccountType: accountType,
        externalAccountStatus: externalAccount.status,
        metadata: externalAccount.metadata,
        previousExternalAccounts: currentExternalAccounts,
        updatedAt: new Date().toISOString(),
      },
      'stripe-webhook',
      'webhook',
      currentAccount.organizationId,
    );

    console.log(
      `External account created and event published for: ${externalAccount.id}`,
    );
  } catch (error) {
    console.error(
      `Failed to create external account: ${externalAccount.id}`,
      error,
    );
    throw error;
  }
};
