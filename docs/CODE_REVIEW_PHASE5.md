# ARIFA Platform — Phase 5 Code Review

> **Date:** 2026-03-14
> **Scope:** Phase 5 — Automation, AI & Polish
> **Files reviewed:** ~30 files across backend and frontend

---

## Summary

| Severity | Backend | Frontend | Total | Fixed |
|----------|---------|----------|-------|-------|
| CRITICAL | 5 | 2 | **7** | 7 |
| HIGH | 11 | 7 | **18** | 13 |
| MEDIUM | 11 | 15 | **26** | 0 |
| LOW | 7 | 12 | **19** | 0 |
| **Total** | **34** | **36** | **70** | **20** |

---

## CRITICAL Findings

### C-1. Missing authorization check allows any user to read any risk assessment (FIXED)
**File:** `backend/apps/ai_assistant/services.py` (lines 155-178)
**Issue:** `_load_risk_data` fetches a `RiskAssessment` by `risk_assessment_id` alone — any authenticated user (including clients) can supply an arbitrary ID and retrieve risk data.
**Fix:** Filter with both fields: `RiskAssessment.objects.get(id=risk_assessment_id, entity_id=entity_id)`. Add object-level permission check in the view.

### C-2. No role-based access control on sensitive AI endpoints (FIXED)
**File:** `backend/apps/ai_assistant/views.py` (lines 24-137)
**Issue:** All four AI views require only `IsAuthenticated`. Client-role users can access risk explanations and document reviews for any entity.
**Fix:** Add `IsStaffRole` permission to `AIExplainRiskView` and `AIReviewDocView`.

### C-3. Prompt injection via user-controlled context values (FIXED)
**File:** `backend/apps/ai_assistant/services.py` (lines 119-136)
**Issue:** `_build_system_prompt` interpolates user-controlled values (`page`, `entity_type`, etc.) directly into the system prompt without sanitizing newlines or control characters.
**Fix:** Strip newlines/control characters from context values. Move to structured JSON block.

### C-4. Open redirect in unauthenticated TrackClickView (FIXED)
**File:** `backend/apps/notifications/views.py` (lines 177-208)
**Issue:** `TrackClickView` redirects to `notification.action_url` with `AllowAny` permission. No URL validation.
**Fix:** Validate with `url_has_allowed_host_and_scheme()`. Restrict `action_url` to relative paths.

### C-5. Report views use manual authorization check instead of DRF permissions (FIXED)
**File:** `backend/apps/core/reporting.py` (lines 16-33, 186-188)
**Issue:** Manual `_require_staff()` returns `Response(403)` instead of raising `PermissionDenied`, bypassing DRF exception handling.
**Fix:** Replace with `permission_classes = [IsAuthenticated, IsStaffRole]`.

### C-6. AI widget renders for all authenticated users including clients (FIXED)
**File:** `frontend/src/features/shell/app-layout.tsx` (line 53)
**Issue:** `AIChatWidget` mounted unconditionally. Client-role users can query AI about entities/risk they shouldn't access.
**Fix:** Wrap with role guard: only show for staff roles.

### C-7. i18next HTML escaping disabled globally (FIXED — documented)
**File:** `frontend/src/lib/i18n.ts` (lines 17-19)
**Issue:** `escapeValue: false` is react-i18next convention but risky with AI-generated content flowing through the system.
**Fix:** Add code comment documenting risk. Enforce no `dangerouslySetInnerHTML` with `t()` outputs via lint rule.

---

## HIGH Findings

### H-1. User email sent to third-party LLM API (FIXED)
**File:** `backend/apps/ai_assistant/services.py` (line 49-50)
**Fix:** Removed `context["user_email"]` line.

### H-2. New Anthropic client instantiated on every API call (FIXED)
**File:** `backend/apps/ai_assistant/services.py` (lines 141-143)
**Fix:** Moved client creation to `__init__`, stored as `self._client`.

### H-3. Bare `except Exception` silences all API errors (FIXED)
**File:** `backend/apps/ai_assistant/services.py` (lines 151-153)
**Fix:** Split into `except ImportError` and `except Exception as exc` with `logger.exception()`.

### H-4. Double HTML-escaping in email notifications (FIXED)
**File:** `backend/apps/notifications/services.py` (line 39) + `base_email.html` (line 51)
**Fix:** Removed `html_escape` from `render_template`, rely on Django auto-escaping.

### H-5. `category_channels` JSON field accepts arbitrary unvalidated data (FIXED)
**File:** `backend/apps/notifications/serializers.py` (line 78)
**Fix:** Added `validate_category_channels` method with category/channel enum validation.

### H-6. N+1 queries in `process_reminders` Celery task (NOT FIXED — performance)
**File:** `backend/apps/notifications/tasks.py` (lines 48-84)
**Recommendation:** Single flat query with `select_related`.

### H-7. N+1 queries in `send_daily_digest` Celery task (NOT FIXED — performance)
**File:** `backend/apps/notifications/tasks.py` (lines 120-208)
**Recommendation:** Pre-fetch with annotated query.

### H-8. N+1 queries in `UserActivityReportView` (NOT FIXED — performance)
**File:** `backend/apps/core/reporting.py` (lines 227-271)
**Recommendation:** Use annotation queries instead of per-user loops.

### H-9. Unvalidated date parsing produces 500 errors (FIXED)
**File:** `backend/apps/core/reporting.py` (lines 50-55, 198-212)
**Fix:** Wrapped `strptime` in try/except ValueError, returns 400.

### H-10. Race condition in `mark_as_read` (FIXED)
**File:** `backend/apps/notifications/services.py` (lines 249-262)
**Fix:** Replaced with idempotent `.filter().update()`, removed `@transaction.atomic`.

### H-11. `send_notification_async` accepts unconstrained `**kwargs` (NOT FIXED — low risk)
**File:** `backend/apps/notifications/tasks.py` (lines 13, 28-32)
**Recommendation:** Explicitly enumerate parameters.

### H-12. Notification `action_url` navigated without validation (FIXED)
**File:** `frontend/src/features/notifications/components/notification-item.tsx` (lines 59-61)
**Fix:** Added `/`-prefix validation before `navigate()`.

### H-13. Search result `url` navigated without validation (FIXED)
**File:** `frontend/src/features/search/components/global-search-bar.tsx` (lines 69-77)
**Fix:** Added `/`-prefix validation before `navigate()`.

### H-14. CSV export vulnerable to formula injection (FIXED)
**File:** `frontend/src/lib/export.ts` (lines 10-21)
**Fix:** Added `sanitizeCellValue` that prefixes `'` on formula-starting characters.

### H-15. Search race condition — stale results overwrite current (FIXED)
**File:** `frontend/src/features/search/components/global-search-bar.tsx` (lines 42-66)
**Fix:** Added `requestSeqRef` counter to discard stale responses.

### H-16. No authorization guard on financial reports page (FIXED)
**File:** `frontend/src/features/reports/pages/financial-dashboard-page.tsx`
**Fix:** Added role guard — clients redirected to portal.

### H-17. No authorization guard on user activity reports page (FIXED)
**File:** `frontend/src/features/reports/pages/user-activity-page.tsx`
**Fix:** Added role guard — clients redirected to portal.

### H-18. No client-side rate limiting on AI chat (FIXED)
**File:** `frontend/src/features/ai/components/ai-chat-widget.tsx`
**Fix:** Added 2-second cooldown between sends via `lastSentRef`.

---

## MEDIUM Findings (selected)

- **M-1.** `review_document` never loads actual document content (NOT FIXED)
- **M-2.** Template regex may corrupt `${var}` syntax (NOT FIXED)
- **M-3.** `digest_hour` has no database-level constraint (NOT FIXED)
- **M-4.** Signal handler may crash on null `definition` FK (NOT FIXED)
- **M-5.** Missing `transaction.atomic` on SavedFilter default-clearing (NOT FIXED)
- **M-6.** `GlobalSearchView` does not enforce role-based data scoping (NOT FIXED)
- **M-7.** Financial report exposed to all staff roles including coordinator (NOT FIXED)
- **M-8.** Pending invoices query not scoped to selected date range (NOT FIXED)
- **M-9.** `SavedFilter.filters` JSON field accepts unbounded data (NOT FIXED)
- **M-10.** GlobalSearchView performs 4 unindexed `LIKE '%query%'` scans (NOT FIXED)
- **M-11.** `notify_kyc_status_change` fires on every save, not just status changes (NOT FIXED)
- **M-12.** AI field suggestions fire mutation inside useEffect (NOT FIXED)
- **M-13.** AI risk explanation has no error state display (NOT FIXED)
- **M-14.** No message length limit on AI chat input (NOT FIXED)
- **M-15.** Notification `timeAgo` has hardcoded English strings (NOT FIXED)
- **M-16.** NotificationBell `panelOpened` never resets (NOT FIXED)
- **M-17.** No success/error feedback on notification preferences save (NOT FIXED)
- **M-18.** No success/error feedback on "Mark all read" (NOT FIXED)
- **M-19.** Financial dashboard uses local `formatCurrency` instead of shared utility (NOT FIXED)
- **M-20.** User activity role filter applied only client-side (NOT FIXED)
- **M-21.** Reports API lacks TanStack Query hook wrappers (NOT FIXED)
- **M-22.** `format.ts` date functions throw on invalid date strings (NOT FIXED)
- **M-23.** `i18n.ts` reads localStorage at module load — can throw (NOT FIXED)
- **M-24.** Notification preferences digest hour ignores locale (NOT FIXED)
- **M-25.** No error boundaries around shell-level Phase 5 components (NOT FIXED)
- **M-26.** Mobile users have no access to search functionality (NOT FIXED)

---

## LOW Findings (selected)

- **L-1.** `json` and `re` modules imported inside function bodies (NOT FIXED)
- **L-2.** `GlobalSearchView` may crash if `ticket.current_state` is None (NOT FIXED)
- **L-3.** Tracking pixel placed outside main layout table (NOT FIXED)
- **L-4.** Hardcoded throttle rate not configurable via settings (NOT FIXED)
- **L-5.** `_get_suggested_questions` helper has hardcoded strings (NOT FIXED)
- **L-6.** `seed_notification_templates` overwrites customizations (NOT FIXED)
- **L-7.** `AIAssistant` uses `BigAutoField` despite project UUID convention (NOT FIXED)
- **L-8.** Chat message IDs use `Date.now()` — potential collisions (NOT FIXED)
- **L-9.** NotificationItemRow missing ARIA for unread state (NOT FIXED)
- **L-10.** `navigator.platform` is deprecated (NOT FIXED)
- **L-11.** Saved filter delete uses `span` with unsafe type cast (NOT FIXED)
- **L-12.** Hardcoded "Open sidebar" English string (NOT FIXED)
- **L-13.** Reports hub uses inline SVGs instead of Heroicons (NOT FIXED)
- **L-14.** Reports hub Card not keyboard-accessible (NOT FIXED)
- **L-15.** Hardcoded jurisdiction options in financial dashboard (NOT FIXED)
- **L-16.** Chart bar colors disconnected from Tailwind theme (NOT FIXED)
- **L-17.** i18n bundles loaded synchronously (NOT FIXED)
- **L-18.** Unused suggestedQuestions state persists (NOT FIXED)
- **L-19.** Hardcoded "ARIFA" brand text on mobile header (NOT FIXED)

---

## Recommendations for Production

1. **Fix all 7 CRITICAL items** before any production deployment
2. **Fix H-4 (double escaping)** immediately — all emails are currently garbled for names with special characters
3. **Fix H-9 (date parsing)** — produces 500 errors on bad input
4. **Fix H-14 (CSV injection)** — common attack vector when exporting user-generated data
5. **Add error boundaries** (M-25) to prevent AI/search/notification errors from crashing the app
6. **Add PostgreSQL trigram indexes** (M-10) before production to prevent search degrading with data growth
