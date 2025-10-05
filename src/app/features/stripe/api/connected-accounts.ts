import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import {
  getStripeClient,
  createAdvancedConnectedAccount,
  createAccountLink,
  createOnboardingSession,
  getOnboardingStatus,
} from 'features/stripe/services';
import {
  getConnectedAccountByStripeId,
  createConnectedAccount,
  updateConnectedAccount,
} from 'features/stripe/database/queries';
import { z } from 'zod';

const createConnectedAccountSchema = z.object({
  type: z.enum(['express', 'standard', 'custom']),
  country: z.string().min(2).max(2),
  email: z.string().email(),
  businessType: z.enum(['individual', 'company']).optional(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
});

// Stripe API routes plugin
export default fastifyPlugin(async (fastify: FastifyInstance) => {
  // POST /connected-accounts
  fastify.post(
    '/connected-accounts',
    {
      schema: {
        summary: 'Create a new Stripe connected account',
        description:
          "Creates a new Stripe connected account using blawby's advanced method",
        tags: ['Stripe Connected Accounts'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createConnectedAccountSchema.parse(request.body);

        // Create Stripe account using blawby's advanced method
        const stripeAccount = await createAdvancedConnectedAccount();

        // Save to database
        const account = await createConnectedAccount({
          stripeAccountId: stripeAccount.id,
          type: 'standard', // Standard account, not Express
          country: 'US', // Default from blawby method
          email: body.email,
          businessType: body.businessType,
          entityType: body.entityType,
          entityId: body.entityId,
          chargesEnabled: stripeAccount.charges_enabled || false,
          payoutsEnabled: stripeAccount.payouts_enabled || false,
          detailsSubmitted: stripeAccount.details_submitted || false,
        });

        return { data: account };
      } catch (error) {
        fastify.log.error({ error }, 'Error creating connected account');
        reply.status(500).send({ error: 'Failed to create connected account' });
      }
    },
  );

  // GET /connected-accounts/:accountId
  fastify.get(
    '/connected-accounts/:accountId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { accountId } = request.params as { accountId: string };

        // Get from database
        const account = await getConnectedAccountByStripeId(accountId);
        if (!account) {
          return reply
            .status(404)
            .send({ error: 'Connected account not found' });
        }

        // Get fresh data from Stripe
        const stripe = getStripeClient();
        const stripeAccount = await stripe.accounts.retrieve(accountId);

        // Update local data
        const updatedAccount = await updateConnectedAccount(account.id, {
          chargesEnabled: stripeAccount.charges_enabled || false,
          payoutsEnabled: stripeAccount.payouts_enabled || false,
          detailsSubmitted: stripeAccount.details_submitted || false,
          company: stripeAccount.company
            ? JSON.parse(JSON.stringify(stripeAccount.company))
            : null,
          individual: stripeAccount.individual
            ? JSON.parse(JSON.stringify(stripeAccount.individual))
            : null,
          requirements: stripeAccount.requirements
            ? JSON.parse(JSON.stringify(stripeAccount.requirements))
            : null,
          capabilities: stripeAccount.capabilities
            ? JSON.parse(JSON.stringify(stripeAccount.capabilities))
            : null,
        });

        return { data: updatedAccount };
      } catch (error) {
        fastify.log.error({ error }, 'Error getting connected account');
        reply.status(500).send({ error: 'Failed to get connected account' });
      }
    },
  );

  // POST /account-links
  fastify.post(
    '/account-links',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            accountId: z.string(),
            refreshUrl: z.string().url(),
            returnUrl: z.string().url(),
          })
          .parse(request.body);

        const accountLink = await createAccountLink(
          body.accountId,
          body.refreshUrl,
          body.returnUrl,
        );

        return { data: accountLink };
      } catch (error) {
        fastify.log.error({ error }, 'Error creating account link');
        reply.status(500).send({ error: 'Failed to create account link' });
      }
    },
  );

  // POST /connected-accounts/onboarding/start
  fastify.post(
    '/connected-accounts/onboarding/start',
    {
      schema: {
        summary: 'Start Stripe onboarding process',
        description:
          'Creates or retrieves a Stripe connected account and starts the onboarding process',
        tags: ['Stripe Connected Accounts'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            organizationId: z.string().min(1),
            organizationName: z.string().optional(),
            organizationEmail: z.string().email().optional(),
            country: z.string().min(2).max(2).optional(),
            refreshUrl: z.string().url().optional(),
            returnUrl: z.string().url().optional(),
          })
          .parse(request.body);

        const onboardingSession = await createOnboardingSession({
          organizationId: body.organizationId,
          organizationName: body.organizationName,
          organizationEmail: body.organizationEmail,
          country: body.country,
          refreshUrl: body.refreshUrl,
          returnUrl: body.returnUrl,
        });

        return { data: onboardingSession };
      } catch (error) {
        fastify.log.error({ error }, 'Error creating onboarding session');
        reply
          .status(500)
          .send({ error: 'Failed to create onboarding session' });
      }
    },
  );

  // GET /organizations/:organizationId/onboarding-status
  fastify.get(
    '/organizations/:organizationId/onboarding-status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { organizationId } = request.params as { organizationId: string };

        const status = await getOnboardingStatus(organizationId);

        return { data: status };
      } catch (error) {
        fastify.log.error({ error }, 'Error getting onboarding status');
        reply.status(500).send({ error: 'Failed to get onboarding status' });
      }
    },
  );
});
