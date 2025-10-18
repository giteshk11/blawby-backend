import type { Client, Organization } from '@/schema';

// Module-specific types only - no re-exports
export type ClientWithOrganization = Client & {
  organization: Organization;
};

export type ClientStats = {
  totalInvoices: number;
  totalRevenue: number;
  lastInvoiceDate: Date | null;
  averageInvoiceAmount: number;
};

export type ClientSummary = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientCreateRequest = {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

export type ClientUpdateRequest = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
};
