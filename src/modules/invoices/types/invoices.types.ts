// Module-specific types only - no re-exports
export type InvoiceSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceCreateRequest = {
  name: string;
};

export type InvoiceUpdateRequest = {
  name?: string;
};
