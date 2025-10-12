/**
 * Clients Service
 *
 * Handles client management operations (organization's external clients)
 */

import type { FastifyInstance } from 'fastify';
import { clientsRepository } from '../database/queries/clients.repository';
import type { SelectClient } from '../database/schema/clients.schema';

export interface CreateClientRequest {
  organizationId: string;
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface CreateClientResponse {
  success: boolean;
  client?: SelectClient;
  error?: string;
}

export interface UpdateClientRequest {
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface UpdateClientResponse {
  success: boolean;
  client?: SelectClient;
  error?: string;
}

/**
 * Create clients service
 */
export const createClientsService = function createClientsService(
  fastify: FastifyInstance,
): {
  createClient(request: CreateClientRequest): Promise<CreateClientResponse>;
  getClient(clientId: string, organizationId: string): Promise<unknown>;
  listClients(organizationId: string): Promise<unknown>;
  updateClient(
    clientId: string,
    organizationId: string,
    request: UpdateClientRequest,
  ): Promise<UpdateClientResponse>;
  deleteClient(clientId: string, organizationId: string): Promise<unknown>;
} {
  return {
    /**
     * Create a new client
     */
    async createClient(
      request: CreateClientRequest,
    ): Promise<CreateClientResponse> {
      try {
        // 1. Check if client already exists by email
        const existingClient = await clientsRepository.findByEmail(
          request.email,
        );

        if (existingClient) {
          return {
            success: false,
            error: 'Client with this email already exists',
          };
        }

        // 2. Create Stripe customer
        const stripeCustomer = await fastify.stripe.customers.create({
          email: request.email,
          name: request.name,
          phone: request.phone,
          address: request.address,
          metadata: {
            organizationId: request.organizationId,
            type: 'client',
            ...request.metadata,
          },
        });

        // 3. Create local client record
        const clientData: InsertClient = {
          organizationId: request.organizationId,
          stripeCustomerId: stripeCustomer.id,
          email: request.email,
          name: request.name,
          phone: request.phone,
          address: request.address,
          metadata: request.metadata,
        };

        const client = await clientsRepository.create(clientData);

        // 4. Publish event
        await fastify.events.publish({
          eventType: 'CLIENT_CREATED',
          eventVersion: '1.0.0',
          actorId: request.organizationId,
          actorType: 'organization',
          organizationId: request.organizationId,
          payload: {
            clientId: client.id,
            email: request.email,
            name: request.name,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        fastify.log.info(
          {
            organizationId: request.organizationId,
            clientId: client.id,
            email: request.email,
          },
          'Created new client',
        );

        return {
          success: true,
          client,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId: request.organizationId,
            email: request.email,
          },
          'Failed to create client',
        );

        return {
          success: false,
          error: 'Failed to create client',
        };
      }
    },

    /**
     * Get client by ID
     */
    async getClient(
      clientId: string,
      organizationId: string,
    ): Promise<unknown> {
      const client = await clientsRepository.findById(clientId);

      if (!client || client.organizationId !== organizationId) {
        return null;
      }

      return client;
    },

    /**
     * List clients for organization
     */
    async listClients(organizationId: string): Promise<unknown> {
      return await clientsRepository.listByOrganizationId(organizationId);
    },

    /**
     * Update client
     */
    async updateClient(
      clientId: string,
      organizationId: string,
      request: UpdateClientRequest,
    ): Promise<UpdateClientResponse> {
      try {
        // 1. Verify client exists and belongs to organization
        const client = await this.getClient(clientId, organizationId);

        if (!client) {
          return {
            success: false,
            error: 'Client not found',
          };
        }

        // 2. Update Stripe customer
        await fastify.stripe.customers.update(client.stripeCustomerId, {
          name: request.name,
          phone: request.phone,
          address: request.address,
          metadata: {
            ...client.metadata,
            ...request.metadata,
          },
        });

        // 3. Update local client record
        const updatedClient = await clientsRepository.update(clientId, {
          name: request.name,
          phone: request.phone,
          address: request.address,
          metadata: {
            ...client.metadata,
            ...request.metadata,
          },
        });

        // 4. Publish event
        await fastify.events.publish({
          eventType: 'CLIENT_UPDATED',
          eventVersion: '1.0.0',
          actorId: organizationId,
          actorType: 'organization',
          organizationId,
          payload: {
            clientId,
            changes: request,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        fastify.log.info(
          {
            organizationId,
            clientId,
          },
          'Updated client',
        );

        return {
          success: true,
          client: updatedClient,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId,
            clientId,
          },
          'Failed to update client',
        );

        return {
          success: false,
          error: 'Failed to update client',
        };
      }
    },

    /**
     * Delete client
     */
    async deleteClient(
      clientId: string,
      organizationId: string,
    ): Promise<unknown> {
      try {
        // 1. Verify client exists and belongs to organization
        const client = await this.getClient(clientId, organizationId);

        if (!client) {
          return {
            success: false,
            error: 'Client not found',
          };
        }

        // 2. Delete from Stripe (optional - you might want to keep for audit)
        // await fastify.stripe.customers.del(client.stripeCustomerId);

        // 3. Delete local record
        await clientsRepository.delete(clientId);

        // 4. Publish event
        await fastify.events.publish({
          eventType: 'CLIENT_DELETED',
          eventVersion: '1.0.0',
          actorId: organizationId,
          actorType: 'organization',
          organizationId,
          payload: {
            clientId,
            email: client.email,
          },
          metadata: fastify.events.createMetadata('api'),
        });

        fastify.log.info(
          {
            organizationId,
            clientId,
          },
          'Deleted client',
        );

        return {
          success: true,
        };
      } catch (error) {
        fastify.log.error(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            organizationId,
            clientId,
          },
          'Failed to delete client',
        );

        return {
          success: false,
          error: 'Failed to delete client',
        };
      }
    },
  };
};

// Legacy export for backward compatibility during migration
export const createCustomersService = createClientsService;
