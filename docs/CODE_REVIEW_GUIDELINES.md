# ARIFA Platform — Code Review Guidelines

> **Version:** 1.0.0
> **Date:** 2026-03-13
> **Rule:** Every task group marked `CODE REVIEW` in the task tracker MUST pass this checklist before being marked complete.

---

## How to Use This Document

After completing each task group, run through the applicable sections of this checklist. **Do not mark a task group as complete until all applicable items pass.** Use this as a living document — add new rules as patterns emerge.

### Review Severity Levels

| Level | Label | Meaning |
|-------|-------|---------|
| **P0** | **BLOCKER** | Must fix before merge. Security vulnerability, data corruption risk, or crash. |
| **P1** | **MUST FIX** | Must fix before merge. Bugs, missing tests, architecture violations. |
| **P2** | **SHOULD FIX** | Fix in same sprint. Code quality, naming, minor improvements. |
| **P3** | **NICE TO HAVE** | Track for later. Optimization ideas, future improvements. |

---

## 1. Architecture & Separation of Concerns

> **Goal:** Prevent monolithic growth. Each layer has a single responsibility.

### 1.1 Backend Layer Separation (P1)

```
Models → Services → Selectors → Views → Serializers
  ↑         ↑          ↑          ↑         ↑
 Data    Business    Queries    HTTP     Input/Output
 only     logic      only      only       only
```

- [ ] **Models** contain ONLY: fields, Meta, `__str__`, constraints, managers. No business logic, no queries beyond manager methods.
- [ ] **Services** contain ALL business logic. Functions use keyword-only arguments (`def create_thing(*, name, ...)`). Services call other services, never views.
- [ ] **Selectors** (if used) contain complex read queries. Simple reads can stay in views via queryset filters.
- [ ] **Views** contain ONLY: auth checks, serializer validation, calling services/selectors, returning responses. No business logic.
- [ ] **Serializers** use SEPARATE Input and Output serializer classes. Input serializers validate. Output serializers format.
- [ ] **No circular imports** between apps. If app A needs app B's logic, call B's service, not B's model directly (unless it's a FK relationship).
- [ ] **Integrations** (`apps/<app>/integrations/`) contain no Django ORM code. They are pure adapters to external systems.

### 1.2 Frontend Layer Separation (P1)

```
components/ui/  → Reusable, no business logic, props-driven
features/<name>/ → Feature-specific pages, hooks, API calls
lib/             → Shared utilities, API client, auth context
```

- [ ] **UI components** (`components/ui/`) are generic, reusable, and have zero business logic. They accept props and render UI.
- [ ] **Feature components** live in `features/<name>/` and can use UI components + feature-specific logic.
- [ ] **API calls** go through `lib/api-client.ts` or TanStack Query hooks. No raw `fetch` in components.
- [ ] **State management**: Zustand stores for global state. TanStack Query for server state. Local state for component state. No mixing.
- [ ] **No prop drilling** beyond 2 levels. Use context or Zustand for deeper data passing.

### 1.3 File Size Limits (P2)

- [ ] No single file exceeds **400 lines**. If it does, split into smaller modules.
- [ ] No single function exceeds **50 lines**. If it does, extract helper functions.
- [ ] No single React component exceeds **200 lines** (JSX included). Extract sub-components.

---

## 2. Security

> **Goal:** Prevent OWASP Top 10 vulnerabilities. Security is a P0 blocker.

### 2.1 Authentication & Authorization (P0)

- [ ] **Every endpoint** has explicit permission classes. No `AllowAny` unless intentionally public (guest forms).
- [ ] **Role-based access** verified: coordinators, compliance_officers, gestoras, directors, clients each see only what they should.
- [ ] **Object-level permissions**: Users can only access their own data. Clients can only see their own entities/tickets/documents.
- [ ] **JWT tokens** have appropriate expiry (access: 60min, refresh: 7 days).
- [ ] **Guest links** validate expiry and `is_active` on every access.
- [ ] **No privilege escalation**: A user cannot change their own role or access admin endpoints.

### 2.2 Input Validation (P0)

- [ ] **All user input** validated via DRF serializers before reaching services. No raw `request.data` in services.
- [ ] **File uploads** validate: file type (MIME + extension), file size limits, no path traversal in filenames.
- [ ] **JSON fields** (`JSONField`) have schema validation where applicable (not arbitrary blobs).
- [ ] **Query parameters** validated and typed. No raw string interpolation into queries.
- [ ] **IDs in URLs** are UUIDs — no sequential integer IDs that can be enumerated.

### 2.3 Injection Prevention (P0)

- [ ] **SQL injection**: All queries use ORM or parameterized queries. NEVER `raw()` with string concatenation. NEVER `.extra()` with user input.
- [ ] **XSS**: All React output is auto-escaped. No `dangerouslySetInnerHTML` unless sanitized with DOMPurify. AI assistant responses MUST be sanitized.
- [ ] **Template injection**: Document assembly templates never include raw user input in template logic (`{% %}`) — only in variable tags (`{{ }}`).
- [ ] **XML injection**: Aderant SOAP adapter uses zeep's built-in XML serialization. No manual XML string building.
- [ ] **Command injection**: No `subprocess`, `os.system`, or `eval()` with user-controlled input.
- [ ] **Email header injection**: Notification service validates email addresses, strips newlines from subject/headers.

### 2.4 Secrets & Configuration (P0)

- [ ] **No hardcoded secrets** in code — all in environment variables.
- [ ] **`.env` files** are in `.gitignore`.
- [ ] **API keys** for Aderant, World-Check, Claude, SharePoint are loaded from settings, not inline.
- [ ] **Mock mode** logs warnings but does not expose credentials or internal paths.
- [ ] **Error responses** do not leak stack traces, file paths, or database schema in production.

### 2.5 Rate Limiting (P1)

- [ ] **Public endpoints** (registration, guest forms, onboarding) have throttle rates.
- [ ] **AI endpoints** have per-user rate limits.
- [ ] **RPA trigger endpoints** have debouncing to prevent duplicate job creation.
- [ ] **Login endpoint** has rate limiting to prevent brute force.

---

## 3. Testing

> **Goal:** 80%+ service layer coverage. All endpoints tested. No untested happy paths.

### 3.1 Backend Tests (P1)

- [ ] **Every service function** has at least: 1 happy path test, 1 validation error test, 1 permission error test.
- [ ] **Every API endpoint** has at least: 1 happy path test, 1 unauthorized test, 1 forbidden (wrong role) test.
- [ ] **Model constraints** (unique_together, CheckConstraint) have tests verifying they raise errors.
- [ ] **Celery tasks** tested with `@override_settings(CELERY_TASK_ALWAYS_EAGER=True)`.
- [ ] **Integration adapters** tested against mock backends (Aderant, World-Check, etc.).
- [ ] **RPA jobs** tested end-to-end with mock Aderant responses for each step.
- [ ] **No test uses `print()`** — use pytest assertions.
- [ ] **Test data** uses factories (factory_boy) not fixtures. No hardcoded PKs.

### 3.2 Frontend Tests (P1)

- [ ] **Every UI component** in `components/ui/` has Vitest + Testing Library tests covering: default render, variants, user interaction, accessibility.
- [ ] **Critical user flows** have integration tests: login, KYC submission, ticket transition, guest form.
- [ ] **Form validation** tested: required fields, format validation, error display.
- [ ] **No snapshot tests** unless explicitly justified — they break too easily and test nothing meaningful.

### 3.3 Test Quality (P2)

- [ ] Tests are **independent** — no test depends on another test's state.
- [ ] Tests use **descriptive names**: `test_create_kyc_submission_with_missing_entity_raises_validation_error`.
- [ ] Tests **clean up** — no leftover files, database records, or Redis keys.
- [ ] **No flaky tests** — if a test fails intermittently, fix or quarantine it immediately.

---

## 4. Data Integrity

> **Goal:** No data corruption, no orphaned records, no constraint violations at runtime.

### 4.1 Database (P0)

- [ ] **Migrations** are reviewed for data safety — no destructive migrations without data migration steps.
- [ ] **Foreign keys** have appropriate `on_delete` behavior (CASCADE vs SET_NULL vs PROTECT). Verify each one.
- [ ] **Unique constraints** enforced at database level (not just application level).
- [ ] **CheckConstraints** used for XOR relationships (exactly one of A/B/C must be set).
- [ ] **No nullable fields** that should have defaults. Use `default=` instead of `null=True` when possible.
- [ ] **JSONField** schemas documented in model docstring or comments.
- [ ] **Decimal fields** for money — NEVER float. Use `DecimalField(max_digits=10, decimal_places=2)`.
- [ ] **Indexes** on frequently filtered/ordered fields (status, created_at, jurisdiction FK).

### 4.2 Transactions (P0)

- [ ] **State-changing operations** use `@transaction.atomic` or are wrapped in `with transaction.atomic():`.
- [ ] **Multi-model operations** (create ticket + log + sub-ticket) are atomic.
- [ ] **RPA jobs** handle partial failure — if step 3 of 5 fails, steps 1–2 are not rolled back (they're committed to Aderant). The job records which step failed.
- [ ] **Celery tasks** are idempotent — running the same task twice does not create duplicate data.

### 4.3 Audit Trail (P1)

- [ ] **All state changes** on compliance-critical models (KYC, risk assessments, tickets) are logged with who/when/what.
- [ ] **Entity and Person changes** use the existing `EntityAuditLog` / `PersonAuditLog` pattern.
- [ ] **RPA job steps** log input/output for every step.
- [ ] **Notification delivery** is logged with status + timestamp.

---

## 5. API Design

> **Goal:** Consistent, predictable, well-documented APIs.

### 5.1 REST Conventions (P1)

- [ ] **URL patterns**: `/api/<app>/<resource>/` (plural nouns). Actions as sub-paths: `/api/compliance/kyc/{id}/submit/`.
- [ ] **HTTP methods**: GET=read, POST=create/action, PATCH=partial update, DELETE=remove. No PUT unless full replacement.
- [ ] **Status codes**: 200=success, 201=created, 204=no content, 400=validation, 401=unauthorized, 403=forbidden, 404=not found, 429=rate limited, 500=server error.
- [ ] **Error responses** follow consistent format: `{"detail": "message"}` or `{"field_name": ["error1", "error2"]}`.
- [ ] **Pagination** on all list endpoints. Use `PageNumberPagination` with configurable page size.
- [ ] **Filtering** uses query parameters: `?status=active&jurisdiction=PA`. No request body for GET.
- [ ] **Ordering** uses `?ordering=-created_at`. Prefix `-` for descending.

### 5.2 Serializer Rules (P1)

- [ ] **Separate Input/Output serializers**: `KYCSubmissionInputSerializer` for POST/PATCH, `KYCSubmissionOutputSerializer` for GET responses.
- [ ] **No writable nested serializers** that bypass the service layer. Use separate endpoints for nested resources.
- [ ] **Sensitive fields** excluded from output serializers (passwords, API keys, internal IDs).
- [ ] **All serializers** have `@extend_schema` decorators for OpenAPI documentation.

### 5.3 API Documentation (P2)

- [ ] **Every endpoint** has an OpenAPI description, request body schema, and response schema.
- [ ] **Example values** provided for common fields.
- [ ] **Error responses** documented (400, 401, 403, 404).

---

## 6. Performance

> **Goal:** No N+1 queries, no unbounded queries, sub-second response times.

### 6.1 Database Queries (P1)

- [ ] **No N+1 queries**. Use `select_related()` for FK, `prefetch_related()` for reverse FK and M2M.
- [ ] **List endpoints** have query count assertions in tests: `with self.assertNumQueries(N):`.
- [ ] **No unbounded queries**. All list queries have limits (pagination or explicit `.[:1000]`).
- [ ] **Heavy aggregations** (risk calculation, ownership tree) are cached in Redis with TTL.
- [ ] **Bulk operations** use `bulk_create()` / `bulk_update()` instead of loops.

### 6.2 Frontend Performance (P2)

- [ ] **Lazy loading** for all route-level components (React.lazy + Suspense).
- [ ] **Memoization** for expensive computations (`useMemo`) and callbacks (`useCallback`) where warranted.
- [ ] **No unnecessary re-renders** — check with React DevTools Profiler.
- [ ] **Images** optimized and lazy-loaded.
- [ ] **Bundle size** monitored — no single chunk >250KB gzipped.

### 6.3 Celery Performance (P2)

- [ ] **Long-running tasks** have progress tracking (update task state).
- [ ] **Task timeouts** configured — no infinite-running tasks.
- [ ] **Queue separation**: default queue for general tasks, `rpa` queue for Aderant operations.
- [ ] **No heavy computation** in task dispatch (the task body, not the `.delay()` call).

---

## 7. Error Handling

> **Goal:** Graceful degradation, actionable error messages, no silent failures.

### 7.1 Backend Error Handling (P1)

- [ ] **Service functions** raise specific exceptions (e.g., `KYCNotFoundError`, `AderantConnectionError`), not generic `Exception`.
- [ ] **Views** catch service exceptions and return appropriate HTTP status codes with clear messages.
- [ ] **Integration failures** (Aderant down, World-Check timeout) are caught, logged, and surface a user-friendly error. They do NOT crash the request.
- [ ] **Celery task failures** are logged with full context (job_id, step, input data). Failed tasks are retried with exponential backoff.
- [ ] **No bare `except:`** — always catch specific exceptions.
- [ ] **Logging** uses structured logging with context (user_id, entity_id, action).

### 7.2 Frontend Error Handling (P1)

- [ ] **API errors** handled by a global error handler in the API client. Specific errors caught in components.
- [ ] **Error boundaries** at route level to prevent full-page crashes.
- [ ] **Form errors** display inline next to the relevant field.
- [ ] **Network errors** show a user-friendly message with retry option.
- [ ] **Loading states** for all async operations — no blank screens while waiting.
- [ ] **Optimistic updates** (if used) have rollback on server error.

---

## 8. Code Quality

> **Goal:** Readable, maintainable, consistent code.

### 8.1 Python (P2)

- [ ] **Type hints** on all service function signatures (arguments + return type).
- [ ] **Docstrings** on all public service functions (one-line summary sufficient).
- [ ] **No magic numbers** — use constants or model choices.
- [ ] **Consistent naming**: `snake_case` for everything Python. Model names `PascalCase`.
- [ ] **No dead code** — remove commented-out code, unused imports, unused variables.
- [ ] **Imports** organized: stdlib → third-party → Django → local apps.

### 8.2 TypeScript / React (P2)

- [ ] **TypeScript strict mode** — no `any` types unless explicitly justified and commented.
- [ ] **Interface/type definitions** for all API responses and component props.
- [ ] **Consistent naming**: `PascalCase` for components/types, `camelCase` for variables/functions, `SCREAMING_SNAKE` for constants.
- [ ] **No inline styles** — use Tailwind classes.
- [ ] **No dead code**.
- [ ] **Imports** organized: React → third-party → local (enforce with ESLint import/order).

### 8.3 Consistency (P2)

- [ ] **No mixed patterns** — if one service uses `keyword-only args`, all do. If one view uses `@extend_schema`, all do.
- [ ] **New code follows existing patterns** — check 2–3 existing examples before writing new code.
- [ ] **i18n**: ALL user-facing strings go through translation (`t()` in frontend, `_()` or `gettext` in backend).

---

## 9. Integration-Specific Rules

> **Goal:** Integrations are isolated, mockable, and don't leak into business logic.

### 9.1 Aderant SOAP Adapter (P0)

- [ ] **No raw XML string building** — use zeep's typed objects.
- [ ] **Authentication tokens** refreshed automatically before expiry.
- [ ] **Timeouts** configured on all SOAP calls (30 second max).
- [ ] **Mock mode** returns realistic data structures that match the real API shape.
- [ ] **Error mapping**: SOAP faults mapped to specific Python exceptions (not generic).
- [ ] **No Aderant-specific logic** outside `integrations/aderant_soap/`. Services call the harness, not SOAP directly.
- [ ] **Pydantic models** validate all data coming from Aderant before it enters the application.

### 9.2 RPA Jobs (P0)

- [ ] **Idempotency**: Every step checks if its work was already done before executing. Re-running a completed step is a no-op.
- [ ] **Step-level failure**: If step 3 fails, steps 1–2 remain committed. The job records `current_step=3` and `status=failed`.
- [ ] **Retry safety**: Retrying a failed job picks up from the failed step, not from the beginning.
- [ ] **Concurrency**: Only one RPA job can execute at a time per Aderant instance (single-concurrency queue).
- [ ] **Timeouts**: Each step has a timeout. A hung Aderant call doesn't block the queue forever.

### 9.3 Notification Service (P1)

- [ ] **Template variables** are HTML-escaped before injection into email templates.
- [ ] **Reminder campaigns** have deduplication — don't send the same reminder twice.
- [ ] **Unsubscribe** (if applicable) honored before sending.
- [ ] **Delivery failures** logged and surfaced in admin.
- [ ] **Rate limiting** on outbound emails to prevent spam classification.

### 9.4 Document Assembly (P1)

- [ ] **Template variables** are validated before injection — missing variables raise errors, not empty strings.
- [ ] **File paths** for generated documents use UUID-based names — no user-controlled filenames.
- [ ] **Gotenberg calls** have timeouts — don't hang on PDF conversion.
- [ ] **Generated documents** are stored in the storage backend, not left in temp directories.
- [ ] **Template files** (.docx) are versioned — old templates are kept when updated.

---

## 10. Design System Compliance

> **Goal:** Strict adherence to ARIFA UI Standards v1.0.0.

### 10.1 Visual Compliance (P1)

- [ ] **Color palette**: Only colors from the defined palette used. No arbitrary hex values.
- [ ] **Typography**: Roboto font only. Sizes match the scale (12/14/16/20/24/32).
- [ ] **Spacing**: Only 8px grid values used (4, 8, 12, 16, 24, 32, 48, 64, 96).
- [ ] **Border radius**: Only defined tokens used (4/8/12/16).
- [ ] **Shadows**: Only defined elevation levels used.

### 10.2 Component Usage (P1)

- [ ] **No custom buttons** — use the `Button` component from `components/ui/`.
- [ ] **No custom inputs** — use `Input`, `Select`, `Textarea`, etc. from the design system.
- [ ] **No custom modals** — use the `Modal` component.
- [ ] **No custom tables** — use the `Table` component.
- [ ] **All forms** use the design system form components with proper labels, helpers, and error states.

### 10.3 Accessibility (P2)

- [ ] **All interactive elements** have keyboard access (tab, enter, escape).
- [ ] **All form fields** have associated `<label>` elements.
- [ ] **All images** have `alt` text.
- [ ] **Color contrast** meets WCAG AA (4.5:1 for text, 3:1 for large text).
- [ ] **Focus indicators** visible on all interactive elements.
- [ ] **ARIA attributes** used where native HTML semantics are insufficient.

### 10.4 Responsive & Dark Mode (P2)

- [ ] **All pages** functional at 320px width.
- [ ] **Touch targets** minimum 44px on mobile.
- [ ] **All components** render correctly in dark mode.
- [ ] **No hardcoded colors** — use Tailwind theme variables that respect dark mode.

---

## 11. Git & Workflow Rules

### 11.1 Commits (P2)

- [ ] **Commits are atomic** — one logical change per commit.
- [ ] **Commit messages** follow: `<type>: <description>` (feat, fix, refactor, test, docs, chore).
- [ ] **No generated files** committed (node_modules, __pycache__, .pyc, dist/).
- [ ] **No secrets** in commit history.

### 11.2 Branch Strategy (P2)

- [ ] **Feature branches** named: `feature/<phase>-<short-description>` (e.g., `feature/p2-multi-workflow-engine`).
- [ ] **Each phase section** is a separate branch merged to main after code review.

---

## Review Checklist Template

Copy this template for each `CODE REVIEW` checkpoint:

```markdown
### CODE REVIEW: [Task Group Name]
**Date:** YYYY-MM-DD
**Reviewer:** [Name]
**Branch:** feature/...

#### Checklist
- [ ] Architecture: layer separation correct
- [ ] Security: no vulnerabilities introduced
- [ ] Tests: all new code has tests, all pass
- [ ] Data: migrations safe, constraints correct
- [ ] API: consistent patterns, documented
- [ ] Performance: no N+1, no unbounded queries
- [ ] Errors: graceful handling, no silent failures
- [ ] Code quality: types, naming, no dead code
- [ ] Design system: compliant (frontend tasks)
- [ ] i18n: all strings translatable

#### Issues Found
| # | Severity | Description | Status |
|---|----------|-------------|--------|
| 1 | P0 | ... | Fixed |

#### Verdict
- [ ] APPROVED — merge to main
- [ ] APPROVED WITH CONDITIONS — fix P2s before next review
- [ ] CHANGES REQUESTED — fix P0/P1s, re-review required
```
