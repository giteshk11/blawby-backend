// Module-specific types only - no re-exports
export type CustomerSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerCreateRequest = {
  name: string;
};

export type CustomerUpdateRequest = {
  name?: string;
};
