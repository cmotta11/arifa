# ARIFA Platform - Technical Summary

## What Is ARIFA?

ARIFA is a legal services platform built for a Panamanian law firm that handles corporate entity onboarding, KYC (Know Your Customer) compliance, workflow management, and document generation. It replaces manual, email-driven processes with a structured digital workflow that ensures regulatory compliance at every step.

---

## Why Was It Built?

Law firms that handle corporate formations, particularly in jurisdictions like Panama and the BVI, face strict regulatory requirements around Anti-Money Laundering (AML) and Know Your Customer (KYC) compliance. The firm needed a system that could:

1. **Standardize onboarding** - Replace ad-hoc email chains with a structured workflow where every step is tracked and auditable.
2. **Enforce compliance** - Ensure that no entity is approved without proper KYC review, risk assessment, and sanctions screening.
3. **Assign accountability** - Route work through specific roles (coordinator, compliance officer, gestora, director) with clear permissions at each stage.
4. **Enable external data collection** - Allow clients and third parties to submit KYC information through secure, time-limited guest links without needing an account.
5. **Generate documents** - Produce legal documents from templates, convert them to PDF, and archive them to SharePoint.
6. **Score risk automatically** - Calculate risk scores based on jurisdiction, PEP status, corporate structure complexity, and sanctions screening results.
7. **Support bilingual operations** - The firm operates in Spanish and English; the entire UI supports both languages.

---

## What Was Built?

### Backend (Django + DRF)

Five Django apps, each handling a distinct domain:

**1. Authentication** (`apps/authentication`)
- Custom User model with email as the login identifier and five roles: `coordinator`, `compliance_officer`, `gestora`, `director`, `client`.
- GuestLink model: UUID-based tokens with a 30-day expiry and a database CHECK constraint ensuring each link targets exactly one ticket or one KYC submission, never both.
- MagicLoginToken for passwordless login via email.
- Microsoft OAuth integration for staff.

**2. Core** (`apps/core`)
- **Client**: The law firm's client organizations.
- **Entity**: Legal entities (corporations, foundations, trusts) owned by clients. Tracks jurisdiction, incorporation date, status, registered agent, and resident agent.
- **Person**: Reusable identity records (natural persons) with nationality, country of residence (both FK to JurisdictionRisk), date of birth, ID type, and PEP status.
- **EntityOfficer**: Links a Person or another Entity to an Entity as an officer. Uses a CHECK constraint (`officer_person XOR officer_entity`) to ensure exactly one holder type. Stores positions as a JSONField.
- **ShareClass** and **ShareIssuance**: Model the capital structure of an entity. ShareIssuance also uses a XOR constraint for `shareholder_person` vs `shareholder_entity`.
- **EntityActivity**, **SourceOfFunds**, **SourceOfWealth**: Track business activities, sources of funds (entity-level), and sources of wealth (person-level) - all inputs to the risk algorithm.
- **EntityAuditLog**: Records every change to an entity with old/new values, the user who made the change, and the source (staff, guest, system).
- **ClientContact**: Contact records per client with a unique_together constraint on `(client, email)`.

**3. Workflow** (`apps/workflow`)
- A configurable state machine: `WorkflowState` (ordered, with `is_initial`/`is_final` flags) and `WorkflowTransition` (from_state, to_state, allowed_roles).
- **Ticket**: The central work item. Each ticket belongs to a client, optionally an entity, has a current_state, assigned_to, priority, and due_date.
- **TicketLog**: Immutable audit trail of every state transition, assignment change, and comment.
- Seeded with 6 states in Spanish: Recibido → Revision Compliance → En Proceso → Registro Publico → Completado / Rechazado.
- Transitions are role-gated: only coordinators can send to compliance, only compliance officers can approve, etc. Rejection transitions exist from every non-final state.

**4. Compliance** (`apps/compliance`)
- **KYCSubmission**: Linked to a ticket, tracks status (DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED/ESCALATED/SENT_BACK), reviewer, and review notes.
- **Party**: UBOs, directors, and beneficial owners linked to a KYC submission. Optionally linked to a Person record in core. Tracks name, party_type (natural/corporate), nationality, country_of_residence, PEP status, and ownership_percentage.
- **RiskAssessment**: Versioned and immutable. Each KYC can have many assessments but only one with `is_current=True`. Stores total_score (0-100), risk_level (LOW/MEDIUM/HIGH), a breakdown JSON with per-component details, and a trigger (MANUAL/AUTO/SCHEDULED/WEBHOOK).
- **RFI** (Request for Information): Sent to parties during KYC review, with question, response, and status tracking.
- **WorldCheckCase**: Sanctions screening results per party. Stores case_system_id, screening_status (CLEAR/MATCHED/TRUE_MATCH/FALSE_POSITIVE/ESCALATED), match_data_json, and resolution details.
- **DocumentUpload**: Files uploaded during KYC with LLM extraction support. Tracks document_type, llm_extraction_status, and llm_extraction_json.
- **JurisdictionRisk**: Country-level risk weights (1-10 scale) used in risk calculation. Pre-populated via data migration with all countries.
- **RiskRecalculationLog**: Batch audit trail for scheduled risk recalculations.

**5. Documents** (`apps/documents`)
- **DocumentTemplate**: Uploadable templates filtered by entity_type and jurisdiction, with an is_active toggle.
- **GeneratedDocument**: Documents produced from templates, linked to a ticket and the user who generated them. Supports PDF conversion via Gotenberg and archival to SharePoint.

### Architecture Patterns

The backend follows a strict layered architecture:

```
Models → Services (keyword-only args) → Selectors (read-only queries) → Views → Serializers
```

- **Services** contain all business logic and mutations. Every function uses keyword-only arguments for clarity. Critical operations use `@transaction.atomic`.
- **Selectors** contain all read queries with proper `select_related` optimization.
- **Views** are thin: they deserialize input, call a service or selector, and serialize the output.
- **Serializers** are split into Input (write) and Output (read) classes to prevent data leakage.
- **Integrations** are isolated in `apps/<app>/integrations/` with no Django ORM dependency. Each integration client has a mock fallback that activates when API credentials are not configured, returning realistic sample data.
- **Permissions** are role-based: `CanManageKYC`, `CanReviewKYC`, `CanManageRFI`, `CanScreenParties`, `IsDirector`, `IsClient`.
- **Exceptions** use a custom `ApplicationError` class caught by a global exception handler that returns `400 {"message": "...", "extra": {}}`.

### Risk Scoring Algorithm

The risk algorithm in `compliance/services.py` scores each KYC submission on a 0-100 scale across four components:

| Component | Max Points | How It Works |
|---|---|---|
| Jurisdiction Risk | 30 | Finds the highest `risk_weight` (1-10) among all parties' nationalities and countries of residence, scales to 30 points |
| PEP Status | 25 | Flat 25 points if any party is a PEP |
| Structure Complexity | 20 | Scores based on total party count (x2, capped at 10) plus corporate party count (x3, capped at 10), scaled to 20 |
| World-Check Screening | 25 | 10 points per unresolved match (MATCHED/TRUE_MATCH/ESCALATED), capped at 25 |

Risk levels: LOW (0-39), MEDIUM (40-69), HIGH (70-100).

Each calculation creates a new immutable `RiskAssessment` record with a full JSON breakdown and marks the previous one as non-current.

### Celery Tasks

Asynchronous processing via Celery + Redis:

| Task | Trigger | What It Does |
|---|---|---|
| `extract_document_data` | Document upload | Sends document to LLM API for field extraction (passport, cedula, corporate registry) |
| `screen_party_worldcheck` | Manual or auto | Screens a party name against World-Check One sanctions database |
| `calculate_risk_score` | Manual, auto, scheduled | Runs the 4-component risk algorithm |
| `recalculate_all_risks` | Weekly schedule | Re-scores all active KYC submissions |
| `recalculate_high_risk_entities` | Custom schedule | Re-scores only HIGH risk submissions |
| `process_worldcheck_webhook` | Webhook | Handles incoming World-Check status updates (new match, resolved, etc.) |
| `generate_document_async` | User action | Generates a document from a template |
| `convert_to_pdf_async` | User action | Converts DOCX to PDF via Gotenberg |
| `upload_to_sharepoint` | User action | Uploads document to SharePoint via Microsoft Graph API |
| `upload_document_to_sharepoint_async` | User action | Uploads KYC documents to SharePoint |

All tasks use `bind=True`, `max_retries=3`, and exponential backoff.

### External Integrations

| Service | Purpose | Fallback |
|---|---|---|
| World-Check One (Refinitiv) | Sanctions/PEP screening | Mock data with realistic match results |
| Microsoft Graph API | SharePoint document archival | Local filesystem mock storage |
| LLM API (OpenAI-compatible) | Document data extraction from images | Mock extraction with sample passport/cedula/registry data |
| Gotenberg | DOCX to PDF conversion | Minimal valid blank PDF (212 bytes) |
| Mailpit | Email delivery (dev) | Console email backend |
| Microsoft OAuth | Staff SSO | Email/password fallback |

---

### Frontend (React + TypeScript)

A single-page application organized by feature modules:

**Tech Stack**: Vite, React 18, TypeScript (strict mode), Tailwind CSS, Headless UI, TanStack Query, Zustand, React Hook Form + Zod, react-i18next, @dnd-kit.

**Design System**: Custom brand color `arifa-navy` (#04367d), Roboto font, 16 reusable UI components (Button, Input, Card, Badge, Select, Toast, Modal, DataTable, etc.) with consistent variant/size systems and accessibility focus states.

#### Feature Modules

| Feature | Pages | What It Does |
|---|---|---|
| **Auth** | 3 | Email/password login, client magic-link login, Microsoft OAuth, magic link validation |
| **Dashboard** | 1 | 4 metric cards (pending tickets, active KYCs, high-risk entities, completed this month) + activity feed |
| **Tickets** | 2 | Ticket list with filtering, ticket detail with timeline, state transitions, and assignment |
| **Kanban** | 1 | Drag-and-drop board with one column per workflow state, triggers transitions on drop |
| **Clients** | 2 | Client list/detail, related entities/matters/tickets/people, contact management, portal access links |
| **Entities** | 2 | Entity list/detail with 7 tabs: Overview, Corporate Structure (officers/shares), Risk Profile, Matters, Tickets, Access Links, Audit Log |
| **People** | 2 | Person list/detail with personal info, nationality/residence FKs, source of wealth tracking |
| **KYC** | 3 | KYC list with status tabs, new submission from ticket, detail with 6 tabs: Overview, Parties, Documents, Risk, RFIs, Entity Review |
| **Compliance** | 1 | Compliance dashboard with review queue, risk matrix, risk history timeline, World-Check panel, RFI section, UBO tree viewer, integration status |
| **Documents** | 1 | Template management (upload, toggle active, filter), document generation, PDF conversion, download |
| **Guest Intake** | 1 | Public form for external KYC submission via guest token - party management, document upload, entity change proposals, auto-save |
| **Client Portal** | 2 | Read-only portal for clients to track their KYC submissions |
| **Admin** | 1 | User management, workflow state/transition configuration, jurisdiction risk weight management |
| **Onboarding** | 1 | Initial platform onboarding flow |

#### State Management

- **TanStack Query**: All server state. Query key factories per feature for organized cache invalidation. 1-minute stale time, single retry.
- **Zustand**: Toast notifications (auto-dismiss 5s) and UI preferences (sidebar collapse, language) persisted to localStorage.
- **React Context**: Authentication state (user, login/logout methods).

#### API Client

Custom fetch-based client (no axios) with:
- Automatic CSRF token injection from cookies.
- Guest token header (`X-Guest-Token`) when guest form is active.
- FormData support for file uploads.
- Custom `ApiError` class.
- 14 feature-specific API modules, each with raw functions, query key factories, useQuery hooks, and useMutation hooks.

#### Forms & Validation

React Hook Form + Zod schemas for all form inputs. i18n-aware error message keys. Custom hooks: `useDebounce` (search inputs, 300ms), `useAutoSave` (draft persistence, 1s), `useTaskPolling` (async task status polling, 2s interval).

#### Internationalization

Full Spanish/English support via react-i18next. 700+ common strings + 150+ KYC-specific strings per language. Namespace-based loading (`common`, `kyc`). Language toggle in sidebar and login page, persisted to localStorage. Spanish is the default.

---

### Infrastructure (Docker Compose)

8 services:

| Service | Image | Port | Purpose |
|---|---|---|---|
| db | postgres:16-alpine | 5434 | Primary database |
| redis | redis:7-alpine | 6380 | Celery broker + result backend |
| backend | Custom (Django) | 8000 | Django REST API |
| celery-worker | Same as backend | - | Async task processing |
| celery-beat | Same as backend | - | Scheduled task scheduling |
| frontend | Custom (Vite) | 5173 | React SPA with HMR |
| mailpit | axllent/mailpit | 8025/1025 | Dev email capture (Web UI + SMTP) |
| gotenberg | gotenberg/gotenberg:8 | 3000 | DOCX to PDF conversion |

All services use health checks, `unless-stopped` restart policy, and `.env` file for configuration. Backend and workers share the same Docker image with different entrypoint commands.

---

## How Was It Built?

### Architecture Decisions

**Why Django + DRF?** The backend needs strong ORM capabilities for complex relational data (entities, officers, shareholders, KYC parties), built-in migrations for schema evolution, and a mature ecosystem for authentication, permissions, and admin. DRF provides a clean serializer layer that separates API concerns from business logic.

**Why the service/selector pattern?** To keep views thin and testable. Services contain all write logic with explicit keyword-only arguments (no hidden state). Selectors contain all read logic with optimized queries. This prevents fat views and makes it easy to call business logic from Celery tasks, management commands, or other services.

**Why separate Input/Output serializers?** To prevent accidental data leakage. The output serializer controls exactly what fields are returned to the client. The input serializer validates incoming data without being coupled to the response shape.

**Why Celery for tasks?** Document extraction, sanctions screening, PDF conversion, and SharePoint uploads are all I/O-bound operations that can take seconds to minutes. Running them asynchronously prevents HTTP request timeouts and allows retry logic with exponential backoff.

**Why versioned risk assessments?** Compliance regulations require an audit trail of how risk was assessed over time. Making assessments immutable (create new, mark old as non-current) means no history is ever lost. The `trigger` field records whether the calculation was manual, automatic, scheduled, or from a webhook.

**Why mock fallbacks for integrations?** The platform integrates with World-Check, SharePoint, an LLM API, and Gotenberg. In development, none of these may be available. Mock clients return realistic data so the full workflow can be tested end-to-end without external dependencies. In production, real credentials activate the real clients.

**Why React + TypeScript + TanStack Query?** TypeScript provides compile-time safety across the entire frontend. TanStack Query handles server state caching, invalidation, and synchronization without manual state management. The query key factory pattern ensures cache consistency across features.

**Why Tailwind CSS?** Utility-first CSS provides consistent styling without writing custom CSS. Combined with a custom brand color (`arifa-navy`), it produces a professional, cohesive look with minimal effort. No CSS-in-JS runtime overhead.

**Why Zustand over Redux?** The frontend has minimal client-side state (toast notifications, UI preferences). Zustand is lighter and simpler for this use case. Server state (which is the bulk of the data) is handled by TanStack Query.

**Why feature-based folder structure?** Each feature (KYC, tickets, entities, etc.) has its own pages, components, and API modules. This makes it easy to find related code, add new features without touching unrelated modules, and potentially assign features to different team members.

**Why @dnd-kit for kanban?** The kanban board needs drag-and-drop between workflow state columns, triggering actual state transitions via the API. @dnd-kit is the modern React DnD library with good accessibility and smooth animations.

### Database Design

- UUID primary keys on all models to prevent enumeration attacks.
- `TimeStampedModel` base class provides `created_at` and `updated_at` on every model.
- CHECK constraints at the database level for business rules (guest link targets exactly one entity, officers are either a person OR an entity).
- Foreign keys to `JurisdictionRisk` for nationality and country of residence enable the risk algorithm to look up weights without string matching.
- `unique_together` constraints on workflow transitions (`from_state`, `to_state`) and client contacts (`client`, `email`).
- Custom index on `(entity, -created_at)` for fast audit log queries.

### Security

- CSRF protection via Django middleware + token injection in the API client.
- CORS restricted to localhost:5173 in development.
- Session-based authentication with HTTP-only cookies.
- Role-based permissions at both the API level (DRF permissions) and the frontend level (route guards).
- Guest links are time-limited (30 days), have an `is_active` flag for revocation, and use UUID tokens.
- All secrets via environment variables, never hardcoded.
- Rate throttling on guest-accessible onboarding endpoints (10/hour).

---

## Current Status

| Phase | Status | Scope |
|---|---|---|
| Phase 1 | Complete | Infrastructure, all 5 Django apps, frontend foundation, auth, dashboard, kanban, tickets |
| Phase 2 | Backend complete, frontend in progress | Compliance models/services implemented, KYC forms, compliance dashboard, entity management |
| Phase 3 | Planned | Document template engine, Gotenberg integration (service configured in Docker) |
| Phase 4 | Planned | Admin UI refinements, role-specific boards, UAT |
