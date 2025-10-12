/**
 * Payouts Service
 *
 * Handles payout tracking and management
 */

import type { FastifyInstance } from 'fastify';
import { connectedAccountsRepository } from '@/modules/onboarding/database/queries/connected-accounts.repository';
import { payoutsRepository } from '../database/queries/payouts.repository';
import {
  calculatePayoutFees,
  getFeeConfig,
} from '@/shared/services/fees.service';

export interface GetPayoutsRequest {
  organizationId: string;
  limit?: number;
  offset?: number;
}

export interface GetPayoutsResponse {
  success: boolean;
  payouts?: any[];
  summary?: {
    totalPaid: number;
    totalPending: number;
    totalFailed: number;
    count: number;
  };
  error?: string;
}

export interface GetPayoutSummaryRequest {
  organizationId: string;
}

export interface GetPayoutSummaryResponse {
  success: boolean;
  summary?: {
    totalPaid: number;
    totalPending: number;
    totalFailed: number;
    count: number;
  };
  error?: string;
}

/**
 * Create payouts service
 */
export const createPayoutsService = function createPayoutsService(
  fastify: FastifyInstance,
) {
  return {
    /**
     * Get payouts for organization
     */
    async getPayouts(request: GetPayoutsRequest): Promise<GetPayoutsResponse> {
      try {
        // 1. Get connected account
        const connectedAccount =
          await connectedAccountsRepository.findByOrganizationId(
            request.organizationId,
          );
        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        // 2. Get payouts
        const payouts = await payoutsRepository.listByConnectedAccountId(
          connectedAccount.id,
          request.limit || 50,
          request.offset || 0,
        );

        // 3. Get summary
        const summary = await payoutsRepository.getPayoutsSummary(
          connectedAccount.id,
        );

        return {
          success: true,
          payouts,
          summary,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get payouts');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Get payout summary for organization
     */
    async getPayoutSummary(
      request: GetPayoutSummaryRequest,
    ): Promise<GetPayoutSummaryResponse> {
      try {
        // 1. Get connected account
        const connectedAccount =
          await connectedAccountsRepository.findByOrganizationId(
            request.organizationId,
          );
        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        // 2. Get summary
        const summary = await payoutsRepository.getPayoutsSummary(
          connectedAccount.id,
        );

        return {
          success: true,
          summary,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get payout summary');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Get payout by ID
     */
    async getPayout(
      payoutId: string,
      organizationId: string,
    ): Promise<{
      success: boolean;
      payout?: any;
      error?: string;
    }> {
      try {
        // 1. Get payout
        const payout = await payoutsRepository.findById(payoutId);
        if (!payout) {
          return {
            success: false,
            error: 'Payout not found',
          };
        }

        // 2. Verify organization owns this payout
        const connectedAccount = await connectedAccountsRepository.findById(
          payout.connectedAccountId,
        );
        if (
          !connectedAccount ||
          connectedAccount.organizationId !== organizationId
        ) {
          return {
            success: false,
            error: 'Unauthorized access to payout',
          };
        }

        return {
          success: true,
          payout,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get payout');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Get pending payouts
     */
    async getPendingPayouts(organizationId: string): Promise<{
      success: boolean;
      payouts?: any[];
      error?: string;
    }> {
      try {
        // 1. Get connected account
        const connectedAccount =
          await connectedAccountsRepository.findByOrganizationId(
            organizationId,
          );
        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        // 2. Get pending payouts
        const payouts = await payoutsRepository.getPendingPayouts(
          connectedAccount.id,
        );

        return {
          success: true,
          payouts,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get pending payouts');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    /**
     * Get payouts by status
     */
    async getPayoutsByStatus(
      organizationId: string,
      status: string,
      limit = 50,
      offset = 0,
    ): Promise<{
      success: boolean;
      payouts?: any[];
      error?: string;
    }> {
      try {
        // 1. Get connected account
        const connectedAccount =
          await connectedAccountsRepository.findByOrganizationId(
            organizationId,
          );
        if (!connectedAccount) {
          return {
            success: false,
            error: 'Organization does not have a connected Stripe account',
          };
        }

        // 2. Get payouts by status
        const payouts = await payoutsRepository.listByStatus(
          status,
          limit,
          offset,
        );

        // Filter by connected account
        const filteredPayouts = payouts.filter(
          (payout) => payout.connectedAccountId === connectedAccount.id,
        );

        return {
          success: true,
          payouts: filteredPayouts,
        };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get payouts by status');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };
};
