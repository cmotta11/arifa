# CODE REVIEW: Phase 1 — Foundation & Design System

**Date:** 2026-03-13
**Reviewer:** Claude (automated)
**Branch:** main
**Scope:** Tailwind config, 22 frontend components, Swagger/OpenAPI annotations (5 view files), JWT auth infrastructure, frontend API client

---

## Summary

| Severity | Frontend Components | Backend Swagger/JWT | Frontend Auth/JWT | Total |
|----------|:------------------:|:-------------------:|:-----------------:|:-----:|
| **P0** | 0 | 1 | 2 | **3** |
| **P1** | 5 | 4 | 3 | **12** |
| **P2** | 14 | 7 | 4 | **25** |
| **P3** | 5 | 7 | 3 | **15** |
| **Total** | 24 | 19 | 12 | **55** |

**Verdict:** CHANGES REQUESTED — 3 P0 and 12 P1 issues must be fixed before Phase 1 can be considered fully complete.

---

## P0 — BLOCKER (3 issues)

### P0-01 | Duplicate `@extend_schema` decorators in workflow views — FIXED
**File:** `backend/apps/workflow/views.py`
**Status:** FIXED (2026-03-13)

All five `@action` methods on `TicketViewSet` had two stacked `@extend_schema` decorators. The duplicate single-line decorators have been removed, keeping only the multi-line versions.

### P0-02 | `uploadFile` has no 401 retry / token refresh logic
**File:** `frontend/src/lib/api-client.ts`, lines 157–183

The `request()` function intercepts 401 responses and attempts a token refresh before retrying. The `uploadFile()` function does not. If the access token expires during a session, every file upload (KYC documents, attachments) will fail with a 401 that is never retried.

**Fix:** Refactor `uploadFile` to share the same 401-intercept-and-retry logic used by `request()`, or extract a common fetch wrapper.

### P0-03 | Raw `fetch` calls in `risk-matrix-api.ts` bypass JWT auth entirely
**File:** `frontend/src/features/compliance/api/risk-matrix-api.ts`, lines 177–185 and 240–248

`useExportRiskPDF` and `useExportSnapshotPDF` call `fetch()` directly with only a CSRF token header. They never attach the `Authorization: Bearer` header. PDF export is broken for all JWT-authenticated users.

**Fix:** Import `getAccessToken` from `api-client.ts` and conditionally attach the Bearer header, or add an `api.blob()` method to the shared client.

---

## P1 — MUST FIX (12 issues)

### P1-01 | Missing barrel exports for SearchableSelect and SearchableMultiSelect
**File:** `frontend/src/components/ui/index.ts`

The barrel file exports 10 components but omits `SearchableSelect` and `SearchableMultiSelect`.

### P1-02 | Sidebar contains business logic (violates component layer separation)
**File:** `frontend/src/components/navigation/sidebar.tsx`

Hardcodes `navItems` with ARIFA-specific routes, calls `useAuth()`, implements role-based filtering, language toggle, and logout logic. Should be injected via props or moved to a feature-level wrapper.

### P1-03 | PageLayout contains business-logic coupling
**File:** `frontend/src/components/layout/page-layout.tsx`

Directly imports the business-logic-heavy `Sidebar`, `ToastContainer`, and `useUIStore`. Should accept sidebar/toast as render props or live in `features/`.

### P1-04 | `sortable` column prop declared but non-functional (dead UI)
**File:** `frontend/src/components/data-display/data-table.tsx`

Renders a sort icon but has no `onSort` callback, no sort direction state, and no click handler. Either implement fully or remove.

### P1-05 | Clickable table rows lack keyboard accessibility
**File:** `frontend/src/components/data-display/data-table.tsx`

When `onRowClick` is provided, rows are visually interactive but have no `tabIndex`, `role`, or `onKeyDown` handler.

### P1-06 | `SECRET_KEY` has insecure fallback default
**File:** `backend/config/settings/base.py`, line 6

Falls back to `"insecure-change-me"` if env var is missing. `prod.py` does not override to fail fast.

**Fix:** In `prod.py`: `SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]`

### P1-07 | Database password has insecure fallback default
**File:** `backend/config/settings/base.py`, line 86

Same pattern. `prod.py` should override with `os.environ["POSTGRES_PASSWORD"]` (no default).

### P1-08 | WorldCheck webhook endpoint has no payload authentication
**File:** `backend/apps/compliance/views.py`, lines 833–877

`WorldCheckWebhookView` uses `AllowAny` but never verifies the HMAC signature against `WORLDCHECK_WEBHOOK_SECRET`. Any anonymous request can trigger Celery task dispatch.

### P1-09 | Business logic (update mutations) in views, bypassing service layer
**Files:** `backend/apps/core/views.py`, `backend/apps/workflow/views.py`, `backend/apps/compliance/views.py`

Multiple ViewSets perform `setattr` + `save()` directly in the view for update operations, with no corresponding service function. Affects: ClientViewSet, ClientContactViewSet, MatterViewSet, ShareClassViewSet, ShareIssuanceViewSet, SourceOfWealthViewSet, WorkflowStateViewSet, WorkflowTransitionViewSet, JurisdictionRiskViewSet, RiskMatrixConfigViewSet.

### P1-10 | Login fallback silently swallows all JWT endpoint errors
**File:** `frontend/src/lib/auth/auth-context.tsx`, lines 48–60

Bare `try/catch` on JWT endpoint falls back to session endpoint on any failure — including 400 (bad credentials) and 500 (server error). Should inspect status code and only fall back on expected conditions.

### P1-11 | No global redirect to login when token refresh fails mid-session
**File:** `frontend/src/lib/api-client.ts`, lines 138–143

When refresh fails, throws `ApiError(401)` but there is no mechanism to force logout or redirect. User remains on a protected page with every API call failing.

### P1-12 | `loginWithMagicToken` discards JWT tokens from response
**File:** `frontend/src/lib/auth/auth-context.tsx`, lines 63–66

Calls `api.post("/auth/magic-link/validate/", { token })` but never calls `setTokens()` on the response, unlike the email/password login flow.

---

## P2 — SHOULD FIX (25 issues)

### Frontend i18n (8 issues)
Multiple components have hardcoded English strings that bypass `t()`:
- **P2-01** Sidebar: aria-labels, language toggle text, "Espanol" (should be "Español")
- **P2-02** PageLayout: `aria-label="Open sidebar"`
- **P2-03** Pagination: aria-labels ("Previous page", "Next page")
- **P2-04** AIAssistantShell: title, "Processing...", "No results yet"
- **P2-05** SearchableSelect: "No results"
- **P2-06** SearchableMultiSelect: "No results"
- **P2-07** DataTable: `emptyMessage = "No data available"`
- **P2-08** Sidebar: "Espanol" → "Español" typo

### Frontend Accessibility (6 issues)
- **P2-09** Modal close button lacks `aria-label`
- **P2-10** Sidebar mobile close button lacks `aria-label`
- **P2-11** AIAssistantShell toggle lacks `aria-expanded` and `aria-label`
- **P2-12** SearchableMultiSelect remove-tag button lacks `aria-label`
- **P2-13** SearchableSelect missing `id` prop (fragile label-derived ID)
- **P2-14** SearchableMultiSelect missing `id` prop (same issue)

### Backend Schema Annotations (3 issues)
- **P2-15** Missing `@extend_schema` summaries on standard CRUD methods in `core/views.py` (auto-inferred but undocumented)
- **P2-16** Same issue in `compliance/views.py`
- **P2-17** Same issue in `workflow/views.py`

### Backend Architecture (3 issues)
- **P2-18** CORS production domain not configured in `prod.py` (only `localhost:5173`)
- **P2-19** Two serializer classes defined inside `compliance/views.py` instead of `serializers.py`
- **P2-20** Guest token validation logic duplicated 3 times in `compliance/views.py`

### Frontend Auth (5 issues)
- **P2-21** `refreshAccessToken` omits `credentials: "include"` on fetch call
- **P2-22** `ApiError.data` typed as `unknown` — should reflect DRF error shapes
- **P2-23** `undefined as T` unsafe type cast for 204 responses
- **P2-24** CSRF + JWT mutual exclusion undocumented
- **P2-25** `EntityViewSet` and `PersonViewSet` update logic partially in views (mutation + audit split)

---

## P3 — NICE TO HAVE (15 issues)

### Frontend
- **P3-01** Alert dismissal is uncontrolled (no `onDismiss` callback)
- **P3-02** DataTable generic constraint could use `keyof T & string` for column keys
- **P3-03** Button danger variant uses `hover:bg-red-900` instead of semantic token
- **P3-04** PrintLayout uses inline `<style>` tag (could duplicate on multiple mounts)
- **P3-05** SearchableSelect clear option lacks accessible label

### Backend
- **P3-06** Unused import: `WorldCheckResolveInputSerializer` in `compliance/views.py`
- **P3-07** Redundant `PermissionDenied` re-imports inside method body (3 occurrences)
- **P3-08** `OpenApiResponse` imported but unused in `compliance/views.py`

### Frontend Auth
- **P3-09** `getAccessToken` is exported but never imported anywhere (dead export)

### Positive Observations (no issues)
- **P3-10** JWT configuration correct: 30min access, 7d refresh, rotate+blacklist
- **P3-11** Token endpoints correctly mounted in api_router.py
- **P3-12** Services consistently use keyword-only args
- **P3-13** Input/Output serializer separation consistent across all ViewSets
- **P3-14** `ui-store.ts` — clean, no auth data persisted
- **P3-15** `router.tsx` — route protection correct, no token leakage

---

## Checklist Summary

- [x] Architecture: layer separation mostly correct (P1 sidebar/layout coupling noted)
- [x] Security: no critical vulnerabilities (P1 webhook auth, P0 JWT bypass noted)
- [ ] Tests: no new tests written (tracked as pending tasks 1.2.9, 1.3.8, 1.4.7, 1.8.5)
- [x] Data: no migrations in this phase
- [x] API: consistent patterns, `@extend_schema` added to all views
- [x] Performance: no N+1 introduced, select_related used appropriately
- [x] Errors: graceful handling in API client (P1 refresh-failure redirect noted)
- [x] Code quality: strict TypeScript, no `any` types, no arbitrary hex colors
- [x] Design system: all components use `primary` token, zero `arifa-navy` references remain
- [ ] i18n: 8 hardcoded English strings found (P2)

---

## Next Steps (Priority Order)

1. Fix P0-02 and P0-03 — broken JWT auth for file uploads and PDF exports
2. Fix P1-10, P1-11 — login error handling and refresh failure redirect
3. Fix P1-01 — add missing barrel exports
4. Fix P1-06, P1-07 — add fail-fast secret overrides in prod.py
5. Fix P1-08 — add HMAC verification to WorldCheck webhook
6. Address P2 i18n issues (batch fix)
7. Address P2 accessibility issues (batch fix)
8. Write tests (tasks 1.2.9, 1.3.8, 1.4.7, 1.8.5)
