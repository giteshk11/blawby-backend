// Module-specific types only - no re-exports
export type SettingSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SettingCreateRequest = {
  name: string;
};

export type SettingUpdateRequest = {
  name?: string;
};
