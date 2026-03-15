# ARIFA Platform — User Stories & Feature Tracker

> Auto-updated as features are completed. Each story includes a brief testing/usage guide.

---

## Phase 1 — Foundation (COMPLETE)

### 1.1 Authentication & User Management
| # | Story | Status |
|---|-------|--------|
| 1.1.1 | As an admin, I can create users with roles (coordinator, compliance_officer, gestora, director, client) | Done |
| 1.1.2 | As a user, I can log in with email/password and receive JWT tokens | Done |
| 1.1.3 | As a client, I can log in via the client portal login page | Done |
| 1.1.4 | As a user, my session auto-refreshes via silent token refresh | Done |
| 1.1.5 | As an admin, I can generate guest links (30-day UUID tokens) for external forms | Done |

**How to test:** Navigate to `/login` for staff, `/client-login` for clients. JWT tokens stored in memory, CSRF cookie for refresh. Guest links at `/guest/:token`.

### 1.2 Client & Entity Management
| # | Story | Status |
|---|-------|--------|
| 1.2.1 | As a coordinator, I can create and manage clients (name, type, category, status) | Done |
| 1.2.2 | As a coordinator, I can create entities under clients (name, jurisdiction, incorporation date) | Done |
| 1.2.3 | As a coordinator, I can create matters linked to clients/entities | Done |
| 1.2.4 | As a coordinator, I can manage people (natural/corporate, nationality, PEP status) | Done |
| 1.2.5 | As a coordinator, I can manage client contacts with portal access | Done |

**How to test:** `/clients` list page, click "New Client". `/entities` for entity management. `/people` for person records. Each has detail pages with tabs.

### 1.3 Workflow Engine (Basic)
| # | Story | Status |
|---|-------|--------|
| 1.3.1 | As a coordinator, I can create tickets assigned to clients | Done |
| 1.3.2 | As a user, I can transition tickets between workflow states | Done |
| 1.3.3 | As a user, I can view the kanban board with drag-and-drop | Done |
| 1.3.4 | As a user, I can view ticket timeline/audit log | Done |
| 1.3.5 | As a user, I can assign tickets to team members | Done |

**How to test:** `/tickets` for list view, kanban board on dashboard. Drag cards between columns to transition. Click card to see detail + timeline.

### 1.4 KYC & Compliance (Basic)
| # | Story | Status |
|---|-------|--------|
| 1.4.1 | As a coordinator, I can create KYC submissions linked to tickets | Done |
| 1.4.2 | As a compliance officer, I can review KYC submissions | Done |
| 1.4.3 | As a compliance officer, I can send RFIs (Requests for Information) | Done |
| 1.4.4 | As a compliance officer, I can approve/reject KYC submissions | Done |
| 1.4.5 | As a user, I can view risk assessments with breakdown scores | Done |

**How to test:** `/kyc` list, `/kyc/new` to create. Compliance queue at `/compliance`. Risk scores auto-calculate.

### 1.5 Document Management
| # | Story | Status |
|---|-------|--------|
| 1.5.1 | As a user, I can upload documents with type classification | Done |
| 1.5.2 | As a user, I can view uploaded documents per KYC submission | Done |
| 1.5.3 | As a user, I can manage document templates | Done |

**How to test:** Document tab on KYC detail page, `/documents` for templates.

### 1.6 Dashboard & Navigation
| # | Story | Status |
|---|-------|--------|
| 1.6.1 | As a user, I see a dashboard with stat cards and activity feed | Done |
| 1.6.2 | As a user, I can navigate via sidebar with role-based menu items | Done |
| 1.6.3 | As a user, I can switch between Spanish and English | Done |

**How to test:** Dashboard is the landing page `/`. Sidebar collapses on mobile. Language toggle in sidebar footer.

### 1.7 Guest Intake
| # | Story | Status |
|---|-------|--------|
| 1.7.1 | As a guest, I can fill out entity onboarding forms via guest links | Done |
| 1.7.2 | As a guest, I can submit accounting records (Registros Contables) via guest links | Done |

**How to test:** Generate guest link from admin, open `/guest/:token`. Multi-step form with validation.

---

## Phase 2 — Core Infrastructure (COMPLETE)

### Sprint 2A — Code Debt Resolution (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 2A.1 | Service layer refactoring: all 13 ViewSet update operations use service functions | Done |
| 2A.2 | i18n: All UI components use `useTranslation()`, ~15 new translation keys | Done |
| 2A.3 | Accessibility: aria-labels on Modal, Sidebar, AI toggle, MultiSelect | Done |
| 2A.4 | Backend schema: `@extend_schema_view` decorators on all ViewSets | Done |
| 2A.5 | Auth hardening: `credentials: "include"` on refresh, typed ApiError | Done |
| 2A.6 | Frontend test suite: vitest config, component tests, API client tests | Done |

**How to test:** Run `npx vitest run` in frontend. Backend schema at `/api/docs/`. Service layer verified via API calls.

### Sprint 2B — Foundation Layer (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 2B.1 | File storage abstraction: LocalFileStorage + SharePointFileStorage with auto-detect | Done |
| 2B.2 | Jurisdiction configuration: Per-jurisdiction settings (UBO threshold, requirements, KYC renewal) | Done |
| 2B.3 | Seed jurisdiction configs: Panama, BVI, Belize, Bahamas pre-configured | Done |
| 2B.4 | Admin jurisdiction editor: Card-based UI to manage jurisdiction settings | Done |
| 2B.5 | Docker: celery-rpa worker service added (dedicated queue, concurrency=1) | Done |

**How to test:** Admin page → Jurisdictions tab shows config cards. `python manage.py seed_jurisdiction_configs` seeds data. Docker: `docker-compose up` starts 8+ services.

### Sprint 2C — Multi-Workflow Engine (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 2C.1 | WorkflowDefinition model: 11 workflow types with category, jurisdiction support | Done |
| 2C.2 | Seed workflows: INC_PANAMA (8 states), INC_BVI (6), DOC_PROCESSING (5), etc. | Done |
| 2C.3 | Clone workflow: POST `/definitions/{id}/clone/` duplicates with all states/transitions | Done |
| 2C.4 | Sub-tickets: POST `/tickets/{id}/spawn-sub-ticket/` creates child tickets | Done |
| 2C.5 | Bulk transition: POST `/tickets/bulk-transition/` moves multiple tickets at once | Done |
| 2C.6 | Auto-assign: Assigns ticket to least-loaded user | Done |
| 2C.7 | Kanban: Workflow definition selector dropdown filters board | Done |
| 2C.8 | Kanban: Column headers with state color accents | Done |
| 2C.9 | Kanban: Bulk selection toolbar for batch transitions | Done |
| 2C.10 | Kanban: Workflow definition badge on ticket cards | Done |
| 2C.11 | Ticket create modal: Workflow definition selector | Done |

**How to test:** Kanban board now shows a workflow dropdown at top. Select a workflow to filter states/tickets. Use checkboxes on cards for bulk selection → pick target state → "Move". Create ticket modal has workflow selector. `python manage.py seed_workflows` seeds all 11 definitions.

### Sprint 2D — Aderant SOAP + RPA Engine (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 2D.1 | Aderant SOAP adapter: zeep client with NTLM auth, mock fallback | Done |
| 2D.2 | Aderant services: file opening, billing, time entry, inquiries | Done |
| 2D.3 | RPA app: RPAJobDefinition, RPAJob, RPAJobStep models | Done |
| 2D.4 | RPA executor: Execute, pause, resume, retry, cancel job operations | Done |
| 2D.5 | RPA Celery task: `execute_rpa_job` on dedicated `rpa` queue | Done |
| 2D.6 | Seed RPA definitions: 10 job templates (INC_CREATE_CLIENT, etc.) | Done |
| 2D.7 | RPA API: CRUD + action endpoints for definitions and jobs | Done |
| 2D.8 | RPA frontend: Job list page with status filters | Done |
| 2D.9 | RPA frontend: Job detail page with step progress timeline | Done |
| 2D.10 | Integration status: Aderant SOAP status endpoint | Done |

**How to test:** Navigate to `/admin/rpa-jobs` for the job list. Filter by status using the dropdown. Click a job to see the detail page with step-by-step timeline. Actions: Pause/Resume/Retry/Cancel buttons appear based on job status. Backend: `python manage.py seed_rpa_definitions` seeds 10 job templates. POST to `/api/v1/rpa/jobs/` to create and auto-start a job. The AderantHarness uses mock data when SOAP is not configured (check integration status at `/api/v1/auth/integration-status/`).

### Sprint 2E — Notification Service (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 2E.1 | Notification models: Template, Notification, Preference, ReminderCampaign, DeliveryLog | Done |
| 2E.2 | Send notification service: in-app + email channels with template rendering | Done |
| 2E.3 | Celery tasks: async send, process reminders (15min), daily digest (hourly check) | Done |
| 2E.4 | Signal handlers: auto-notify on ticket change, KYC submit/approve/reject, RFI, risk alerts, RPA job complete | Done |
| 2E.5 | Seed templates: 30+ notification templates (ticket, kyc, compliance, rpa, delegation, system) | Done |
| 2E.6 | Notification bell: Topbar bell icon with unread count badge (polls every 30s) | Done |
| 2E.7 | Notification panel: Dropdown list with mark-as-read, category icons, priority dots | Done |
| 2E.8 | Notification preferences: Per-category channel settings page at `/settings/notifications` | Done |
| 2E.9 | Reminder campaigns: Multi-step reminders with configurable delays via Celery Beat | Done |

**How to test:** The bell icon appears in the top bar on all pages. Click the bell to see notifications — each has a category icon and priority color dot. Click "Mark all read" to clear unread. Navigate to `/settings/notifications` to configure per-category channel preferences (both/in-app/email/none) and enable/disable daily digest with configurable hour. Backend: `python manage.py seed_notification_templates` seeds 30+ templates. Signal-driven notifications fire automatically on ticket transitions, KYC status changes, RFI creation, high-risk assessments, and RPA job completion.

### Sprint 2F — Delegation (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 2F.1 | ComplianceDelegation model: delegate entity modules (accounting/ES/KYC) to external users | Done |
| 2F.2 | Delegation services: delegate, revoke (with auth check), accept (email verification), auto-accept on login | Done |
| 2F.3 | Delegation API: list/create, revoke, accept endpoints with scoped queryset | Done |
| 2F.4 | Delegation UI: Modal to create + list with accept/revoke actions | Done |

**How to test:** On entity detail page, open the delegation modal to invite an external user by email for a specific module (accounting_records, economic_substance, kyc) and fiscal year. The delegation list shows status badges (pending/accepted/revoked) with action buttons. Delegates can accept pending delegations. Only the creator or a director can revoke. Auto-accept matches email on login. Backend: `POST /api/v1/compliance/delegations/` to create, `POST /delegations/{id}/accept/` to accept, `POST /delegations/{id}/revoke/` to revoke.

---

## Phase 3A — Document Generation (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 3A.1 | Document template engine: upload DOCX templates, Jinja2 variable substitution via docxtpl | Done |
| 3A.2 | PDF conversion: Async DOCX→PDF via Gotenberg (LibreOffice route) with retry logic | Done |
| 3A.3 | HTML→PDF conversion: Gotenberg Chromium route with A4 page formatting | Done |
| 3A.4 | Download: Authenticated file downloads via FileResponse | Done |
| 3A.5 | SharePoint integration: Async upload with OAuth2 client credentials, file ID tracking | Done |
| 3A.6 | Template management UI: Upload DOCX, filter by entity type/jurisdiction, toggle active | Done |
| 3A.7 | Document generation UI: Select template, add context fields, generate + download | Done |
| 3A.8 | Generated documents list: Filter by ticket, convert to PDF, download buttons | Done |
| 3A.9 | KYC documents tab: Upload, extraction status tracking, delete with confirmation | Done |

**How to test:** Navigate to `/documents` for the tabbed interface — Templates, Generate, Generated, KYC Documents. Upload a DOCX template in the Templates tab. In Generate tab, select a template, add context fields (key/value pairs), and click Generate to create a DOCX. Click "Convert to PDF" to dispatch async Gotenberg conversion. Download links appear for both formats. The KYC tab integrates with compliance documents. Docker: Gotenberg runs at port 3000 (`gotenberg/gotenberg:8`). SharePoint uploads require `SHAREPOINT_*` environment variables.

---

## Phase 3B — Compliance Platform v2 (IN PROGRESS — 82/102 done, 20 pending are tests/code reviews)

### KYC Enhancements (5/8 done, 3 pending: OCR, tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.1 | DueDiligenceChecklist model, World-Check trigger + mock harness, field_comments threading, KYC renewal task | Done |
| 3B.2 | KYC Form multi-step wizard with Stepper, DD Dashboard with KPIs/filters/bulk delegation | Done |
| 3B.3 | Party Management UI with World-Check badges, Document Upload with drag-drop/expiry warnings | Done |
| 3B.4 | Review & Approve with side-by-side diff, field-level comments, actions | Done |
| 3B.5 | Guest Form overhaul with new design system, save-as-draft, progress | Done |
| 3B.6 | Passport expiry validation (Foundry OCR) | Pending |
| 3B.7 | Tests + code review for KYC module | Pending |

**How to test:** `/kyc` list page → click "New" for multi-step wizard. Each step uses Stepper nav. Party tab shows World-Check screening badges (green/yellow/red). Document upload supports drag-drop with auto-type detection. Review panel shows side-by-side data with inline comments. Guest form at `/guest/:token` shows progress bar and save-as-draft.

### Economic Substance Module (11/13 done, 2 pending: tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.8 | ES backend: model, services (create/save_draft/advance_step/submit/approve/reject), flow engine, guest link support, API endpoints, workflow wiring | Done |
| 3B.9 | ES frontend: config-driven question renderer, activity selection, branching screens, shareholders list management | Done |
| 3B.10 | Auto-save with debounce, page instructions side panel, review & submit accordion, attention screens | Done |
| 3B.11 | Guest form for ES, ES/EN localization for all question texts | Done |
| 3B.12 | Need Help button integration into ES pages (`help-button.tsx` with ES/KYC/AR modules) | Done |
| 3B.13 | Auto-notification on attention path, PDF generation on completion, delegation support (wired via notification signals + ComplianceDelegation model) | Done |
| 3B.14 | Tests + code review for ES module | Pending |

**How to test:** Navigate to `/economic-substance` for submissions list. Create new → config-driven flow reads from `JurisdictionConfig.es_flow_config`. Select relevant activities → branching questions (yes/no, country select). Auto-save debounces changes. Side panel shows step-specific instructions. Review & Submit shows accordion summary. "Attention" paths redirect to dashboard with "In Review" status. Guest form at `/economic-substance/guest/:token`. Toggle language to verify ES/EN.

### Shareholders Calculator (17/19 done, 2 pending: tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.15 | Backend: configurable thresholds (jurisdiction-based), exception flags, multi-level ownership, soft validation, audit logging | Done |
| 3B.16 | Frontend: React Flow organigram with custom nodes/edges, add/edit/delete shareholders, multi-level expansion, analyze/clear/save/print | Done |
| 3B.17 | Frontend: accessible controls, disabled states, tooltips, jurisdiction threshold switcher, KYC integration | Done |
| 3B.18 | Tests + code review | Pending |

**How to test:** Open `/shareholders-calculator/{entity_id}` (or from KYC Step 4 "Open Calculator" button). Entity principal is anchored at top. Click '+' to add shareholders (Natural/Legal, percentage, exception type for Legal). Legal nodes expand with '+' for sub-shareholders. Click "Identify and Analyze" → reportable UBOs highlighted green with header list. "Clear Diagram" with confirmation. Change jurisdiction threshold dropdown → recalculation. Save → verify audit log. Back button returns to KYC.

### Risk Matrix (7/9 done, 2 pending: tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.19 | Backend: frequency-based recalculation (Celery Beat), batch recalculation, Gotenberg PDF export | Done |
| 3B.20 | Frontend: Risk Matrix Config visual editor, Risk Dashboard (charts, high-risk list, recent changes) | Done |
| 3B.21 | Frontend: Risk Assessment Detail page (factor breakdown, triggered rules, history) — `risk-assessment-detail-page.tsx` exists and routed | Done |
| 3B.22 | Frontend: Entity Risk Badge across all entity views — wired on entity detail + list via `risk-profile-tab.tsx` | Done |
| 3B.23 | Tests + code review | Pending |

**How to test:** `/compliance/risk-matrix` for config list → click config to edit factors/weights/triggers visually. `/compliance/risk-dashboard` shows distribution chart, high-risk entity list, recent risk changes. `/compliance/risk-assessments/:id` for detail with factor breakdown. Risk badges appear on entity detail pages.

### Accounting Records (14/16 done, 2 pending: tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.24 | Backend: method selection (upload/seven_steps), upload path, seven steps data model, exempted company support, PDF generation, email confirmation, delegation | Done |
| 3B.25 | Frontend: method selection screen, upload path UI, seven steps wizard (7 steps, balance sheet, expandable sections, FAQ, instructions panel, subtotal auto-calc) | Done |
| 3B.26 | Frontend: save for later, print option, dashboard status logic, admin bulk-creation | Done |
| 3B.27 | Tests + code review | Pending |

**How to test:** `/registros-contables` for list → create new → method selector (Upload Information vs Seven Steps). Upload path: drag-drop file zone, optional password, review & submit. Seven Steps: 7-step wizard with balance sheet display, expandable sections from Step 4, FAQ link, instructions side panel, subtotal auto-calc. "Save for later" button preserves progress. Print option on completion. Guest form at `/registros-contables/guest/:token`. Admin → bulk create for fiscal year.

### Compliance Dashboard (4/6 done, 2 pending: tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.28 | KPI cards (total entities, pending KYC/ES/AR, high-risk, overdue) + entity filtering (PEP, risk, jurisdiction, type, status, officer) | Done |
| 3B.29 | Calendar view for upcoming compliance deadlines — `compliance-calendar.tsx` integrated into overview page | Done |
| 3B.30 | CSV/Excel export — client-side CSV from compliance overview, risk dashboard, DD dashboard | Done |
| 3B.31 | Tests + code review | Pending |

**How to test:** `/compliance/overview` shows KPI stat cards, calendar with colored deadline dots, and entity data table. Filter bar supports PEP flag, risk level, jurisdiction, entity type, status, assigned officer. CSV export button on overview, risk dashboard, and DD dashboard pages.

### Need Help Button (5/7 done, 2 pending: tests, code review)
| # | Story | Status |
|---|-------|--------|
| 3B.32 | Backend: `request_help()` service with 12/hour throttle, `POST /compliance/help-request/`, supports auth + guest | Done |
| 3B.33 | Frontend: floating `help-button.tsx` with modal form, integrated into ES, KYC, and Registros Contables pages | Done |
| 3B.34 | Tests + code review | Pending |

**How to test:** Floating "Need Help?" button appears on KYC, Economic Substance, and Registros Contables pages. Click opens modal with optional message field. Backend: `POST /api/v1/compliance/help-request/` with `{"message": "...", "module": "kyc"}`. Works for authenticated users and guests. Throttled to 12 requests/hour.

### Compliance Page Redesign (4/5 done)
| # | Story | Status |
|---|-------|--------|
| 3B.35 | Redesigned compliance list, KYC detail, risk matrix config, snapshots pages with new design system | Done |
| 3B.36 | Code review for redesigned pages | Pending |

**How to test:** Navigate to each compliance page — `/compliance`, `/kyc/:id`, `/compliance/risk-matrix/:id`, `/compliance/snapshots`. Verify new Card/Badge/Button components from design system. Consistent spacing, colors, and typography.

---

## Phase 4 — Client Services Platform & INC Workflow (83/86 done, 3 test tasks pending)

### 4A — Admin UI (from earlier sprint)

| # | Story | Status |
|---|-------|--------|
| 4A.1 | Admin notification templates tab: View templates grouped by category with status badges | Done |
| 4A.2 | Admin system settings: Integration status, system info, quick links | Done |
| 4A.3 | Admin user management: Create/edit users, role assignment | Done |
| 4A.4 | Admin workflow config: Manage workflow states and transitions | Done |
| 4A.5 | Admin jurisdiction config: Manage per-jurisdiction settings with card-based UI | Done |

### 4B — Services Platform & Quotation Engine

| # | Story | Status |
|---|-------|--------|
| 4B.1 | As a coordinator, I can browse a service catalog with pricing rules per jurisdiction and client category | Done |
| 4B.2 | As a coordinator, I can create a service request selecting services + jurisdiction, with auto-quotation | Done |
| 4B.3 | As a coordinator, I can view quotation details with subtotal/discount/total per client category | Done |
| 4B.4 | As a coordinator, I can generate a proforma PDF from a quotation | Done |
| 4B.5 | As a client, I can view and accept/reject quotations via the portal | Done |
| 4B.6 | As a coordinator, I can track expenses per entity with real-time totals | Done |
| 4B.7 | As a director, I can manage notary deed pools (bulk create, assign, deplete) | Done |

**How to test:** `/services` for service requests. Select jurisdiction and services to auto-calculate quotation. `/services/quotations/:id` for quote detail with price breakdown. `/services/expenses` for expense tracker. Backend: `POST /api/v1/services/service-requests/` auto-creates quotation with pricing rules applied.

### 4C — Document Assembly Engine

| # | Story | Status |
|---|-------|--------|
| 4C.1 | As a system, I can assemble corporate documents from templates using a builder registry | Done |
| 4C.2 | As a gestora, Panama documents are auto-generated: Pacto Social, Protocolo, Caratula, Share Certificate, Share Register, Power of Attorney, Director Resignation, Cover Letter | Done |
| 4C.3 | As a gestora, BVI documents are auto-generated: Memorandum, Articles, Share Certificate | Done |
| 4C.4 | As a system, assembled documents are converted to PDF via Gotenberg | Done |

**How to test:** `POST /api/v1/documents/assemble/` with `{"entity_id": "...", "document_type": "panama_pacto_social"}`. Returns assembled document. Document builders at `backend/apps/documents/builders/`.

### 4D — INC Workflow Automation

| # | Story | Status |
|---|-------|--------|
| 4D.1 | As a system, risk assessment is auto-triggered when INC ticket enters KYC Review (Panama, BVI, Digital) | Done |
| 4D.2 | As a system, gestora is auto-assigned (least-loaded) when INC ticket enters Drafting | Done |
| 4D.3 | As a system, notary deed is auto-assigned when INC ticket enters Notary stage | Done |
| 4D.4 | As a system, LEGAL_SUPPORT sub-ticket is auto-created when INC ticket enters Notary | Done |
| 4D.5 | As a system, PUBLIC_REGISTRY sub-ticket is auto-created at Public Registry stage | Done |
| 4D.6 | As a system, RPA jobs are dispatched for NIT/RUC registration and Aderant file opening | Done |
| 4D.7 | As a system, entity status is set to active and ARCHIVE sub-ticket created on completion | Done |
| 4D.8 | As a system, high-capital incorporations are flagged and alert notifications sent | Done |
| 4D.9 | As a system, delayed notary (>24h) and registry (>48h) processes trigger alert notifications | Done |
| 4D.10 | As a system, AM/PM batch accounting notifications are sent for pending expenses | Done |
| 4D.11 | As a system, unfactured incorporation alerts are sent for completed tickets without invoicing | Done |

**How to test:** Automation handlers in `backend/apps/workflow/automation.py`. Triggered via notification signal when `TicketLog` is created. Celery Beat tasks in `backend/apps/workflow/tasks.py` for periodic checks.

### 4E — INC Workflow Frontend

| # | Story | Status |
|---|-------|--------|
| 4E.1 | As a director, I can view the incorporation dashboard with metrics, stage distribution chart, and filters | Done |
| 4E.2 | As a gestora, I can use the gestora dashboard to manage DOC_PROCESSING tickets | Done |
| 4E.3 | As a coordinator, I can record payments and track payment status per service request | Done |
| 4E.4 | As a coordinator, I can see high-capital badges on kanban cards | Done |
| 4E.5 | As a director, I can view incorporation reports with commission and expense breakdowns | Done |
| 4E.6 | As a director, I can export incorporation reports to CSV | Done |

**How to test:** `/incorporation` for dashboard with KPIs and charts. `/gestora` for gestora-specific view. `/incorporation/payments` for payment tracking. `/incorporation/reports` for reports.

### 4F — BVI Adaptation

| # | Story | Status |
|---|-------|--------|
| 4F.1 | As a system, BVI M&A/COI stage triggers document assembly (Memorandum, Articles) | Done |
| 4F.2 | As a system, BVI Client Signing stage sends signing reminders (5d/3d/2d) | Done |
| 4F.3 | As a system, BVI ROD/ROM/ROB stage triggers register filings | Done |
| 4F.4 | As a system, BVI completion activates entity and creates ARCHIVE sub-ticket | Done |
| 4F.5 | BVI jurisdiction config seeded (UBO=10%, no notary/registry/NIT/RBUF, ES=Yes) | Done |

**How to test:** Automation handlers in `automation.py` for INC_BVI workflow. BVI jurisdiction config in `seed_jurisdiction_configs` command.

### 4G — Digital Notary Path (Panama)

| # | Story | Status |
|---|-------|--------|
| 4G.1 | As a coordinator, I can select INC_PANAMA_DIGITAL workflow for digital notary incorporations | Done |
| 4G.2 | As a system, digital notary path skips Notary + Public Registry stages | Done |
| 4G.3 | As a system, digital path triggers doc assembly at Documentation stage | Done |
| 4G.4 | As a system, digital path dispatches NIT/RUC RPA and finalizes same as traditional | Done |

**How to test:** Create ticket with `workflow_definition` set to INC_PANAMA_DIGITAL. Handlers in `automation.py` skip Notary/Registry and go directly to Documentation → NIT/RUC → Completed.

### 4H — Client Portal Enhancements (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 4H.1 | As a client, I can see all my entities with status badges | Done |
| 4H.2 | As a client, I can view entity detail with documents, compliance, and renewals tabs | Done |
| 4H.3 | As a client, I can download documents from the entity document library | Done |
| 4H.4 | As a client, I can track my service requests in real-time | Done |
| 4H.5 | As a client, I can view and manage in-app notifications | Done |
| 4H.6 | As a client, I can manage my profile and notification preferences | Done |

**How to test:** `/portal/entities` for entity list with search and status/risk badges. `/portal/entities/:id` for detail with Info, Documents, and Renewals tabs. `/portal/services` for service request tracking with status badges. `/portal/notifications` for notification center with mark-read and mark-all-read. `/portal/profile` for profile editing, password change, and notification preference toggles. Portal sidebar now shows nav links for all sections.

### 4I — Courier & Archive (COMPLETE)

| # | Story | Status |
|---|-------|--------|
| 4I.1 | As a coordinator, I can track courier dispatches with tracking numbers and dates | Done |
| 4I.2 | As a coordinator, I can view the ARCHIVE board | Done |
| 4I.3 | As a director, I can generate batch dispatch reports filtered by date range | Done |

**How to test:** `/archive` for the courier/archive page with two tabs. "Archive" tab shows DataTable of archive tickets with entity name, status badges, tracking number, courier service, dispatch date, and transition actions. "Dispatch Report" tab renders batch dispatch report with date range filter and CSV export. Navigation sidebar shows "Archive" link.

---

## Code Review & Fixes Log

### Sprint 2E Fixes (Code Review)
- **CRITICAL**: Fixed URL routing — `templates` prefix now registered before `""` to prevent shadowing
- **CRITICAL**: Fixed `instance.entity_name` → `instance.entity.name` in risk assessment signal handler
- **HIGH**: Fixed nullable `new_state` access — added `if instance.new_state` guard
- **HIGH**: Moved SMTP call outside `@transaction.atomic` to prevent DB connection holding
- **HIGH**: Added `created` check to RPA job signal to prevent duplicate notifications on every save
- **MEDIUM**: Added KYC approved/rejected notification dispatch (was only handling `submitted`)
- **MEDIUM**: Added `IsDirector` permission to `NotificationTemplateViewSet` (was open to all users)
- **MEDIUM**: Added safe `KeyError` handling in template rendering with fallback
- **MEDIUM**: Fixed `mark_all_as_read` to include `updated_at` in bulk update
- **MEDIUM**: Fixed `context={}` falsy check — now uses `if template is not None`
- **LOW**: Removed unused `from django.template import engines` import

### Sprint 2F Fixes (Code Review)
- **HIGH**: Fixed `recipient_email` → `recipient` kwarg in `delegate_entity` notification call
- **HIGH**: Fixed `open` → `isOpen` prop on `DelegationModal`'s `Modal` component
- **MEDIUM**: Added authorization check to `revoke_delegation` (creator or director only)
- **MEDIUM**: Scoped delegation queryset — non-directors only see own delegations

### Frontend Fixes (Code Review)
- **CRITICAL**: Replaced `PageLayout` wrapper (renders `<Outlet>`, ignores children) with plain `<div>` in preferences page
- **MEDIUM**: Added `aria-label` to notification bell button
- **MEDIUM**: Added lazy-loading to notifications list (only fetches when panel opened)
- **MEDIUM**: Associated `<select>` elements with `<label>` elements via `htmlFor`/`id` in preferences page
- **MEDIUM**: Fixed hardcoded English strings in template editor — uses `t()` with fallback
- **MEDIUM**: Category headers now use translated strings via `t(\`notifications.categories.${category}\`)`
- **MEDIUM**: Added missing i18n keys: `common.saving`, `common.active`, `common.inactive`, `admin.notificationTemplates.empty`
- **MEDIUM**: Added missing Spanish locale for `admin.notificationTemplates`

### Phase 4 Fixes (Code Review — see `docs/CODE_REVIEW_PHASE4.md` for full report)

**66 findings total** (8 CRITICAL, 17 HIGH, 23 MEDIUM, 18 LOW). 16 fixes applied:

- **CRITICAL**: RPA `RPAJobDefinitionViewSet` locked down with `IsDirector` permission, restricted to GET/PATCH only
- **CRITICAL**: RPA `RPAJobViewSet` restricted to internal users only
- **CRITICAL**: All 6 Services Platform ViewSets got role-based `get_permissions()` (catalog: director for write; requests/quotations/deeds/expenses: internal for write)
- **CRITICAL**: Fixed service request creation passing empty `client_id` — added client selector with validation
- **CRITICAL**: Fixed payment modal opening with empty `ticketId` — added ticket selector with validation
- **HIGH**: `update_preferences` replaced `hasattr` with explicit field allowlist (`category_channels`, `daily_digest_enabled`, `digest_hour`)
- **HIGH**: Notification template context values HTML-escaped before substitution (`django.utils.html.escape`)
- **HIGH**: `cancel_rpa_job` removed `terminate=True` flag for cooperative cancellation
- **HIGH**: Seed command fixed `entry.pop()` → `entry.get()` to prevent module-level list mutation
- **HIGH**: Approve button loading state now per-row via `approveMutation.variables === row.id`
- **MEDIUM**: Added missing `portal.entities.*` i18n keys (EN + ES)
- **LOW**: `getDaysInState` clamped to `Math.max(0, ...)` to prevent negative display

**Additional fixes (session 2):**
- **HIGH**: PDF download in `quotation-detail-page.tsx` wrapped in try/catch with user error alert
- **HIGH**: Added `onError` callbacks to all financial mutations (4 in service-request-page, 2 in quotation-detail-page, 1 in payment-tracking-page)
- **MEDIUM**: Removed dead `paymentTicket` state + unreachable `PaymentModal` from `inc-dashboard-page.tsx`
- **MEDIUM**: Removed dead `selectedTicketIds` state from `gestora-dashboard-page.tsx`, replaced with inline `new Set<string>()`
- **LOW**: Removed redundant client-side jurisdiction double-filter in `inc-dashboard-page.tsx` (API already filters)
- **LOW**: Removed silent 50-row truncation in `inc-dashboard-page.tsx` (API controls pagination)

---

## Phase 5 — Automation, AI & Polish (COMPLETE)

### 5A — AI Assistant

| # | Story | Status |
|---|-------|--------|
| 5A.1 | As a user, I can chat with an AI assistant that understands KYC, compliance, and risk context | Done |
| 5A.2 | As a user, I see suggested questions based on my current page context | Done |
| 5A.3 | As a user, I can get AI-powered field suggestions when filling out forms (confidence scores) | Done |
| 5A.4 | As a compliance officer, I can get AI-generated natural language explanations of risk scores | Done |
| 5A.5 | As a user, I can get AI document review with completeness analysis | Done |
| 5A.6 | As a developer, the AI assistant defaults to mock mode (no API key required) | Done |

**How to test:** AI chat widget floats bottom-right on all authenticated pages. Click to open. Type questions about KYC, compliance, or risk. Field suggestions appear in form contexts with confidence percentages. Risk explanation available on compliance detail pages. Mock mode active by default — set `ANTHROPIC_API_KEY` + `AI_MOCK_MODE=false` for live API.

**Backend:** `backend/apps/ai_assistant/` — 4 endpoints: `POST /api/v1/ai/chat/`, `/suggest/`, `/explain-risk/`, `/review-doc/`. Rate limited at 30 requests/hour per user.

### 5B — Advanced Email & Notifications

| # | Story | Status |
|---|-------|--------|
| 5B.1 | As a user, I receive branded HTML emails with ARIFA styling | Done |
| 5B.2 | As an admin, I can track email delivery (opens, clicks) via DeliveryLog | Done |
| 5B.3 | As a back-office user, I receive a daily digest email summarizing my unread notifications | Done |
| 5B.4 | As an accountant/director, I receive AM/PM batch accounting summaries (9 AM/3 PM) | Done |
| 5B.5 | As a user, I receive auto-notifications on ticket state changes, KYC status updates, RFI creation, high-risk alerts, and RPA job completion | Done |
| 5B.6 | As a user, I can set per-category notification preferences (in-app, email, both, none) | Done |
| 5B.7 | As a user, I can configure daily digest settings (enable/disable, preferred hour) | Done |
| 5B.8 | As a user, I see a notification bell with unread count in the app header | Done |

**How to test:** Notification bell in top-right of app layout shows unread count (auto-refreshes every 30s). Click to see notification panel with mark-read actions. Notification preferences at `/settings/notifications` — configure per-category channels and digest settings. Email templates in `backend/apps/notifications/templates/notifications/` (base_email.html, notification_email.html, digest_email.html). Tracking pixel records opens, redirect URL records clicks. Signal handlers fire on model changes.

**Backend:** `backend/apps/notifications/` — 8 models, 5 signal handlers, 4 Celery tasks (send_notification_async, process_reminders, send_daily_digest, send_accounting_batch_summary), 35 seed templates.

### 5C — Advanced Reporting

| # | Story | Status |
|---|-------|--------|
| 5C.1 | As a director, I can view a reports hub linking to all available reports | Done |
| 5C.2 | As a director, I can view a financial dashboard (revenue, expenses, net income, by jurisdiction/month) | Done |
| 5C.3 | As a director, I can view user activity reports (tickets completed, avg processing days, by role) | Done |
| 5C.4 | As a user, I can export reports to CSV | Done |
| 5C.5 | As a user, I can print reports with optimized print layout | Done |

**How to test:** Navigate to `/reports` for the reports hub. Financial dashboard at `/reports/financial` — filter by period (month/quarter/year) and jurisdiction. User activity at `/reports/activity` — filter by role and date range. CSV export and print buttons on each report page.

**Backend:** `backend/apps/core/reporting.py` — `FinancialSummaryView` (aggregates quotations + expenses by jurisdiction/month), `UserActivityReportView` (user performance metrics from TicketLog).

### 5D — Search & Filtering

| # | Story | Status |
|---|-------|--------|
| 5D.1 | As a user, I can search globally across entities, persons, clients, and tickets using Ctrl+K | Done |
| 5D.2 | As a user, I see grouped search results with type icons and color badges | Done |
| 5D.3 | As a user, I can save filter presets for any list page | Done |
| 5D.4 | As a user, I can apply/remove saved filters with one click | Done |
| 5D.5 | As a user, I can set a default filter per module | Done |

**How to test:** Press `Ctrl+K` (or `Cmd+K` on Mac) anywhere in the app to open global search. Type at least 2 characters — results grouped by type (entity/person/client/ticket). Click a result to navigate. Saved filters appear as chips above list tables — click "Save current filter" to save, click chip to apply, X to delete. Default filter (star icon) auto-applies on page load.

**Backend:** `GlobalSearchView` at `GET /api/core/search/?q=...` (icontains across 4 models, limit 5 per type). `SavedFilterViewSet` at `/api/core/saved-filters/` — user-scoped CRUD with unique_together constraint.

### 5E — Page Redesign & i18n Completion

| # | Story | Status |
|---|-------|--------|
| 5E.1 | As a user, I see a redesigned dashboard with stat cards and activity timeline | Done |
| 5E.2 | As a user, all pages use the consistent ARIFA design system | Done |
| 5E.3 | As a user, all UI text is properly translated in both Spanish and English | Done |
| 5E.4 | As a user, dates, numbers, and currency are formatted according to my locale | Done |

**How to test:** Dashboard at `/` shows 4 stat cards + recent activity feed. All pages use Tailwind design system with primary #6200EE color palette. Language toggle in sidebar footer switches between ES/EN — all 2,351+ translation keys present in both locales. `format.ts` utilities use `Intl.DateTimeFormat` and `Intl.NumberFormat` for locale-aware formatting.

**Frontend:** `frontend/src/lib/format.ts` — `formatDate()`, `formatDateTime()`, `formatCurrency()`, `formatNumber()`. Locale files: `frontend/public/locales/{en,es}/common.json` (2,351 lines each), `{en,es}/kyc.json` (222 lines each).

---

## Code Review & Fixes Log

### Phase 5 Fixes (Code Review — see `docs/CODE_REVIEW_PHASE5.md` for full report)

**70 findings total** (7 CRITICAL, 18 HIGH, 26 MEDIUM, 19 LOW). 20 fixes applied:

**Backend fixes (12):**
- **CRITICAL**: AI `_load_risk_data` now filters by both `risk_assessment_id` AND `entity_id` to prevent unauthorized access
- **CRITICAL**: Added `IsStaffRole` permission to `AIExplainRiskView` and `AIReviewDocView`
- **CRITICAL**: Added `_sanitize_context_value()` to strip newlines/control chars from AI prompt context values
- **CRITICAL**: Added `url_has_allowed_host_and_scheme()` validation to `TrackClickView` redirect
- **CRITICAL**: Replaced manual `_require_staff()` in reporting views with proper `permission_classes = [IsAuthenticated, IsStaffRole]`
- **HIGH**: Removed PII (`user_email`) from AI context sent to external LLM
- **HIGH**: Moved Anthropic client instantiation to `__init__` for connection pooling
- **HIGH**: Split bare `except Exception` into specific handlers with `logger.exception()`
- **HIGH**: Removed double HTML-escaping in notification email rendering
- **HIGH**: Added `validate_category_channels` with enum validation on notification preferences
- **HIGH**: Wrapped date parsing in reporting views with try/except, returns 400 on invalid format
- **HIGH**: Simplified `mark_as_read` to idempotent `.filter().update()` to eliminate race condition

**Frontend fixes (8):**
- **CRITICAL**: AI chat widget now only renders for staff roles (coordinator, compliance_officer, gestora, director)
- **CRITICAL**: Added security comment documenting `escapeValue: false` risk with AI content
- **HIGH**: Notification `action_url` validated as relative path before navigation
- **HIGH**: Search result `url` validated as relative path before navigation
- **HIGH**: CSV export sanitizes formula injection (`=`, `+`, `-`, `@` prefixed with `'`)
- **HIGH**: Search debounce race condition fixed with `requestSeqRef` counter
- **HIGH**: Financial dashboard and user activity pages have client-role redirect guards
- **HIGH**: AI chat has 2-second cooldown between sends
