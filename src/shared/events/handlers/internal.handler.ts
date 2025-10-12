import { subscribeToEvent } from '@/shared/events/event-consumer';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { EventType } from '@/shared/events/enums/event-types';

// Mock Slack service - replace with actual Slack integration
const notifySlack = async (params: {
  channel: string;
  text: string;
  fields?: Record<string, string>;
}): void => {
  console.log(`💬 Slack notification to ${params.channel}: ${params.text}`);
  // TODO: Implement actual Slack webhook integration
};

export const registerInternalHandlers = (): void => {
  // Notify team on new signups
  subscribeToEvent(EventType.AUTH_USER_SIGNED_UP, async (event: BaseEvent) => {
    await notifySlack({
      channel: '#signups',
      text: `🎉 New user signed up: ${event.payload.email}`,
      fields: {
        'Signup Method': event.payload.signupMethod || 'email',
        'Referral Source': event.payload.referralSource || 'organic',
        'User ID': event.actorId || 'unknown',
      },
    });
  });

  // Alert on failed payments
  subscribeToEvent(EventType.PAYMENT_FAILED, async (event: BaseEvent) => {
    await notifySlack({
      channel: '#alerts',
      text: `⚠️ Payment failed for organization ${event.organizationId}`,
      fields: {
        Amount: `$${(event.payload.amount / 100).toFixed(2)}`,
        Error: event.payload.error || 'Unknown error',
        Customer: event.payload.customerEmail || 'Unknown',
      },
    });
  });

  // Notify on practice creation
  subscribeToEvent(EventType.PRACTICE_CREATED, async (event: BaseEvent) => {
    await notifySlack({
      channel: '#organizations',
      text: `🏢 New organization created: ${event.payload.organizationName}`,
      fields: {
        'Organization ID': event.organizationId || 'unknown',
        Owner: event.actorId || 'unknown',
        'Practice Type': event.payload.practiceType || 'unknown',
      },
    });
  });

  // Alert on onboarding completion
  subscribeToEvent(EventType.ONBOARDING_COMPLETED, async (event: BaseEvent) => {
    await notifySlack({
      channel: '#onboarding',
      text: `✅ Stripe onboarding completed for ${event.organizationId}`,
      fields: {
        'Account ID': event.payload.stripeAccountId || 'unknown',
        'Charges Enabled': event.payload.chargesEnabled ? 'Yes' : 'No',
        'Payouts Enabled': event.payload.payoutsEnabled ? 'Yes' : 'No',
      },
    });
  });

  // Alert on system errors
  subscribeToEvent(
    EventType.SYSTEM_ERROR_OCCURRED,
    async (event: BaseEvent) => {
      await notifySlack({
        channel: '#alerts',
        text: `🚨 System error occurred`,
        fields: {
          Error: event.payload.error || 'Unknown error',
          Component: event.payload.component || 'unknown',
          User: event.actorId || 'system',
          Timestamp: event.timestamp.toISOString(),
        },
      });
    },
  );

  // Notify on high-value payments
  subscribeToEvent(
    EventType.BILLING_PAYMENT_RECEIVED,
    async (event: BaseEvent) => {
      const amount = event.payload.amount || 0;
      const amountInDollars = amount / 100;

      // Only notify for payments over $1000
      if (amountInDollars >= 1000) {
        await notifySlack({
          channel: '#high-value-payments',
          text: `💰 High-value payment received: $${amountInDollars.toFixed(2)}`,
          fields: {
            Organization: event.organizationId || 'unknown',
            Customer: event.payload.customerEmail || 'unknown',
            Currency: event.payload.currency || 'usd',
            'Payment ID': event.payload.paymentIntentId || 'unknown',
          },
        });
      }
    },
  );
};
