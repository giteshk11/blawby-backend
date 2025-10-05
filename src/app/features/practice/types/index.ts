// Re-export types from database queries
export type {
  PracticeDetails,
  CreatePracticeDetails,
  UpdatePracticeDetails,
} from '../database/queries';

// Additional practice-specific types
export type PracticeBusinessInfo = {
  businessPhone?: string;
  businessEmail?: string;
  consultationFee?: string;
  paymentUrl?: string;
  calendlyUrl?: string;
};

export type PracticeOnboardingData = {
  organizationId: string;
  businessInfo: PracticeBusinessInfo;
};


