# ARIFA Authentication Flow

## Overview

ARIFA uses a dual authentication system: **JWT tokens** for API access and **CSRF cookies** for session-based fallback. Guest access uses UUID-based tokens.

## Authentication Methods

### 1. JWT Authentication (Primary)

**Login:** `POST /api/v1/auth/token/`
- Request: `{ email, password }`
- Response: `{ access, refresh }`
- Tokens are stored **in-memory only** (not localStorage) for XSS protection

**Token Refresh:** `POST /api/v1/auth/token/refresh/`
- Request: `{ refresh }` with `credentials: "include"`
- Response: `{ access, refresh? }`
- Deduplication: concurrent 401 retries share a single refresh call via `_refreshPromise`

**Automatic Retry:**
1. API call returns 401
2. `fetchWithRetry` triggers `refreshAccessToken()`
3. On success: retry original request with new `Authorization` header
4. On failure: clear tokens, invoke `onAuthFailure` callback (triggers logout)

### 2. CSRF Session Authentication (Fallback)

When no JWT token is available, requests include:
- `X-CSRFToken` header (read from `csrftoken` cookie)
- `credentials: "include"` on all requests

This supports Django session auth for browser-based flows.

### 3. Guest Token Authentication

**Header:** `X-Guest-Token: <uuid>`

- GuestLink model: UUID token with 30-day expiry, `is_active` flag
- Validated server-side via `validate_guest_or_auth()` helper
- Used for KYC form submissions and accounting record declarations
- No Django user association — system user used for audit trail

### 4. Magic Link Authentication

**Flow:**
1. Client user requests magic link: `POST /api/v1/auth/magic-link/`
2. Email sent with token URL
3. Client clicks link → `POST /api/v1/auth/magic-link/validate/`
4. Returns JWT tokens on success

## Request Header Priority

```
if JWT token exists:
  Authorization: Bearer <access_token>
else:
  X-CSRFToken: <csrf_cookie>

if guest token exists:
  X-Guest-Token: <uuid>  (always included alongside auth)
```

## Token Lifecycle

```
Login → Store tokens in memory
  ↓
API Request → Include Bearer token
  ↓
401 Response → Attempt refresh (deduplicated)
  ↓
Refresh Success → Retry with new token
Refresh Failure → Clear tokens → onAuthFailure → Redirect to login
```

## Security Notes

- Tokens never touch localStorage/sessionStorage (XSS mitigation)
- CSRF protection active on all mutating requests
- Refresh calls include `credentials: "include"` for cookie handling
- Guest tokens validated against database on every request
- GuestLink has `CheckConstraint` ensuring expiry > created
