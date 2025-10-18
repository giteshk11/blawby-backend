// Module-specific types only - no re-exports
export type SubscriptionSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SubscriptionCreateRequest = {
  name: string;
};

export type SubscriptionUpdateRequest = {
  name?: string;
};
