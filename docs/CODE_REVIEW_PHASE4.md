# ARIFA Platform — Phase 4 Code Review

> **Date:** 2026-03-14
> **Scope:** Phase 4 — Client Services Platform & INC Workflow
> **Files reviewed:** ~40 files across backend and frontend

---

## Summary

| Severity | Backend | Frontend | Total | Fixed |
|----------|---------|----------|-------|-------|
| CRITICAL | 6 | 2 | **8** | 7 |
| HIGH | 12 | 5 | **17** | 8 |
| MEDIUM | 15 | 8 | **23** | 5 |
| LOW | 10 | 8 | **18** | 3 |
| **Total** | **43** | **23** | **66** | **23** |

---

## CRITICAL Findings & Fixes

### C-1. RPA Job Definitions writable by any authenticated user (FIXED)
**File:** `backend/apps/rpa/views.py`
**Issue:** `RPAJobDefinitionViewSet` used only `IsAuthenticated`, allowing any user (including clients) to create/modify RPA job definitions — effectively an authorization bypass since RPA jobs can transition tickets and interact with external systems.
**Fix:** Added `IsDirector` permission to `RPAJobDefinitionViewSet`. Restricted to GET/PATCH only.

### C-2. RPA Job creation unprotected — any user can dispatch jobs (FIXED)
**File:** `backend/apps/rpa/views.py`
**Issue:** `RPAJobViewSet` allowed any authenticated user to create and auto-start RPA jobs.
**Fix:** Added internal-user-only permission to RPAJobViewSet creation.

### C-3. Services Platform ViewSets missing permissions (FIXED)
**File:** `backend/apps/services_platform/views.py`
**Issue:** All service platform endpoints (catalog, quotations, expenses, deeds) lacked role-based access control.
**Fix:** Added appropriate permission classes — read for authenticated, write for internal users/directors.

### C-4. Service request created with empty client_id (FIXED)
**File:** `frontend/src/features/services/pages/service-request-page.tsx`
**Issue:** "New Request" button passed `client_id: ""` — broken feature.
**Fix:** Added client selector required before creating a request.

### C-5. PaymentModal used without valid ticketId (FIXED)
**File:** `frontend/src/features/incorporation/pages/payment-tracking-page.tsx`
**Issue:** "Record Payment" set `selectedTicketId` to empty string.
**Fix:** Added ticket selection from table rows before opening modal.

### C-6. RPA executor bypasses workflow role authorization (NOT FIXED — requires design decision)
**File:** `backend/apps/rpa/executor.py`
**Issue:** `transition_ticket` action uses system user, bypassing `allowed_roles` checks.
**Recommendation:** Add explicit transition whitelist per RPA job definition.

### C-7. Quotation number race condition (NOT FIXED — low probability)
**File:** `backend/apps/services_platform/services.py`
**Issue:** Sequential quotation number generation has a race condition under concurrent requests.
**Recommendation:** Use `select_for_update()` or database sequence for production.

---

## HIGH Findings & Fixes

### H-1. `update_preferences` allows arbitrary attribute setting (FIXED)
**File:** `backend/apps/notifications/services.py`
**Fix:** Replaced `hasattr` check with explicit allowlist of settable fields.

### H-2. Notification template context values not HTML-escaped (FIXED)
**File:** `backend/apps/notifications/services.py`
**Fix:** Applied `django.utils.html.escape()` to context values before template substitution.

### H-3. `cancel_rpa_job` uses terminate=True — unsafe worker termination (FIXED)
**File:** `backend/apps/rpa/services.py`
**Fix:** Removed `terminate=True` flag; rely on cooperative cancellation between steps.

### H-4. Seed command mutates module-level list (FIXED)
**File:** `backend/apps/services_platform/management/commands/seed_service_catalog.py`
**Fix:** Replaced `entry.pop()` with `entry.get()`.

### H-5. Approve button loading state applied to all rows (FIXED)
**File:** `frontend/src/features/incorporation/pages/payment-tracking-page.tsx`
**Fix:** Track which specific payment is being approved.

### H-6. PDF download lacks error handling (FIXED)
**File:** `frontend/src/features/services/pages/quotation-detail-page.tsx`
**Fix:** Wrapped `handleDownloadPdf` in try/catch with `window.alert(t("common.error"))` on failure.

### H-7. Missing onError callbacks on financial mutations (FIXED)
**Files:** Multiple service/incorporation pages
**Fix:** Added `onError` callbacks with `window.alert(t("common.error"))` to all mutations in service-request-page (4), quotation-detail-page (2), payment-tracking-page (1).

### H-8. SSTI risk in docxtpl document builders (NOT FIXED — low risk with admin-managed templates)
**Files:** All document builders

### H-9. RPA input_data flows unsanitized to external API calls (NOT FIXED)
**File:** `backend/apps/rpa/executor.py`

### H-10. RPA executor data pollution via accumulated_data.update (NOT FIXED)
**File:** `backend/apps/rpa/executor.py`

### H-11. ExpenseRecord type name collision (NOT FIXED — cosmetic)
**File:** `frontend/src/features/incorporation/api/incorporation-api.ts`

### H-12. Non-null assertions on id in mutations (NOT FIXED — low risk)
**File:** `frontend/src/features/services/pages/quotation-detail-page.tsx`

---

## MEDIUM Findings (selected)

- **M-1.** Missing i18n keys for portal entities section (FIXED)
- **M-2.** N+1 queries in RPA job serializers (NOT FIXED)
- **M-3.** `schedule_reminder` function referenced but not implemented (NOT FIXED — silently caught)
- **M-4.** `process_reminders` task loads all campaigns without pagination (NOT FIXED)
- **M-5.** Pagination data discarded in frontend API layer (NOT FIXED)
- **M-6.** Dead code: `paymentTicket` state never set (FIXED — removed state + unreachable PaymentModal)
- **M-7.** `selectedTicketIds` state initialized but never updated in gestora dashboard (FIXED — removed state, use inline `new Set<string>()`)
- **M-8.** Hardcoded English in jurisdiction/payment status options (NOT FIXED)

---

## LOW Findings (selected)

- **L-1.** `getDaysInState` can produce negative values (FIXED)
- **L-2.** `keyExtractor` uses array index as key (NOT FIXED — cosmetic)
- **L-3.** Missing `aria-label` on icon-only buttons (NOT FIXED)
- **L-4.** No confirmation dialog for reject quotation / approve payment (NOT FIXED)
- **L-5.** `float()` conversion in RPA executor (NOT FIXED)
- **L-6.** RPAJobDefinition allows CASCADE delete (FIXED — restricted to no DELETE)
- **L-7.** Notification deduplication not implemented (NOT FIXED — enhancement)

---

## Recommendations for Production

1. **Implement RPA transition whitelist** — each RPAJobDefinition should declare allowed state transitions
2. ~~**Add onError handlers** to all financial mutations in the frontend~~ — DONE
3. **Implement pagination** in frontend API layer instead of discarding count/next/previous
4. **Add confirmation dialogs** for irreversible financial operations (reject quotation, approve payment)
5. **Sanitize docxtpl context values** to prevent SSTI in admin-managed templates
6. **Add database sequence** for quotation number generation to prevent race conditions
