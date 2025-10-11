import { subscribeToEvent } from '@/shared/events/event-consumer';
import type { BaseEvent } from '@/shared/events/schemas/events.schema';
import { EventType } from '@/shared/events/enums/event-types';

// Mock email service - replace with actual email service
const sendEmail = async (params: {
  to: string;
  subject: string;
  template: string;
  data?: Record<string, any>;
}) => {
  console.log(`📧 Email sent: ${params.subject} to ${params.to}`);
  // TODO: Implement actual email sending logic
};

// Mock user service - replace with actual user service
const getUser = async (_userId: string) => {
  // TODO: Implement actual user lookup
  return { onboardingCompleted: false };
};

export const registerEmailHandlers = () => {
  // Welcome email on signup
  subscribeToEvent(EventType.AUTH_USER_SIGNED_UP, async (event: BaseEvent) => {
    const { email, name } = event.payload;

    await sendEmail({
      to: email,
      subject: 'Welcome to Blawby!',
      template: 'welcome',
      data: { name },
    });
  });

  // Onboarding reminder
  subscribeToEvent(
    EventType.BILLING_ONBOARDING_STARTED,
    async (event: BaseEvent) => {
      // Schedule reminder email in 24h if not completed
      const { userId, email } = event.payload;

      setTimeout(
        async () => {
          const user = await getUser(userId);
          if (!user.onboardingCompleted) {
            await sendEmail({
              to: email,
              subject: 'Complete your Blawby setup',
              template: 'onboarding-reminder',
            });
          }
        },
        24 * 60 * 60 * 1000,
      ); // 24 hours
    },
  );

  // Payment receipt
  subscribeToEvent(
    EventType.BILLING_PAYMENT_RECEIVED,
    async (event: BaseEvent) => {
      const { customerEmail, amount, currency } = event.payload;

      await sendEmail({
        to: customerEmail,
        subject: 'Payment Receipt',
        template: 'payment-receipt',
        data: { amount, currency },
      });
    },
  );

  // Practice created notification
  subscribeToEvent(EventType.PRACTICE_CREATED, async (event: BaseEvent) => {
    const { organizationName, userEmail } = event.payload;

    await sendEmail({
      to: userEmail,
      subject: `Welcome to ${organizationName}!`,
      template: 'organization-welcome',
      data: { organizationName },
    });
  });

  // Billing onboarding completed
  subscribeToEvent(
    EventType.BILLING_ONBOARDING_COMPLETED,
    async (event: BaseEvent) => {
      const { userEmail, organizationName } = event.payload;

      await sendEmail({
        to: userEmail,
        subject: 'Payment setup completed!',
        template: 'billing-onboarding-complete',
        data: { organizationName },
      });
    },
  );
};
