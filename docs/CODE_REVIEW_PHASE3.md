# ARIFA Platform -- Code Review: Phase 3

> **Date:** 2026-03-14 (updated)
> **Reviewer:** Claude (Senior Developer Review)
> **Scope:** 10 Phase 3 modules -- backend Django + frontend React/TypeScript
> **Guidelines:** Per `docs/CODE_REVIEW_GUIDELINES.md` v1.0.0

---

## Verdict

- **CHANGES REQUESTED** -- Fix all P0/P1 items before proceeding to Phase 4.

---

## Executive Summary

The codebase demonstrates solid architecture: consistent UUID PKs, separate Input/Output serializers, proper `transaction.atomic` usage, in-memory JWT storage (not localStorage), zero `dangerouslySetInnerHTML`, zero `any` types, and comprehensive i18n. However, there are critical security gaps (open registration, missing multi-tenancy, unvalidated file uploads on extraction endpoint), architecture violations (business logic in views, duplicate ownership tree queries), and frontend correctness issues (risk breakdown rendering bug, no depth limit on recursive tree, hardcoded score gauge denominator).

**Total Issues:** 39 backend + 33 frontend = 72 findings

---

## Summary Table by Module

| # | Module | CRITICAL (P0) | HIGH (P1) | MEDIUM (P2) | LOW (P3) | Total |
|---|--------|:---:|:---:|:---:|:---:|:---:|
| 3.1 | KYC Backend | 1 | 5 | 8 | 2 | 16 |
| 3.2 | KYC Frontend | 1 | 3 | 5 | 3 | 12 |
| 3.3 | Economic Substance Backend | 0 | 1 | 2 | 1 | 4 |
| 3.4 | Economic Substance Frontend | 0 | 1 | 2 | 1 | 4 |
| 3.5 | Shareholders Calculator | 0 | 2 | 2 | 1 | 5 |
| 3.6 | Risk Matrix | 0 | 1 | 2 | 1 | 4 |
| 3.7 | Accounting Records | 0 | 2 | 3 | 1 | 6 |
| 3.8 | Compliance Dashboard | 0 | 0 | 3 | 1 | 4 |
| 3.9 | Help Button | 0 | 1 | 2 | 0 | 3 |
| 3.10 | Compliance Page Redesign | 0 | 0 | 2 | 1 | 3 |
| | **Cross-cutting** | 1 | 3 | 4 | 3 | 11 |
| | **TOTAL** | **3** | **19** | **35** | **15** | **72** |

---

## 3.1 KYC Backend

**Files reviewed:**
- `backend/apps/compliance/models.py` (KYCSubmission, Party, RiskAssessment, RFI, WorldCheckCase, DocumentUpload)
- `backend/apps/compliance/services.py` (KYC lifecycle, risk calculation engine)
- `backend/apps/compliance/views.py` (KYCSubmissionViewSet, PartyViewSet, WorldCheckWebhookView)
- `backend/apps/compliance/serializers.py` (Input/Output serializers)
- `backend/apps/compliance/tasks.py` (Celery tasks for screening, extraction, recalculation)
- `backend/apps/compliance/constants.py` (all TextChoices enums)
- `backend/apps/compliance/urls.py`

### P0 -- BLOCKER (1)

| # | Description | File | Line |
|---|------------|------|------|
| 3.1-01 | **Open user registration allows any role** -- `RegisterView` uses `AllowAny` with no role restriction. An attacker can self-register as `director` and gain full admin access. | `authentication/views.py` | 60-77 |

**Fix:** Remove endpoint in production, or restrict self-registration to `client` role only. Admin user creation should require director authentication.

### P1 -- MUST FIX (5)

| # | Description | File | Line |
|---|------------|------|------|
| 3.1-02 | **No object-level permissions on Core ViewSets** -- `ClientViewSet`, `EntityViewSet`, `PersonViewSet`, `MatterViewSet` all use `IsAuthenticated` only. Any logged-in user (including `client` role) can read/write ALL data. | `core/views.py` | 66-309 |
| 3.1-03 | **Sensitive JSON fields exposed to all users** -- `llm_extraction_json` (PII from scanned docs) and `match_data_json` (World-Check results) visible to any authenticated user via serializers. | `compliance/serializers.py` | 179-192 |
| 3.1-04 | **TaskStatusView leaks any Celery task result** -- `AllowAny` + `AsyncResult(task_id)` with no ownership check. Guest with any token can enumerate task IDs to access other users' extraction results. | `compliance/views.py` | 972-1017 |
| 3.1-05 | **`recalculate_all_risks` iterates ALL entities sequentially** -- No chunking or pagination. With `soft_time_limit=3600`, a platform with thousands of entities could time out. Each entity calls `calculate_entity_risk` which makes multiple DB queries. | `compliance/tasks.py` | 121-208 |
| 3.1-06 | **Fire-and-forget WorldCheck screening swallows exceptions** -- `add_party_to_kyc` catches all exceptions from `screen_party_worldcheck.delay()` silently. If Celery is down or misconfigured, parties are added without any screening indication. | `compliance/services.py` | ~986-991 |

### P2 -- SHOULD FIX (8)

| # | Description | File | Line |
|---|------------|------|------|
| 3.1-07 | **`GuestOrAuthMixin._validate_guest_or_auth` does not validate resource ownership** -- Accepts ANY active guest token without checking which KYC/ES/AR it was issued for. The KYCSubmissionViewSet has its own validation that checks `kyc_submission_id`, but `ExtractDocumentView` and `HelpRequestView` inherit the permissive mixin. | `compliance/views.py` | 825-844 |
| 3.1-08 | **Duplicate `get_ownership_tree` calls in risk calculation** -- `_score_entity_factor(OWNERSHIP_OPACITY)` calls `get_ownership_tree()` at line 183, then `_evaluate_entity_triggers(COMPLEX_STRUCTURE)` calls it again at line 396. Same entity, same depth=5. Should cache result. | `compliance/services.py` | 183, 396 |
| 3.1-09 | **`check_kyc_renewals` uses approximate month calculation** -- `timedelta(days=renewal_months * 30)` drifts for longer periods (12 months = 360 days, not 365). Use `dateutil.relativedelta` for accuracy. | `compliance/tasks.py` | 508 |
| 3.1-10 | **PDF export views expose exception details** -- `f"PDF generation failed: {str(exc)}"` returns internal error messages (DB connection strings, file paths) to the client. | `compliance/views.py` | 1616, 1646 |
| 3.1-11 | **Business logic in views** -- `EntityOfficerViewSet._apply_fk_updates`, `EntityActivityViewSet._apply_update`, `SourceOfFundsViewSet._apply_update` bypass service layer (no audit, no trigger evaluation). | `core/views.py` | 516-801 |
| 3.1-12 | **Celery Beat schedule override** -- `celery.py` uses `app.conf.beat_schedule = {...}` which overrides `CELERY_BEAT_SCHEDULE` from settings. Notification tasks silently dropped. | `config/celery.py` | 12-21 |
| 3.1-13 | **Missing DB indexes** -- `KYCSubmission.status`, `Ticket.client_id/entity_id/assigned_to_id`, `RiskAssessment(entity_id, is_current)`, `Party.person_id`, `Client.status/category` frequently filtered but not indexed. | Multiple models | -- |
| 3.1-14 | **Duplicate RiskLevel constants** -- `core/constants.py` has 4 levels (incl. ULTRA_HIGH), `compliance/constants.py` has 3 levels (LOW/MEDIUM/HIGH). Inconsistent across modules. | Multiple | -- |

### P3 -- NICE TO HAVE (2)

| # | Description |
|---|------------|
| 3.1-15 | WorldCheck webhook DEBUG bypass -- accepts unverified webhooks when `DEBUG=True` and secret not configured |
| 3.1-16 | `unique_together` deprecated -- `ClientContact` and `WorkflowTransition` should use `UniqueConstraint` |

---

## 3.2 KYC Frontend

**Files reviewed:**
- `frontend/src/features/kyc/pages/kyc-detail-page.tsx` (~585 lines)
- `frontend/src/features/kyc/pages/kyc-list-page.tsx`
- `frontend/src/features/kyc/pages/kyc-new-page.tsx`
- `frontend/src/features/kyc/components/kyc-form-shell.tsx` (~591 lines)
- `frontend/src/features/kyc/components/party-form.tsx` (~385 lines)
- `frontend/src/features/kyc/components/party-list.tsx` (~442 lines)

### P0 -- BLOCKER (1)

| # | Description | File | Line |
|---|------------|------|------|
| 3.2-01 | **Risk breakdown renders objects as numbers** -- `Number(value) * 10` applied to `breakdown_json` entries which are objects `{score, max_score, detail}`, not numbers. `Number({...})` returns `NaN`, so progress bars render as 0% width and display `[object Object]`. | `kyc-detail-page.tsx` | 520 |

**Fix:** Replace `Number(value) * 10` with `Number(value.score) / Number(value.max_score) * 100` or similar. Also replace `{String(value)}` with `{value.score}/{value.max_score}`.

### P1 -- MUST FIX (3)

| # | Description | File | Line |
|---|------------|------|------|
| 3.2-02 | **Custom tabs missing ARIA roles** -- `kyc-detail-page.tsx` uses custom tab buttons without `role="tab"`, `aria-selected`, `role="tabpanel"`. Should use the shared `<Tabs>` component. | `kyc-detail-page.tsx` | 261-284 |
| 3.2-03 | **Mutations lack `onError` handlers** -- `useApproveKYC`, `useRejectKYC`, `useUpdateEntity`, and other mutations have no error toast. User clicks button, nothing visible happens on failure. | Multiple | -- |
| 3.2-04 | **Guest tokens in URL paths** -- 30-day tokens in `/guest/:token` URLs. Logged by proxies, browser history, analytics. Consider POST-based token exchange or reduced lifetime. | `config/routes.ts` | 18, 29, 36 |

### P2 -- SHOULD FIX (5)

| # | Description | File | Line |
|---|------------|------|------|
| 3.2-05 | **No client-side file size validation** -- `kyc-form-shell.tsx` file upload accepts `.pdf,.doc,.docx,.jpg,.jpeg,.png` but has no size limit. Users can select a 500MB file and only discover the 20MB limit after upload fails on the server. | `kyc-form-shell.tsx` | ~480 |
| 3.2-06 | **Missing `sent_back` in statusColorMap** -- KYC type includes `sent_back` but color map omits it. Falls to gray default (same as draft), making it visually indistinguishable. | `compliance-queue.tsx` | 15 |
| 3.2-07 | **`isLoading || !record` conflates loading and error** -- Shows infinite spinner on API error instead of error state. | `registros-contables-detail-page.tsx` | 32 |
| 3.2-08 | **Auth context functions recreated every render** -- `login`, `loginWithMagicToken`, `logout` not wrapped in `useCallback`. All `useAuth()` consumers re-render on any auth state change. | `auth-context.tsx` | 69-107 |
| 3.2-09 | **Oversized page component** -- `kyc-detail-page.tsx` (~599 lines) with 3 inline sub-components. Extract `DocumentsTab`, `RiskTab`, `RFIsTab` to separate files. | `kyc-detail-page.tsx` | -- |

### P3 -- NICE TO HAVE (3)

| # | Description |
|---|------------|
| 3.2-10 | SVG icons missing `aria-hidden="true"` -- ~20+ decorative icons announced by screen readers |
| 3.2-11 | Non-null assertions (`id!`) used without `enabled: !!id` guards in 15+ pages |
| 3.2-12 | Inline SVG icons copy-pasted -- back-arrow, document icon duplicated. Use `@heroicons/react` |

---

## 3.3 Economic Substance Backend

**Files reviewed:**
- `backend/apps/compliance/models.py` (EconomicSubstanceSubmission, JurisdictionConfig)
- `backend/apps/compliance/views.py` (EconomicSubstanceSubmissionViewSet)
- `backend/apps/compliance/services.py` (ES lifecycle functions)

### P1 -- MUST FIX (1)

| # | Description | File | Line |
|---|------------|------|------|
| 3.3-01 | **ES guest endpoint uses `GuestOrAuthMixin` without resource validation** -- The mixin only validates that the guest token is active and not expired, but does NOT check that the guest link's `es_submission_id` matches the requested resource. Any valid guest token could access any ES submission via the guest endpoint. | `compliance/views.py` | 825-844 |

### P2 -- SHOULD FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.3-02 | **`es_flow_config` on JurisdictionConfig is unused** -- The model has a `JSONField` for flow configuration, but the frontend hardcodes the 9-step flow. Backend never serves or validates against this config. | `compliance/models.py` | JurisdictionConfig |
| 3.3-03 | **No status machine validation on ES transitions** -- `advance_step`, `submit`, `approve`, `reject` actions in the viewset do not validate the current status before applying the transition. A submitted ES could be submitted again. | `compliance/views.py` | ES actions |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.3-04 | ES submission `flow_answers` stored as unvalidated JSONField -- no schema enforcement for step answers |

---

## 3.4 Economic Substance Frontend

**Files reviewed:**
- `frontend/src/features/economic-substance/components/es-flow-form.tsx` (~361 lines)
- `frontend/src/features/economic-substance/api/es-api.ts` (~282 lines)

### P1 -- MUST FIX (1)

| # | Description | File | Line |
|---|------------|------|------|
| 3.4-01 | **Flow steps hardcoded in frontend** -- The 9-step ES flow (relevant_activities, directed_managed, ciga_in_jurisdiction, adequate_employees, adequate_expenditure, physical_presence, tax_residence, shareholders, review) is hardcoded. Backend has `JurisdictionConfig.es_flow_config` for configurable flows, but it is never used. Changes to the flow require frontend deployment. | `es-flow-form.tsx` | 1-361 |

### P2 -- SHOULD FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.4-02 | **Auto-save debounce uses `setTimeout` ref without cleanup on unmount** -- The 1500ms debounce timer may fire after component unmount, causing a React "setState on unmounted component" warning and potential stale data writes. | `es-flow-form.tsx` | ~auto-save logic |
| 3.4-03 | **No `staleTime` on ES queries** -- Every mount/focus triggers refetch from the server. Set `staleTime: 30_000` for stable data to avoid unnecessary network requests during step navigation. | `es-api.ts` | all `useQuery` calls |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.4-04 | Guest ES form does not show validation errors inline -- only toast on failure |

---

## 3.5 Shareholders Calculator

**Files reviewed:**
- `frontend/src/features/shareholders-calculator/pages/shareholders-calculator-page.tsx` (~567 lines)
- `frontend/src/features/shareholders-calculator/api/ownership-api.ts` (~109 lines)
- `backend/apps/core/services.py` (get_ownership_tree, compute_ubos)

### P1 -- MUST FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.5-01 | **No depth limit on recursive `TreeNode` rendering** -- `TreeNode` component recursively renders children with `depth + 1` and no maximum depth check. If the user creates a circular reference (A owns B owns A), the browser will crash with a stack overflow. The `buildTree` function also has no cycle detection. | `shareholders-calculator-page.tsx` | 345-467 |
| 3.5-02 | **N+1 in `get_ownership_tree`** -- Recursive DB queries per entity node. A 5-level structure with 3 shareholders each = 121 queries. Called TWICE during risk assessment (once for OWNERSHIP_OPACITY score, once for COMPLEX_STRUCTURE trigger). | `core/services.py` | 332-416 |

**Fix for 3.5-01:** Add `MAX_DEPTH = 10` constant and stop rendering with a "Max depth reached" message. In `buildTree`, track visited node IDs to detect cycles.

### P2 -- SHOULD FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.5-03 | **No validation that ownership percentages sum to <= 100% per parent** -- User can add children with 60% + 60% = 120% ownership under a single parent entity node. The frontend shows no warning. Backend `compute_ubos` may produce nonsensical effective percentages. | `shareholders-calculator-page.tsx` | 75-99 |
| 3.5-04 | **Percentage bug in ownership calculation** -- Multi-class shareholder aggregation sums `total_issued` across classes, producing incorrect percentages for holders in multiple share classes. | `core/services.py` | 363-387 |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.5-05 | `unknown[]` in `OwnershipSnapshotRecord` type -- `nodes`, `edges`, `reportable_ubos`, `warnings` all `unknown[]`. Add basic structure types. |

---

## 3.6 Risk Matrix

**Files reviewed:**
- `frontend/src/features/compliance/components/risk-display.tsx` (~193 lines)
- `frontend/src/features/compliance/api/risk-matrix-api.ts` (~291 lines)
- `frontend/src/features/compliance/pages/risk-matrix-config-page.tsx`
- `frontend/src/features/compliance/pages/risk-matrix-config-detail-page.tsx`
- `frontend/src/features/compliance/components/risk-history-timeline.tsx`
- `backend/apps/compliance/services.py` (risk calculation engine)

### P1 -- MUST FIX (1)

| # | Description | File | Line |
|---|------------|------|------|
| 3.6-01 | **`ScoreGauge` hardcodes `/ 100` denominator** -- The risk display renders `<span>/ 100</span>` but the actual max score depends on the risk matrix configuration (sum of all factor `max_score` values). A matrix with 5 factors at max 10 each would have a max of 50, making `/ 100` misleading. | `risk-display.tsx` | 42 |

**Fix:** Add `maxScore` prop to `ScoreGauge` derived from `assessment.factor_scores` or a dedicated `max_total_score` field on the assessment response.

### P2 -- SHOULD FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.6-02 | **Risk matrix config CRUD uses `Record<string, unknown>` for payloads** -- `useCreateRiskMatrixConfig` and `useUpdateRiskMatrixConfig` accept untyped data. Define a proper `RiskMatrixConfigInput` interface. | `risk-matrix-api.ts` | 56, 67 |
| 3.6-03 | **No optimistic update on config activation** -- `useActivateRiskMatrixConfig` posts, then waits for full refetch. During the delay, user sees stale "inactive" state. Add optimistic cache update. | `risk-matrix-api.ts` | 87-96 |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.6-04 | `TriggeredRulesBox` renders empty fragment when no rules -- could skip render entirely with early return (already does this correctly, minor) |

---

## 3.7 Accounting Records

**Files reviewed:**
- `backend/apps/compliance/models.py` (AccountingRecord, AccountingRecordDocument)
- `backend/apps/compliance/serializers.py` (AccountingRecordDocumentUploadInputSerializer)
- `frontend/src/features/registros-contables/pages/registros-contables-list-page.tsx`
- `frontend/src/features/registros-contables/pages/registros-contables-detail-page.tsx`
- `frontend/src/features/registros-contables/pages/registros-contables-guest-page.tsx`
- `frontend/src/features/registros-contables/components/balance-general-form.tsx` (~223 lines)
- `frontend/src/features/registros-contables/components/exempt-form.tsx` (~41 lines)
- `frontend/src/features/registros-contables/components/print-view.tsx`

### P1 -- MUST FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.7-01 | **`AccountingRecord.file_password` stored in plaintext** -- Sensitive password for uploaded encrypted files stored as a plain `CharField(max_length=255)` in the database. Anyone with DB read access (admins, backups, SQL injection) gets the password. | `compliance/models.py` | 577 |
| 3.7-02 | **Unvalidated signature data in `<img src>`** -- `record.signature_data` rendered directly as `<img src={record.signature_data}>`. Could be a `javascript:` URI or crafted SVG payload. Must validate `data:image/png;base64,` or `data:image/svg+xml;base64,` prefix. | `registros-contables-detail-page.tsx` | ~146 |

**Fix for 3.7-01:** Encrypt at rest using `django-encrypted-model-fields` or a custom `EncryptedCharField`. At minimum, encrypt with `Fernet` using `settings.SECRET_KEY` as the key derivation base.

**Fix for 3.7-02:** Add prefix validation: `if (data && !data.startsWith('data:image/')) return null;`

### P2 -- SHOULD FIX (3)

| # | Description | File | Line |
|---|------------|------|------|
| 3.7-03 | **`ExtractDocumentInputSerializer` missing file validation** -- Unlike `DocumentUploadInputSerializer` which validates MIME type, extension, and 20MB size limit, `ExtractDocumentInputSerializer` accepts ANY file with no size or type check. Combined with `AllowAny` permission, this allows anonymous users to upload arbitrarily large files for LLM processing. | `compliance/serializers.py` | 299-301 |
| 3.7-04 | **Balance general form does not validate non-negative values** -- Users can enter negative amounts for assets and liabilities. The equity calculation `totalAssets - totalLiabilities` would be incorrect with negative inputs. | `balance-general-form.tsx` | -- |
| 3.7-05 | **Guest accounting record page does not validate `currentPage` for help requests** -- `currentPage` is derived from `window.location.pathname` which could be manipulated. Low risk since it only affects help request metadata. | `registros-contables-guest-page.tsx` | -- |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.7-06 | `ExemptForm` uses raw HTML `<input>` instead of the design system `<Input>` component. Inconsistent styling and missing built-in error handling. |

---

## 3.8 Compliance Dashboard

**Files reviewed:**
- `frontend/src/features/compliance/pages/compliance-overview-page.tsx` (~341 lines)
- `frontend/src/features/compliance/pages/risk-dashboard-page.tsx` (~292 lines)
- `frontend/src/features/compliance/components/compliance-queue.tsx`
- `frontend/src/features/compliance/components/compliance-calendar.tsx`

### P2 -- SHOULD FIX (3)

| # | Description | File | Line |
|---|------------|------|------|
| 3.8-01 | **Hardcoded jurisdiction filter options** -- Compliance overview page hardcodes `BVI`, `Panama`, `Belize` as jurisdiction filter values. New jurisdictions require frontend code change. Should be driven by a backend endpoint or derived from entity data. | `compliance-overview-page.tsx` | 231-235 |
| 3.8-02 | **Overview page hits two separate endpoints without coordination** -- `overview-stats` and `overview-entities` fire independently. Stats could reflect different data state than the entity list if data changes between the two requests. Consider a single combined endpoint. | `compliance-overview-page.tsx` | 48-64 |
| 3.8-03 | **Risk dashboard slices to 10 items client-side** -- Fetches all entities then slices `results.slice(0, 10)`. For large datasets, this wastes bandwidth. Use `per_page=10` parameter instead. | `risk-dashboard-page.tsx` | -- |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.8-04 | `ComplianceCalendar` component imported but no loading/error boundary around it. Calendar failure could crash the entire overview page. |

---

## 3.9 Help Button

**Files reviewed:**
- `frontend/src/components/feedback/help-button.tsx` (~138 lines)
- `backend/apps/compliance/views.py` (HelpRequestView)
- `backend/apps/compliance/serializers.py` (HelpRequestInputSerializer)

### P1 -- MUST FIX (1)

| # | Description | File | Line |
|---|------------|------|------|
| 3.9-01 | **Help request endpoint accepts empty messages** -- `HelpRequestInputSerializer.message` is `required=False, allow_blank=True, default=""`. Combined with `AllowAny` + `GuestOrAuthMixin` (which only checks token validity, not resource ownership), this means any valid guest token can submit empty help requests at a rate of 12/hour per IP. While throttled, this could generate noise in the support queue. | `compliance/serializers.py` | 794-798 |

**Fix:** Either make `message` required with `min_length=10`, or require at least one of `message` or `entity_id` to be non-empty.

### P2 -- SHOULD FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.9-02 | **`HelpRequestThrottle` uses `AnonRateThrottle`** -- The throttle class inherits from `AnonRateThrottle`, so authenticated users bypass it entirely. They could submit unlimited help requests. Should use `UserRateThrottle` for authenticated users with a separate rate. | `compliance/views.py` | HelpRequestView |
| 3.9-03 | **Entity ID displayed as raw UUID** -- The help button modal shows the entity ID as a raw UUID string (e.g., `a1b2c3d4-...`). Should resolve to entity name for better UX. | `help-button.tsx` | 97-100 |

---

## 3.10 Compliance Page Redesign

**Files reviewed:**
- `frontend/src/features/compliance/pages/due-diligence-dashboard-page.tsx` (~280 lines)
- `frontend/src/features/compliance/components/compliance-queue.tsx`
- `frontend/src/features/compliance/api/dd-api.ts`
- `frontend/src/features/compliance/components/dd-checklist-panel.tsx`
- `frontend/src/features/compliance/components/delegation-list.tsx`
- `frontend/src/features/compliance/components/delegation-modal.tsx`
- `frontend/src/features/compliance/components/field-comment-thread.tsx`

### P2 -- SHOULD FIX (2)

| # | Description | File | Line |
|---|------------|------|------|
| 3.10-01 | **Due diligence dashboard has no search/text filter** -- Unlike the compliance queue which has debounced search, the DD dashboard only filters by status and date range. Users cannot search by entity name or client. | `due-diligence-dashboard-page.tsx` | 240-265 |
| 3.10-02 | **Sidebar not filtering nav by role** -- All users (including clients) see the "Administration" and "Compliance" links. `navItems.roles` property exists but is not checked against the current user's role. | `sidebar.tsx` | 63-88 |

### P3 -- NICE TO HAVE (1)

| # | Description |
|---|------------|
| 3.10-03 | DD dashboard and compliance overview have duplicated KPI card layout code. Extract to a shared `<DashboardStatsGrid>` component. |

---

## Cross-Cutting Issues

### P0 -- BLOCKER (1)

| # | Description | File | Line |
|---|------------|------|------|
| X-01 | **`GuestOrAuthMixin` accepts ANY active guest token** -- The mixin at `compliance/views.py:825-844` validates that a guest token exists and is not expired, but does NOT check which resource (KYC/ES/AR) the token was issued for. Any guest with a valid token for one resource could access `ExtractDocumentView`, `HelpRequestView`, or other guest-accessible endpoints regardless of the token's intended scope. | `compliance/views.py` | 825-844 |

**Fix:** Add a `required_link_type` parameter to the mixin, or check `link.kyc_submission_id` / `link.es_submission_id` / `link.accounting_record_id` against the request's target resource.

### P1 -- MUST FIX (3)

| # | Description | File | Line |
|---|------------|------|------|
| X-02 | **LoginView missing JWT in response** -- Returns only user data, no tokens. `MagicLinkValidateView` returns both. Frontend likely expects JWT from login. | `authentication/views.py` | 80-109 |
| X-03 | **No rate limiting on Login/Register** -- Vulnerable to brute force and mass registration attacks. | `authentication/views.py` | 60-109 |
| X-04 | **SharePoint upload always sends empty bytes** -- `upload_document_to_sharepoint_async` passes `file_bytes=b""` because file content is not stored/passed to the async task. Uploaded documents have 0 bytes in SharePoint. | `compliance/tasks.py` | 444 |

### P2 -- SHOULD FIX (4)

| # | Description | File | Line |
|---|------------|------|------|
| X-05 | **Inconsistent error response format** -- 4 different shapes: `ApplicationError` -> `{message, extra}`, DRF validation -> `{field: [errors]}`, direct -> `{detail}`, DRF permission -> `{detail}`. Frontend `api-client.ts` must handle all shapes. | Multiple | -- |
| X-06 | **Duplicated `formatDate` in 9 files** -- Each with slightly different implementation. Extract to `src/lib/format.ts`. | Multiple | -- |
| X-07 | **Duplicated `statusColorMap` in 5 files** -- Same KYC status-to-color mapping. Extract to `src/config/status-colors.ts`. | Multiple | -- |
| X-08 | **DataTable generic constraint forces casts everywhere** -- `T extends Record<string, unknown>` requires ugly `as (Type & Record<string, unknown>)[]` in 12+ files. Change to `T extends object`. | `data-table.tsx` | 22 |

### P3 -- NICE TO HAVE (3)

| # | Description |
|---|------------|
| X-09 | `Entity.ubo_exception_type` uses inline choices instead of `TextChoices` enum from constants |
| X-10 | Audit log `str()` comparison -- `str(None) != str("")` creates false change entries |
| X-11 | Services not using keyword-only args -- `get_ownership_tree(entity_id, ...)` violates project convention |

---

## POSITIVE OBSERVATIONS

### Backend
1. Consistent UUID PKs on all models (TimeStampedModel base)
2. Proper `select_related`/`prefetch_related` on most querysets
3. Separate Input/Output serializers used consistently
4. `CheckConstraints` for XOR relationships (GuestLink, EntityOfficer, ShareIssuance)
5. Celery tasks with retry logic (`bind=True, max_retries, default_retry_delay`)
6. Immutable risk assessments with versioning (`is_current` flag)
7. Debounced risk recalculation via Redis cache keys (`request_risk_recalculation`)
8. Clean storage abstraction (Strategy pattern with ABC)
9. Production security settings (SSL redirect, secure cookies, XSS filter)
10. Risk calculation pre-fetches configs to reduce per-entity DB hits

### Frontend
1. JWT in-memory storage (module-scoped vars, not localStorage)
2. Token refresh deduplication (`_refreshPromise` pattern)
3. Zero `dangerouslySetInnerHTML` usage
4. Zero `any` types -- strict TypeScript discipline
5. Code splitting with `React.lazy()` on all 30+ page components
6. Proper optimistic updates with rollback on kanban
7. Comprehensive i18n (1757+ EN keys, complete ES translations)
8. Well-typed API layer with generics
9. Query key factories for TanStack Query cache management
10. DataTable keyboard support (Enter/Space activation, tabIndex)
11. Compliance queue has proper debounced search (300ms) with smart sorting (under_review first)
12. Help button has proper rate limit handling (429 detection) and accessible `aria-label`

---

## Recommended Fix Order

### Immediate (before Phase 4)
1. **3.1-01 / X-01**: Lock down registration + scope guest token validation (CRITICAL)
2. **3.7-01**: Encrypt `file_password` at rest
3. **3.7-02**: Validate signature data prefix before rendering in `<img>`
4. **3.1-04**: Scope TaskStatusView to requesting user's tasks
5. **X-02 / X-03**: Add JWT to login response + rate limiting
6. **3.2-01**: Fix risk breakdown rendering bug (NaN progress bars)

### This Sprint
7. **3.7-03**: Add file validation to `ExtractDocumentInputSerializer`
8. **3.5-01**: Add depth limit + cycle detection to TreeNode / buildTree
9. **3.6-01**: Make ScoreGauge denominator configurable
10. **3.1-08**: Cache `get_ownership_tree` result within a single risk calculation
11. **X-04**: Fix SharePoint upload empty bytes
12. **X-06 / X-07 / X-08**: Extract shared utilities (formatDate, statusColorMap, DataTable generic)

### Next Sprint
13. **3.1-05**: Add chunking to `recalculate_all_risks`
14. **3.1-11**: Move business logic from views to services
15. **3.1-13**: Add missing database indexes
16. **3.5-03**: Validate ownership percentage sums
17. **3.4-01**: Implement backend-driven ES flow configuration
18. **3.8-01**: Make jurisdiction filter dynamic
19. **3.10-02**: Filter sidebar navigation by user role
20. **3.9-01 / 3.9-02**: Improve help request validation and throttling
