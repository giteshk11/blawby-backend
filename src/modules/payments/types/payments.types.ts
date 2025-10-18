// Module-specific types only - no re-exports
export type PaymentSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentCreateRequest = {
  name: string;
};

export type PaymentUpdateRequest = {
  name?: string;
};
