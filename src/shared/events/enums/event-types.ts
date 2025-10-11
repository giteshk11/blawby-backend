/**
 * Event Types Enum
 *
 * Centralized event type definitions following the naming convention:
 * {domain}.{object}_{past_tense_verb}
 *
 * Usage:
 * - Import: import { EventType } from '@/shared/events/enums/event-types';
 * - Use: EventType.AUTH_USER_SIGNED_UP
 */

export enum EventType {
  // Authentication events
  AUTH_USER_SIGNED_UP = 'auth.user_signed_up',
  AUTH_EMAIL_VERIFIED = 'auth.email_verified',
  AUTH_USER_LOGGED_IN = 'auth.user_logged_in',
  AUTH_USER_LOGGED_OUT = 'auth.user_logged_out',
  AUTH_PASSWORD_RESET_REQUESTED = 'auth.password_reset_requested',
  AUTH_PASSWORD_CHANGED = 'auth.password_changed',
  AUTH_ACCOUNT_DELETED = 'auth.account_deleted',

  // User CRUD events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_PROFILE_UPDATED = 'user.profile_updated',
  USER_EMAIL_CHANGED = 'user.email_changed',
  USER_AVATAR_UPDATED = 'user.avatar_updated',

  // Practice events (unified - practice = organization + details)
  PRACTICE_CREATED = 'practice.created',
  PRACTICE_UPDATED = 'practice.updated',
  PRACTICE_DELETED = 'practice.deleted',
  PRACTICE_DETAILS_CREATED = 'practice.details_created',
  PRACTICE_DETAILS_UPDATED = 'practice.details_updated',
  PRACTICE_DETAILS_DELETED = 'practice.details_deleted',
  PRACTICE_SPECIALTIES_UPDATED = 'practice.specialties_updated',
  PRACTICE_CONTACT_INFO_UPDATED = 'practice.contact_info_updated',
  PRACTICE_MEMBER_INVITED = 'practice.member_invited',
  PRACTICE_MEMBER_JOINED = 'practice.member_joined',
  PRACTICE_MEMBER_ROLE_CHANGED = 'practice.member_role_changed',
  PRACTICE_MEMBER_REMOVED = 'practice.member_removed',
  PRACTICE_MEMBER_LEFT = 'practice.member_left',
  PRACTICE_SWITCHED = 'practice.switched',
  PRACTICE_ACCESS_DENIED = 'practice.access_denied',

  // Settings events
  SETTINGS_CREATED = 'settings.created',
  SETTINGS_UPDATED = 'settings.updated',
  SETTINGS_DELETED = 'settings.deleted',
  USER_SETTINGS_UPDATED = 'settings.user_updated',
  PRACTICE_SETTINGS_UPDATED = 'settings.practice_updated',
  SETTINGS_CATEGORY_UPDATED = 'settings.category_updated',

  // Billing events
  BILLING_ONBOARDING_STARTED = 'billing.onboarding_started',
  BILLING_ONBOARDING_COMPLETED = 'billing.onboarding_completed',
  BILLING_ONBOARDING_FAILED = 'billing.onboarding_failed',
  BILLING_PAYMENT_SESSION_CREATED = 'billing.payment_session_created',
  BILLING_PAYMENT_RECEIVED = 'billing.payment_received',
  BILLING_PAYMENT_FAILED = 'billing.payment_failed',
  BILLING_PAYMENT_REFUNDED = 'billing.payment_refunded',
  BILLING_ACCOUNT_UPDATED = 'billing.account_updated',
  BILLING_ACCOUNT_REQUIREMENTS_CHANGED = 'billing.account_requirements_changed',
  BILLING_ACCOUNT_CAPABILITIES_UPDATED = 'billing.account_capabilities_updated',
  BILLING_WEBHOOK_RECEIVED = 'billing.webhook_received',
  BILLING_WEBHOOK_PROCESSED = 'billing.webhook_processed',
  BILLING_WEBHOOK_FAILED = 'billing.webhook_failed',

  // System events
  SYSTEM_HEALTH_CHECK_PERFORMED = 'system.health_check_performed',
  SYSTEM_ERROR_OCCURRED = 'system.error_occurred',
  SYSTEM_PERFORMANCE_DEGRADED = 'system.performance_degraded',
  SESSION_CREATED = 'session.created',
  SESSION_EXPIRED = 'session.expired',
  SESSION_INVALIDATED = 'session.invalidated',
}

// Helper type for event type values
export type EventTypeValue = `${EventType}`;

// Helper functions for event type validation
export const isValidEventType = (value: string): value is EventTypeValue => {
  return Object.values(EventType).includes(value as EventType);
};

export const getEventTypeByDomain = (domain: string): EventType[] => {
  return Object.values(EventType).filter((type) =>
    type.startsWith(`${domain}.`),
  );
};

// Event type groups for easier filtering
export const EVENT_DOMAINS = {
  AUTH: 'auth',
  USER: 'user',
  PRACTICE: 'practice',
  SETTINGS: 'settings',
  BILLING: 'billing',
  SYSTEM: 'system',
  SESSION: 'session',
} as const;

export type EventDomain = (typeof EVENT_DOMAINS)[keyof typeof EVENT_DOMAINS];
