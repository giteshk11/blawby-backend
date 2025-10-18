import type { Organization } from '@/schema';

// Module-specific types only - no re-exports
export type OnboardingSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OnboardingCreateRequest = {
  name: string;
};

export type OnboardingUpdateRequest = {
  name?: string;
};
