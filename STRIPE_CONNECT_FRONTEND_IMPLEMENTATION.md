# Stripe Connect Frontend Implementation Guide

## Overview

This guide explains how to implement Stripe Connect account onboarding in a React frontend application. The implementation handles session management, automatic refresh, and error handling.

## Prerequisites

- React project with npm/yarn
- Stripe Connect.js package: `npm install @stripe/connect-js`
- Backend API endpoints (see below)

## API Endpoints

### 1. Create/Get Connected Account

**Endpoint:** `POST /api/onboarding/connected-accounts`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "country": "US"
}
```

**Response:**

```json
{
  "accountId": "acct_1...",
  "clientSecret": "accs_secret_...",
  "expiresAt": 1760189613,
  "sessionStatus": "created",
  "status": {
    "chargesEnabled": false,
    "payoutsEnabled": false,
    "detailsSubmitted": false
  }
}
```

### 2. Refresh Session

**Endpoint:** `POST /api/onboarding/connected-accounts/session`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**

```json
{}
```

**Response:**

```json
{
  "clientSecret": "accs_secret_...",
  "expiresAt": 1760189613
}
```

## Implementation Steps

### 1. Install Dependencies

```bash
npm install @stripe/connect-js
```

### 2. Component Structure

Create a React component with the following structure:

```tsx
// StripeConnectOnboarding.tsx
import { useEffect, useRef, useState } from 'react';
import { loadConnectAndInitialize } from '@stripe/connect-js';

interface StripeConnectProps {
  publishableKey: string;
  authToken: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const StripeConnectOnboarding: React.FC<StripeConnectProps> = ({
  publishableKey,
  authToken,
  onComplete,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Component implementation here
};
```

### 3. Session Management

**Key Points:**

- Sessions expire in 2 minutes (Stripe test mode limitation)
- Sessions can only be claimed once
- Always create fresh sessions, never reuse old ones
- Implement automatic refresh when session expires

**Session Flow:**

1. Call `/api/onboarding/connected-accounts` to get initial session
2. Initialize Stripe Connect with `loadConnectAndInitialize`
3. When Stripe calls `fetchClientSecret` again (session expired):
   - Call `/api/onboarding/connected-accounts/session` to get fresh session
   - Return new client secret
4. Handle maximum refresh attempts (recommend 5)

### 4. Error Handling

**Session Expiration Error:**

- Error message contains "claim account session"
- Show user-friendly message with refresh button
- Explain that sessions expire in 2 minutes

**Network Errors:**

- Handle API failures gracefully
- Show retry options
- Log errors for debugging

### 5. Stripe Connect Initialization

**Required Configuration:**

```tsx
const stripeConnect = loadConnectAndInitialize({
  publishableKey: publishableKey,
  fetchClientSecret: async () => {
    // Implementation details below
  },
});

const onboarding = stripeConnect.create('account-onboarding');
```

**fetchClientSecret Implementation:**

- Track refresh count
- If refreshCount > 0: call session refresh API
- Return client secret
- Handle errors appropriately

### 6. Component Mounting

**Mounting Method:**

- Use `appendChild` to mount the component
- Clear container before mounting
- Handle cleanup on unmount

**Event Handlers:**

- `setOnLoadError`: Handle initialization errors
- `setOnExit`: Handle user exiting onboarding

### 7. State Management

**Required State:**

- `isLoading`: Show loading spinner
- `error`: Display error messages
- `refreshCount`: Track automatic refreshes
- `isCompleted`: Track completion status

**Loading States:**

- Initial session creation
- Session refresh
- Component initialization

### 8. User Experience

**Loading Messages:**

- "Setting up your payment account..."
- "Verifying your business information..."
- "Configuring payment capabilities..."

**Error Messages:**

- "Session expired. Please refresh to continue."
- "Unable to connect to Stripe. Please try again."

**Success Handling:**

- Show completion message
- Call `onComplete` callback
- Redirect or update parent component

## Implementation Checklist

- [ ] Install `@stripe/connect-js` package
- [ ] Create component with proper TypeScript types
- [ ] Implement session creation API call
- [ ] Implement session refresh API call
- [ ] Add automatic session refresh logic
- [ ] Handle session expiration errors
- [ ] Add proper error boundaries
- [ ] Implement loading states
- [ ] Add cleanup on component unmount
- [ ] Test session expiration flow
- [ ] Test error scenarios
- [ ] Add proper logging for debugging

## Testing Scenarios

1. **Normal Flow:**

   - User completes onboarding within 2 minutes
   - Session remains valid throughout

2. **Session Expiration:**

   - User takes longer than 2 minutes
   - Automatic refresh kicks in
   - Onboarding continues seamlessly

3. **Network Errors:**

   - API calls fail
   - Show appropriate error messages
   - Provide retry options

4. **Multiple Attempts:**
   - User refreshes page multiple times
   - Each attempt gets fresh session
   - No session reuse issues

## Security Considerations

- Never log full client secrets (only first 20 characters)
- Validate publishable key format
- Handle authentication token expiration
- Sanitize error messages before displaying

## Performance Notes

- Sessions are lightweight (2-minute expiry)
- Automatic refresh prevents user interruption
- Component cleanup prevents memory leaks
- Minimal re-renders during session refresh

## Debugging Tips

- Log session creation and refresh events
- Monitor `fetchClientSecret` call frequency
- Check network requests for API calls
- Verify timezone handling in session expiry
- Test with different network conditions

## Common Pitfalls

1. **Session Reuse:** Never reuse client secrets
2. **Timezone Issues:** Ensure proper UTC handling
3. **Cleanup:** Always clean up Stripe components
4. **Error Handling:** Don't expose sensitive error details
5. **Refresh Limits:** Prevent infinite refresh loops

This implementation provides a robust, user-friendly Stripe Connect onboarding experience with proper session management and error handling.
