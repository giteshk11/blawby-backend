// Module-specific types only - no re-exports
export type StripeSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StripeCreateRequest = {
  name: string;
};

export type StripeUpdateRequest = {
  name?: string;
};
