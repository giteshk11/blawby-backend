// Module-specific types only - no re-exports
export type PayoutSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PayoutCreateRequest = {
  name: string;
};

export type PayoutUpdateRequest = {
  name?: string;
};
