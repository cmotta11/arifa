# ARIFA Platform — Comprehensive Development Plan

> **Version:** 1.0.0
> **Date:** 2026-03-13
> **Status:** DRAFT — Pending team review
> **Scope:** Full Compliance Platform v2 + Client Services Platform (INC workflow)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Architecture Decisions](#3-architecture-decisions)
4. [Phase Overview](#4-phase-overview)
5. [Phase 1 — Foundation & Design System (Weeks 1–4)](#5-phase-1--foundation--design-system)
6. [Phase 2 — Core Infrastructure (Weeks 5–10)](#6-phase-2--core-infrastructure)
7. [Phase 3 — Compliance Platform v2 (Weeks 11–20)](#7-phase-3--compliance-platform-v2)
8. [Phase 4 — Client Services Platform & INC Workflow (Weeks 21–32)](#8-phase-4--client-services-platform--inc-workflow)
9. [Phase 5 — Automation, AI & Polish (Weeks 33–40)](#9-phase-5--automation-ai--polish)
10. [Phase 6 — UAT, Stabilization & Go-Live (Weeks 41–44)](#10-phase-6--uat-stabilization--go-live)
11. [Integration Architecture](#11-integration-architecture)
12. [Data Model Extensions](#12-data-model-extensions)
13. [API Contracts](#13-api-contracts)
14. [Testing Strategy](#14-testing-strategy)
15. [Risk Register](#15-risk-register)
16. [Deferred Items](#16-deferred-items)

---

## 1. Executive Summary

This plan covers the full buildout of the ARIFA Integrated Services Platform, encompassing:

- **Compliance Platform v2**: KYC, Economic Substance, Accounting Records (Panama Law 254/2021), Risk Matrix with Shareholders Calculator, World-Check integration
- **Client Services Platform**: Client portal, incorporation (INC) workflow for Panama/BVI/Belize/Bahamas, quotation engine, service request management, multi-team Kanban workflows, document assembly
- **Aderant ERP Integration**: Full SOAP adapter for the Aderant Expert API (File Opening, Billing, Time, Inquiries, Common Elements) with mock fallback
- **Notification Service**: Dedicated service for email, in-app notifications with configurable templates and automated reminder campaigns
- **AI Assistant**: Context-aware assistant for form help, document review, and risk assessment explanations
- **UI Redesign**: Full redesign following ARIFA UI Standards (primary #2D3E50, Roboto, 8px grid, dark mode, responsive, accessibility)

### Key Architecture Decisions (from stakeholder input)

| Decision | Choice |
|----------|--------|
| Tech stack | Django + React (keep current) + adopt ARIFA UI standards (Swagger, color palette, components) |
| Aderant integration | Build SOAP adapter now with mock fallback |
| RPA automations | Separate RPA job queue for multi-step Aderant operations |
| Document assembly | Scalable template engine base — each doc type coded with variables/format |
| UI standards | Strict compliance — full redesign per ARIFA standards doc |
| Kanban | Multi-workflow engine with separate named workflows per team |
| Jurisdictions | Configuration-driven with default seed migrations |
| Payments | Deferred — manual tracking for now |
| Quotation | Build pricing/quotation module without payment gateway |
| SharePoint | Use regular file storage if not configured |
| OCR | Already handled by Foundry |
| Notifications | Dedicated notification service (email + in-app) |
| AI assistant | Planned with Claude API |
| Auth | Django auth + django-allauth for SSO readiness (SAML/OIDC) + JWT for API |
| Deployment | Docker Compose for now, cloud-ready configs |

---

## 2. Current State Assessment

### 2.1 What's Built (Phase 1 Complete)

**Backend — 5 Django apps fully modeled and serviced:**

| App | Models | Services | API Endpoints | Status |
|-----|--------|----------|---------------|--------|
| authentication | User, GuestLink, MagicLoginToken | 10 service functions | 12 endpoints | ✅ Complete |
| core | Client, Entity, Matter, Person, EntityOfficer, ShareClass, ShareIssuance, ActivityCatalog, EntityActivity, SourceOfFundsCatalog, SourceOfFunds, ClientContact, SourceOfWealth, EntityAuditLog, PersonAuditLog | 20+ service functions | 12 ModelViewSets | ✅ Complete |
| workflow | WorkflowState, Transition, Ticket, TicketLog | 3 service functions | 4 endpoints + kanban | ✅ Complete |
| compliance | KYCSubmission, Party, JurisdictionRisk, RiskMatrixConfig, RiskFactor, AutomaticTriggerRule, RiskAssessment, RiskRecalculationLog, ComplianceSnapshot, RFI, WorldCheckCase, DocumentUpload, AccountingRecord, AccountingRecordDocument | 30+ service functions | 25+ endpoints | ✅ Complete |
| documents | DocumentTemplate, GeneratedDocument | 3 service functions | 7 endpoints | ✅ Complete |

**Frontend — 15 feature folders:**
- auth, dashboard, tickets, kyc, compliance, documents, admin, clients, entities, people, client-portal, guest-intake, onboarding, registros-contables, kanban

**Infrastructure:**
- Docker Compose with 8 services (db, redis, backend, celery-worker, celery-beat, frontend, mailpit, gotenberg)
- Aderant REST mock harness (`backend/apps/core/integrations/aderant.py`)

### 2.2 What's Partially Built

| Feature | Backend | Frontend | Gap |
|---------|---------|----------|-----|
| LLM Document Extraction | Task skeleton | — | Real extraction logic |
| SharePoint Upload | Task stub | — | Actual SP integration |
| World-Check Screening | Model + webhook | — | Screening trigger logic |
| Gotenberg PDF | Client referenced | — | Uncommented in docker-compose |
| Celery Beat scheduled tasks | Infrastructure ready | — | Specific job definitions |
| Email notifications | Magic link only | — | Broader notification system |
| Admin UI | Route exists | Page shell | Full admin functionality |

### 2.3 What's Not Built

- Client Services Platform (incorporation workflow)
- Quotation/pricing engine
- Multi-workflow engine (separate Kanbans per team)
- Aderant SOAP adapter
- RPA job queue
- Document assembly engine
- Notification service
- Shareholders Calculator UI (organigram)
- Economic Substance module UI
- AI assistant
- UI redesign per ARIFA standards
- SSO/OIDC readiness
- Swagger/OpenAPI documentation
- Jurisdiction configuration system

---

## 3. Architecture Decisions

### 3.1 Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 18 + TS)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Client   │ │ Back     │ │ Guest    │ │ AI Assistant  │  │
│  │ Portal   │ │ Office   │ │ Forms    │ │ Widget        │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Design System (ARIFA Standards v1.0.0)               │   │
│  │ Tailwind + Custom Components + Roboto + 8px Grid     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API (JSON) + JWT / Session
┌────────────────────────┴────────────────────────────────────┐
│                 BACKEND (Django 5.1 + DRF)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    API Layer (DRF)                     │   │
│  │  Swagger/OpenAPI 3.0 · Rate Limiting · Auth Guards    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐  │
│  │ auth      │ │ core      │ │ workflow  │ │compliance │  │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤  │
│  │ documents │ │ services  │ │ notif.    │ │ rpa       │  │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Service Layer (keyword-only args)         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Integration Layer (adapters)                 │   │
│  │  Aderant SOAP · World-Check · File Storage · Claude   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
    ┌────────────┬───────┴───────┬────────────┐
    │            │               │            │
┌───┴───┐  ┌────┴────┐  ┌──────┴──────┐  ┌──┴───┐
│ PostgreSQL│  │  Redis   │  │ Celery Workers│  │Gotenberg│
│   16   │  │  7      │  │ + Beat      │  │ PDF  │
└────────┘  └─────────┘  └─────────────┘  └──────┘
```

### 3.2 New Django Apps to Create

| App | Purpose |
|-----|---------|
| `notifications` | Dedicated notification service: email templates, in-app notifications, reminder campaigns, delivery tracking |
| `services_platform` | Client services: service catalog, quotation engine, incorporation requests, service tracking |
| `rpa` | RPA job queue: multi-step Aderant operations, job sequencing, retry logic, status tracking |

### 3.3 Aderant SOAP Adapter Architecture

```
backend/apps/core/integrations/
├── aderant.py              # Current REST mock (keep for backward compat)
├── aderant_soap/
│   ├── __init__.py
│   ├── client.py           # Base SOAP client (zeep/suds) with auth
│   ├── auth_service.py     # AuthenticationService.asmx adapter
│   ├── file_opening.py     # ClientService, MatterService, NameService
│   ├── billing.py          # BOS-based billing operations
│   ├── time_entry.py       # TimeEntryBLC adapter
│   ├── inquiries.py        # Inquiry VC parameter builders
│   ├── common.py           # DbLock, FunctionalSecurity, BOS
│   ├── models.py           # Pydantic models for Aderant data types
│   ├── mock_backend.py     # Comprehensive mock data for all modules
│   └── exceptions.py       # AderantSOAPError, AderantAuthError, etc.
└── aderant_harness.py      # Unified facade: auto-switches SOAP ↔ mock
```

### 3.4 Multi-Workflow Engine Design

```
Current: Single WorkflowState table + Transition table

New: WorkflowDefinition → WorkflowState → WorkflowTransition
     Each definition = named workflow (INC, DOC_PROCESSING, NOTARY, etc.)
     Ticket gets FK to WorkflowDefinition
     Sub-tickets: Ticket.parent_ticket FK for spawning sub-workflows
```

Named workflows to seed:

| Workflow | Stages | Used By |
|----------|--------|---------|
| `INC_PANAMA` | Prospección → Debida Diligencia → Proc. Documentos → Notaría* → Registro Público → Documentación → Enviado Cliente → Finalizado | Panama incorporation |
| `INC_PANAMA_DIGITAL` | Prospección → Debida Diligencia → Proc. Documentos → Documentación → Enviado Cliente → Finalizado | Panama INC with Digital Notary (skips Notaría + Registro Público) |
| `INC_BVI` | Prospección → Debida Diligencia → M&A-COI → Documentación → Firma de Cliente → Presentar ROD-ROM-ROB → Enviado Cliente → Finalizado | BVI incorporation |
| `DOC_PROCESSING` | Pendientes → En Proceso → Reingreso → Notaría → Finalizadas | Gestoras |
| `LEGAL_SUPPORT` | Pendientes → En Proceso → Finalizados | Soporte legal |
| `PUBLIC_REGISTRY` | Pendientes → Presentadas → Rechazada → Reingreso → Finalizado | Registro público |
| `ACCOUNTING_REIMB` | Pendientes → Validación → Reembolso Tarjeta → Autorización → Facturado | Contabilidad |
| `ARCHIVE` | Pendientes → En Proceso → Enviados → Finalizados | Archivo |
| `COMPLIANCE_KYC` | Draft → Submitted → Under Review → Approved / Rejected / Sent Back | KYC review |
| `COMPLIANCE_ES` | Draft → Submitted → Reviewed → Approved | Economic Substance |

### 3.5 Jurisdiction Configuration System

```python
# New model: JurisdictionConfig
class JurisdictionConfig(TimeStampedModel):
    jurisdiction = models.ForeignKey(JurisdictionRisk, on_delete=CASCADE, unique=True)
    # Incorporation config
    inc_workflow = models.ForeignKey(WorkflowDefinition, null=True, on_delete=SET_NULL)
    requires_notary = models.BooleanField(default=False)
    requires_public_registry = models.BooleanField(default=False)
    requires_nit_ruc = models.BooleanField(default=False)  # Panama only
    requires_rbuf = models.BooleanField(default=False)
    supports_digital_notary = models.BooleanField(default=False)  # Digital Notary path available
    # Compliance config
    ubo_threshold_percent = models.DecimalField(default=25)
    kyc_renewal_months = models.IntegerField(default=12)
    economic_substance_required = models.BooleanField(default=False)
    accounting_records_required = models.BooleanField(default=False)
    exempted_companies_available = models.BooleanField(default=False)  # PAN/BVI only, not BEL
    # Risk config
    default_risk_matrix = models.ForeignKey(RiskMatrixConfig, null=True, on_delete=SET_NULL)
    # Document templates
    available_entity_types = models.JSONField(default=list)
    # Form configuration
    form_config = models.JSONField(default=dict)  # Dynamic form fields per jurisdiction
    # Economic Substance flow configuration
    es_flow_config = models.JSONField(default=dict)  # Config-driven ES question flow per jurisdiction
```

Seed migration will pre-populate Panama, BVI, Belize, and Bahamas:

| Jurisdiction | UBO Threshold | Notary | Public Registry | NIT/RUC | RBUF | Digital Notary | ES Required | AR Required | Exempted Co. |
|---|---|---|---|---|---|---|---|---|---|
| Panama | 25% | Yes | Yes | Yes | Yes | Configurable | No | Yes | Yes |
| BVI | 10% | No | No | No | No | No | Yes | Yes | Yes |
| Belize | 10% | No | No | No | No | No | Yes | Yes | No |
| Bahamas | 10% | No | No | No | No | No | Yes | Yes | No |

### 3.6 Shared Delegation Model

All three compliance modules (Registros Contables, Sustancia Económica, KYC) share a delegation workflow where users can assign entities to other users for form completion.

```python
# backend/apps/compliance/models.py — NEW

class ComplianceDelegation(TimeStampedModel):
    """Delegation of entity compliance tasks to another user."""
    entity = models.ForeignKey('core.Entity', on_delete=CASCADE)
    module = models.CharField(max_length=30, choices=[
        ('accounting_records', 'Accounting Records'),
        ('economic_substance', 'Economic Substance'),
        ('kyc', 'KYC'),
    ])
    fiscal_year = models.IntegerField(null=True, blank=True)  # For AR/ES
    delegated_by = models.ForeignKey(User, on_delete=CASCADE, related_name='delegations_made')
    delegate_email = models.EmailField()  # Email of the person receiving delegation
    delegate_user = models.ForeignKey(User, null=True, blank=True, on_delete=SET_NULL, related_name='delegations_received')
    status = models.CharField(max_length=20, choices=[
        ('pending_invitation', 'Pending Invitation'),  # User doesn't have account yet
        ('active', 'Active'),                           # Delegation is active
        ('completed', 'Completed'),                     # Delegate completed the task
        ('revoked', 'Revoked'),                         # Delegator revoked
    ], default='active')
    invited_at = models.DateTimeField(null=True)        # When invitation was sent
    accepted_at = models.DateTimeField(null=True)       # When user accepted/registered

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['entity', 'module', 'fiscal_year', 'delegate_email'],
                name='unique_delegation_per_entity_module'
            ),
        ]
```

**Delegation rules (enforced in service layer):**
- Cannot self-delegate (delegator ≠ delegate_email)
- Cannot delegate entities with status `completed`
- Cannot delegate entities already delegated to someone else (for the same module+year)
- If delegate_email has no account → send invitation email, set `status='pending_invitation'`
- If delegate_email has account → send notification email, set `status='active'`
- When invitation is accepted and user creates account → auto-link `delegate_user` and set `status='active'`
- Delegation can be revoked by the delegator at any time

### 3.7 Notification Service Architecture

```
backend/apps/notifications/
├── models.py
│   ├── NotificationTemplate   # DB-stored email/in-app templates with variables
│   ├── Notification           # Individual notification records (email/in-app)
│   ├── NotificationPreference # Per-user channel preferences
│   ├── ReminderCampaign       # Configurable reminder sequences (3d, 7d, 14d)
│   ├── ReminderStep           # Individual step in a campaign
│   └── DeliveryLog            # Delivery tracking with proof
├── services.py
│   ├── send_notification()    # Core send function (supports file attachments for PDF emails)
│   ├── send_email()           # Email dispatch with optional attachments (Gotenberg PDFs)
│   ├── create_in_app()        # In-app notification creation
│   ├── generate_and_attach_pdf()  # Generate PDF via Gotenberg and attach to email
│   ├── schedule_reminder()    # Schedule a reminder campaign for an entity
│   └── cancel_reminders()     # Cancel pending reminders
├── tasks.py                   # Celery tasks for async delivery + Beat schedules
├── signals.py                 # Django signal handlers for auto-notifications
└── views.py                   # In-app notification list/mark-read endpoints
```

### 3.8 Document Assembly Engine

```
backend/apps/documents/
├── assembly/
│   ├── __init__.py
│   ├── base.py               # BaseDocumentBuilder ABC
│   │   ├── get_variables()   # Returns dict of template variables
│   │   ├── get_template()    # Returns template file path
│   │   ├── validate()        # Pre-generation validation
│   │   └── post_process()    # Post-generation hooks (PDF convert, sign, etc.)
│   ├── registry.py           # DocumentBuilderRegistry — register builders by doc_type
│   ├── builders/
│   │   ├── panama/
│   │   │   ├── pacto_social.py
│   │   │   ├── protocolo.py
│   │   │   ├── caratula.py
│   │   │   ├── share_certificate.py
│   │   │   ├── share_register.py
│   │   │   ├── power_of_attorney.py
│   │   │   ├── director_resignation.py
│   │   │   └── cover_letter.py
│   │   └── bvi/
│   │       ├── memorandum.py
│   │       ├── articles.py
│   │       └── share_certificate.py
│   └── templates/            # .docx templates with Jinja2 tags
│       ├── panama/
│       └── bvi/
```

Each builder inherits from `BaseDocumentBuilder` and defines:
- Template variables mapped from Entity/Person/Matter data
- Formatting rules (margins, fonts, spacing per notary requirements)
- Conditional sections (based on services requested, entity type, etc.)
- Gotenberg conversion to PDF when needed

---

## 4. Phase Overview

```
Phase 1 — Foundation & Design System .............. Weeks  1–4
Phase 2 — Core Infrastructure ..................... Weeks  5–10
Phase 3 — Compliance Platform v2 .................. Weeks 11–20
Phase 4 — Client Services Platform & INC .......... Weeks 21–32
Phase 5 — Automation, AI & Polish ................. Weeks 33–40
Phase 6 — UAT, Stabilization & Go-Live ........... Weeks 41–44
```

### Dependencies Between Phases

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──┐
                  │                 ├──→ Phase 5 ──→ Phase 6
                  └──→ Phase 4 ──┘
```

Phase 3 and Phase 4 can partially overlap once Phase 2 core infrastructure is stable.

---

## 5. Phase 1 — Foundation & Design System (Weeks 1–4)

### 5.1 UI Design System Implementation

**Goal:** Create a reusable component library that strictly follows ARIFA UI Standards v1.0.0.

#### 5.1.1 Tailwind Configuration Overhaul

```
File: frontend/tailwind.config.ts
```

- **Color palette**: Primary #2D3E50, Secondary #6366F1, plus success/warning/error/info variants defined in the standards doc
- **Typography**: Roboto as base font, sizes per standards (H1: 32px bold, H2: 24px semibold, H3: 20px medium, body: 16px, small: 14px, caption: 12px)
- **Spacing**: 8px grid system (4, 8, 12, 16, 24, 32, 48, 64, 96)
- **Border radius**: Per standards (sm: 4px, md: 8px, lg: 12px, xl: 16px)
- **Shadows**: Defined elevation levels from standards
- **Breakpoints**: Mobile (320px), Tablet (768px), Desktop (1024px), Wide (1440px)

#### 5.1.2 Component Library (`frontend/src/components/ui/`)

Build each component per the ARIFA standards document:

| Component | Description | Standards Reference |
|-----------|-------------|---------------------|
| `Button` | Primary/Secondary/Tertiary/Danger/Ghost variants, 3 sizes, loading state, icon support | §2.1 Botones |
| `Input` | Text, email, password, number with label, helper text, error state, required indicator | §2.2 Formularios |
| `Select` | Searchable dropdown with filtering capability | §2.2 Formularios |
| `Textarea` | Multi-line with character count | §2.2 Formularios |
| `Checkbox` | Single + group with indeterminate state | §2.2 Formularios |
| `Radio` | Radio group with descriptions | §2.2 Formularios |
| `DatePicker` | Date/datetime picker with locale support | §2.2 Formularios |
| `FileUpload` | Drag-and-drop zone with preview, progress, file type validation | §2.2 Formularios |
| `Table` | Sortable columns, inline filters, row selection, pagination, bulk actions | §2.3 Tablas |
| `DataList` | Filterable list with search, multi-select | §2.4 Listas |
| `Card` | Standard card with header, body, footer, actions | §2.5 Tarjetas |
| `Pagination` | Page numbers + items per page selector | §2.6 Paginación |
| `Modal` | Centered/sidebar variants, sizes (sm/md/lg/xl), close on escape/overlay | §2.7 Modales |
| `Alert` | Success/Warning/Error/Info inline alerts | §2.7 Alertas |
| `Toast` | Auto-dismiss notifications with action buttons | §2.7 Notificaciones |
| `Tabs` | Horizontal tab navigation with active indicator | §2.8 Tabs |
| `Breadcrumbs` | Navigation breadcrumbs with current page indicator | §2.9 Breadcrumbs |
| `Sidebar` | Collapsible sidebar navigation per §6.2 menu pattern | §6.2 Patrón de menú |
| `KanbanBoard` | Drag-and-drop column board (generic, reusable) | Custom |
| `OrgChart` | React Flow-based ownership tree visualization | Custom |
| `AIAssistant` | Chat widget per §2.10 AI assistant pattern | §2.10 Asistentes IA |
| `StatusBadge` | Color-coded status indicators | Custom |
| `Stepper` | Multi-step form wizard with progress indicator | Custom |
| `EmptyState` | Illustrated empty states with CTA | Custom |
| `LoadingSkeleton` | Content skeleton loaders | §3.2 Carga/Loading |

#### 5.1.3 Layout Templates

- **MainLayout**: Sidebar + topbar + content area (per §6.3 Área de trabajo)
- **PortalLayout**: Client-facing layout with simplified navigation
- **GuestLayout**: Minimal layout for unauthenticated forms
- **PrintLayout**: Print-optimized layout for PDFs and reports

#### 5.1.4 Dark Mode

Per standards §3.3: Full dark mode support with system preference detection and manual toggle. All components must support both themes.

#### 5.1.5 Responsive Design

Per standards §3.5: Mobile-first approach, all pages functional at 320px. Touch targets minimum 44px. Sidebar collapses to hamburger on mobile.

### 5.2 Swagger/OpenAPI Documentation

- Install `drf-spectacular` for automatic OpenAPI 3.0 schema generation
- Add schema decorators to all existing views
- Swagger UI at `/api/docs/`
- ReDoc at `/api/redoc/`
- Export OpenAPI JSON at `/api/schema/`

### 5.3 Auth Infrastructure Upgrade

- Install `django-allauth` with OIDC/SAML providers configured but disabled
- Add JWT token support via `djangorestframework-simplejwt` alongside existing session auth
- Add API key authentication for service-to-service communication
- Create `POST /api/auth/token/` and `POST /api/auth/token/refresh/` endpoints

### 5.4 Existing Page Audit & Redesign Plan

Audit all 15 existing feature folders and create a migration checklist mapping each page to the new design system. Pages will be updated as features are worked on in subsequent phases.

---

## 6. Phase 2 — Core Infrastructure (Weeks 5–10)

### 6.1 Multi-Workflow Engine

#### 6.1.1 Model Changes

```python
# backend/apps/workflow/models.py — NEW/MODIFIED

class WorkflowDefinition(TimeStampedModel):
    """Named workflow with its own set of states and transitions."""
    name = models.CharField(max_length=100, unique=True)  # e.g., "INC_PANAMA"
    display_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    jurisdiction = models.ForeignKey(
        'compliance.JurisdictionRisk', null=True, blank=True, on_delete=SET_NULL
    )
    category = models.CharField(max_length=50)  # incorporation, compliance, operations
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict)  # Extra config per workflow

class WorkflowState(TimeStampedModel):
    # ADD: workflow_definition FK
    workflow_definition = models.ForeignKey(
        WorkflowDefinition, on_delete=CASCADE, related_name='states'
    )
    # Existing fields remain
    name = models.CharField(max_length=100)
    order_index = models.IntegerField(default=0)
    is_initial = models.BooleanField(default=False)
    is_final = models.BooleanField(default=False)
    # NEW fields
    color = models.CharField(max_length=7, default='#6B7280')  # For Kanban column headers
    auto_transition_hours = models.IntegerField(null=True, blank=True)  # Auto-advance after N hours
    required_fields = models.JSONField(default=list)  # Fields that must be filled before entering
    on_enter_actions = models.JSONField(default=list)  # Actions to trigger on state entry

class Ticket(TimeStampedModel):
    # ADD: workflow_definition FK, parent_ticket FK
    workflow_definition = models.ForeignKey(
        WorkflowDefinition, on_delete=CASCADE, related_name='tickets'
    )
    parent_ticket = models.ForeignKey(
        'self', null=True, blank=True, on_delete=CASCADE, related_name='sub_tickets'
    )
    # Existing fields remain
    # ADD:
    jurisdiction = models.ForeignKey(
        'compliance.JurisdictionRisk', null=True, blank=True, on_delete=SET_NULL
    )
    metadata = models.JSONField(default=dict)  # Arbitrary data per ticket
```

#### 6.1.2 Seed Migration

Create a management command `seed_workflows` that populates all 9+ workflow definitions with their states and transitions. This is the "configuration-driven with default seed" approach.

#### 6.1.3 Services

```python
# New service functions
def create_workflow_definition(*, name, display_name, category, ...)
def clone_workflow_for_jurisdiction(*, base_workflow_id, jurisdiction_id, ...)
def spawn_sub_ticket(*, parent_ticket_id, sub_workflow_name, ...)
def get_kanban_data(*, workflow_definition_id, user, filters)
def bulk_transition(*, ticket_ids, target_state_id, user, comment)
def auto_assign_ticket(*, ticket_id, assignment_strategy)  # least-loaded gestora
```

#### 6.1.4 Frontend Kanban Overhaul

Replace the existing Kanban implementation with a generic, reusable `KanbanBoard` component:
- Drag-and-drop columns (using `@dnd-kit/core`)
- Configurable columns from workflow states
- Card templates configurable per workflow type
- Bulk selection and batch operations
- Inline filters (jurisdiction, assigned user, date range, priority)
- Real-time updates via polling or WebSocket (future)

Each team gets a view filtered to their workflow:
- **Coordinator/Abogado**: Main INC workflow board
- **Gestoras**: Doc Processing workflow board
- **Soporte Legal**: Notary workflow board
- **Registro Público**: Public Registry board
- **Contabilidad**: Reimbursement board
- **Archivo**: Archive management board

### 6.2 Aderant SOAP Adapter

#### 6.2.1 Base Client

```python
# backend/apps/core/integrations/aderant_soap/client.py

class AderantSOAPClient:
    """Base SOAP client for Aderant Expert API."""

    def __init__(self):
        self.base_url = settings.ADERANT_SOAP_URL  # https://<server>/CMSNet/
        self.username = settings.ADERANT_USERNAME
        self.password = settings.ADERANT_PASSWORD
        self._session = None
        self._configured = bool(self.base_url and self.username)

    def _get_client(self, service_path: str) -> zeep.Client:
        """Create a zeep SOAP client for a given service endpoint."""
        wsdl_url = f"{self.base_url}{service_path}?wsdl"
        return zeep.Client(wsdl_url, transport=self._transport)

    def authenticate(self) -> str:
        """Authenticate via AuthenticationService.asmx and get SOAP header."""
        ...

    def _call(self, service_path: str, method: str, **kwargs):
        """Authenticated SOAP call with error handling and retry."""
        ...
```

#### 6.2.2 Module Adapters

Each module gets its own adapter class:

**File Opening** (`file_opening.py`):
- `get_client(client_code) → AderantClientData`
- `create_client(data: AderantClientCreate) → int`
- `update_client(uno: int, data: AderantClientUpdate)`
- `get_matter(matter_code) → AderantMatterData`
- `create_matter(data: AderantMatterCreate) → int`
- `get_name(name_code) → AderantNameData`
- `create_name(data: AderantNameCreate) → int`
- `get_address(uno: int) → AderantAddressData`
- `create_address(data: AderantAddressCreate) → int`
- `get_bill_group(client_uno: int) → AderantBillGroupData`
- `create_bill_group(data: AderantBillGroupCreate) → int`

**Billing** (`billing.py`):
- `gather_wip(matter_uno: int) → BillingJobResult`
- `prepare_prebill(params: PrebillParams) → BillingJobResult`
- `post_prebill(prebill_uno: int) → BillingJobResult`
- `create_invoice(params: InvoiceParams) → BillingJobResult`
- `add_disbursement(params: DisbursementParams) → BillingJobResult`
- `get_prebill_status(tran_uno: int) → PrebillStatus`

**Time** (`time_entry.py`):
- `create_time_entry(data: TimeEntryCreate) → int`
- `get_time_entries(filter: str) → list[TimeEntryData]`
- `release_time_entry(uno: int)`

**Inquiries** (`inquiries.py`):
- `get_client_summary(client_code: str) → ClientSummary`
- `get_matter_summary(matter_code: str) → MatterSummary`
- `get_client_ar_list(client_code: str) → list[ARRecord]`
- `get_matter_wip_review(matter_code: str) → list[WIPRecord]`

#### 6.2.3 Mock Backend

Comprehensive mock data matching all modules. Each adapter method checks `self._configured` and falls back to mock data with `_mock: True` flag and warning log.

#### 6.2.4 Harness Facade

```python
# backend/apps/core/integrations/aderant_harness.py

class AderantHarness:
    """Unified facade that auto-switches between SOAP and mock."""

    def __init__(self):
        self.file_opening = FileOpeningAdapter()
        self.billing = BillingAdapter()
        self.time = TimeAdapter()
        self.inquiries = InquiriesAdapter()

    @property
    def is_configured(self) -> bool:
        return bool(settings.ADERANT_SOAP_URL)

    @property
    def mode(self) -> str:
        return "live" if self.is_configured else "mock"
```

### 6.3 RPA Job Queue

#### 6.3.1 Models

```python
# backend/apps/rpa/models.py

class RPAJobDefinition(TimeStampedModel):
    """Defines a reusable RPA job type with its steps."""
    name = models.CharField(max_length=100, unique=True)  # e.g., "INC_CREATE_CLIENT"
    description = models.TextField()
    steps = models.JSONField()  # Ordered list of step definitions
    is_active = models.BooleanField(default=True)

class RPAJob(TimeStampedModel):
    """Instance of an RPA job execution."""
    definition = models.ForeignKey(RPAJobDefinition, on_delete=CASCADE)
    ticket = models.ForeignKey('workflow.Ticket', null=True, on_delete=SET_NULL)
    entity = models.ForeignKey('core.Entity', null=True, on_delete=SET_NULL)
    status = models.CharField(choices=[
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('paused', 'Paused'),       # Waiting for external event
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ], default='pending')
    input_data = models.JSONField(default=dict)
    output_data = models.JSONField(default=dict)
    current_step = models.IntegerField(default=0)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    max_retries = models.IntegerField(default=3)
    triggered_by = models.ForeignKey(User, null=True, on_delete=SET_NULL)

class RPAJobStep(TimeStampedModel):
    """Individual step execution within an RPA job."""
    job = models.ForeignKey(RPAJob, on_delete=CASCADE, related_name='step_logs')
    step_index = models.IntegerField()
    step_name = models.CharField(max_length=100)
    status = models.CharField(choices=[...], default='pending')
    input_data = models.JSONField(default=dict)
    output_data = models.JSONField(default=dict)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    error_message = models.TextField(blank=True)
```

#### 6.3.2 RPA Job Definitions (seeded)

| Job Name | Steps | Trigger |
|----------|-------|---------|
| `INC_CREATE_CLIENT` | 1. Check if client exists in Aderant → 2. Create client if new → 3. Set billing group | Payment approved (new client) |
| `INC_CREATE_MATTER_INC` | 1. Create INC matter under client → 2. Set matter type/status | After client creation |
| `INC_CREATE_MATTER_ANNUAL` | 1. Create annuity matter under client → 2. Set matter type | After INC matter creation |
| `INC_CREATE_PAYOR` | 1. Check payor exists → 2. Create/link payor in Aderant | Status → Pending |
| `INC_UPDATE_STATUS_OPEN` | 1. Set client status to Open → 2. Set INC matter to Open → 3. Set annuity to Open | Public registry approved |
| `INC_REGISTER_NIT_RUC` | 1. Update Company Details in Aderant with NIT/DV | NIT/RUC checkbox marked |
| `INC_CREATE_PREBILL` | 1. Gather WIP → 2. Prepare prebill → 3. Generate PDF | Documents stage complete |
| `INC_POST_INVOICE` | 1. Post prebill → 2. Generate invoice PDF → 3. Upload to platform | Invoice approved |
| `INC_REINGRESO_COSTS` | 1. Add additional costs to Aderant → 2. Set prebill adjustment to 0 | Reingreso state entered |
| `INC_REIMBURSE_EXPENSES` | 1. Create vendor invoice → 2. Add disbursement → 3. Post session → 4. Notify Caja | Reimbursement approved |

#### 6.3.3 Celery Worker

Dedicated Celery queue `rpa` with a single-concurrency worker to prevent parallel Aderant mutations:

```python
# backend/apps/rpa/tasks.py

@shared_task(queue='rpa', max_retries=3)
def execute_rpa_job(job_id: str):
    """Execute an RPA job step-by-step."""
    job = RPAJob.objects.get(id=job_id)
    executor = RPAExecutor(job)
    executor.run()

class RPAExecutor:
    def run(self):
        for step in self.job.definition.steps[self.job.current_step:]:
            result = self._execute_step(step)
            if result.status == 'paused':
                return  # Will be resumed by trigger
            if result.status == 'failed':
                self._handle_failure(step, result)
                return
```

### 6.4 Notification Service

#### 6.4.1 Models (see §3.6 for full structure)

Create `backend/apps/notifications/` with all models, services, tasks, and views.

#### 6.4.2 Notification Templates (seeded)

| Template | Channel | Trigger | Variables |
|----------|---------|---------|-----------|
| `welcome_registration` | email | User registration | `{user_name, login_url}` |
| `inc_form_received` | email + in-app | Client submits INC form | `{client_name, entity_name, tracking_url}` |
| `inc_form_reminder_3d` | email | 3 days after draft save | `{client_name, form_url, support_phone, support_email}` |
| `inc_form_reminder_7d` | email | 7 days after draft save | Same |
| `inc_form_reminder_14d` | email | 14 days after draft save | Same |
| `dd_approved` | email + in-app | Due diligence approved | `{client_name, entity_name, payment_url}` |
| `dd_documents_needed` | email | Additional docs needed | `{client_name, missing_docs, upload_url}` |
| `name_available` | email + in-app | Name search result | `{entity_name, available, alternatives}` |
| `gestora_assigned` | email + in-app | Ticket assigned to gestora | `{gestora_name, entity_name, ticket_url}` |
| `stage_change` | email + in-app | Any workflow stage change | `{entity_name, old_stage, new_stage, actor_name}` |
| `notary_ready` | email + in-app | Documents ready for notary | `{entity_name, document_list}` |
| `notary_delayed_alert` | email + in-app | >24h in notary | `{entity_name, hours_elapsed}` |
| `registry_presented` | email + in-app | Presented to public registry | `{entity_name, presentation_date}` |
| `registry_approved` | email + in-app | Registry inscription success | `{entity_name, folio_number, pdf_url}` |
| `registry_rejected` | email + in-app | Writing defective | `{entity_name, rejection_reason}` |
| `sign_documents_request` | email | Certificates need signing | `{client_name, documents, portal_url, due_date}` |
| `sign_reminder_5d` | email | 5 days without signed docs | Same |
| `sign_reminder_8d` | email | 3 days after first reminder | Same |
| `sign_reminder_10d` | email | 2 days after second reminder | Same |
| `inc_complete` | email + in-app | Incorporation finalized | `{client_name, entity_name, portal_url}` |
| `nit_ruc_registered` | email + in-app | NIT/RUC registered in DGI | `{entity_name, nit, ruc}` |
| `kyc_review_needed` | email + in-app | KYC submitted for review | `{entity_name, reviewer_name}` |
| `kyc_approved` | email + in-app | KYC approved | `{entity_name}` |
| `kyc_sent_back` | email + in-app | KYC sent back with comments | `{entity_name, comments}` |
| `accounting_record_due` | email | Annual accounting record due | `{entity_name, fiscal_year, guest_url}` |
| `accounting_record_completed` | email + PDF | AR form completed | `{entity_name, fiscal_year}` + PDF attachment |
| `es_completed` | email + PDF | ES form completed | `{entity_name, fiscal_year}` + PDF attachment |
| `es_in_review` | email + in-app | ES "Attention" path triggered | `{entity_name, reason, contact_info}` |
| `kyc_completed` | email + PDF | KYC form completed | `{entity_name}` + PDF attachment |
| `help_request` | email + in-app | User requests help from compliance screen | `{requester_name, entity_name, module, message}` |
| `high_capital_alert` | email + in-app | INC with capital above threshold | `{entity_name, capital_amount, threshold}` |
| `unfactured_inc_alert` | email | Completed INC without invoice | `{entity_name, completion_date}` |
| `expense_report_daily` | email | Daily 2x batch (AM/PM) | `{date, expense_list, total}` |

### 6.5 Jurisdiction Configuration

- Create `JurisdictionConfig` model (see §3.5)
- Seed migration for Panama, BVI, Belize, Bahamas
- Admin API endpoints for managing jurisdiction configs
- Frontend admin page for jurisdiction settings

### 6.6 File Storage Abstraction

```python
# backend/common/storage.py

class FileStorageBackend(ABC):
    @abstractmethod
    def upload(self, file, path: str) -> str: ...
    @abstractmethod
    def download(self, path: str) -> bytes: ...
    @abstractmethod
    def get_url(self, path: str) -> str: ...
    @abstractmethod
    def delete(self, path: str) -> bool: ...

class LocalFileStorage(FileStorageBackend):
    """Default: Django's MEDIA_ROOT file storage."""
    ...

class SharePointStorage(FileStorageBackend):
    """SharePoint integration when configured."""
    ...

def get_storage_backend() -> FileStorageBackend:
    if settings.SHAREPOINT_URL and settings.SHAREPOINT_TOKEN:
        return SharePointStorage()
    return LocalFileStorage()
```

---

## 7. Phase 3 — Compliance Platform v2 (Weeks 11–20)

### 7.1 KYC Module Enhancements

#### 7.1.1 Backend

- **Due diligence checklist**: Add `DueDiligenceChecklist` model with per-section activities (Entity Details, Directors/Officers, Shareholders, Beneficial Owners, Attorneys-in-fact)
- **World-Check integration**: Complete screening trigger logic — when a party is added, auto-screen via World-Check API with harness pattern
- **Document verification**: Passport expiry validation (OCR via Foundry), auto-flag expired documents
- **Field-level comments**: Enhance `field_comments` JSON with threaded conversation support
- **KYC renewal tracking**: Celery Beat task to check `kyc_renewal_months` per jurisdiction and trigger new KYC rounds

#### 7.1.2 Frontend

- **KYC Form redesign**: Multi-step wizard using new `Stepper` component, section-by-section with progress indicator
- **Due Diligence Dashboard**: KPI cards (pending/in-review/completed), search/filter, bulk delegation
- **Party Management UI**: Add/edit/link parties with inline World-Check status badges
- **Document Upload**: Drag-and-drop with auto-ID detection via Foundry, visual preview, expiry warnings
- **Review & Approve**: Side-by-side view (submitted data vs current entity data), field-level comment threads, approve/reject/send-back actions
- **Guest Form overhaul**: Redesigned with new component library, save-as-draft, progress indicator

### 7.2 Economic Substance Module

#### 7.2.1 Backend

```python
# New models in compliance app

class EconomicSubstanceSubmission(TimeStampedModel):
    entity = models.ForeignKey('core.Entity', on_delete=CASCADE)
    fiscal_year = models.IntegerField()
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),           # Not started
        ('in_progress', 'In Progress'),   # Saved for later / partially filled
        ('in_review', 'In Review'),       # "Attention" path — ARIFA must contact client
        ('completed', 'Completed'),       # Review & Submit confirmed
    ], default='pending')
    # Form data stored as JSON for flexibility
    form_data = models.JSONField(default=dict)
    # Config-driven flow: tracks which question the user is on and their answers
    flow_answers = models.JSONField(default=dict)  # {question_key: answer_value}
    current_step = models.CharField(max_length=50, blank=True)  # Current position in flow
    # Sections:
    # - Relevant activities selection (multi-select)
    # - Conditional question tree (config-driven from JurisdictionConfig.es_flow_config)
    # - Shareholders list (when required by flow)
    # - Review & Submit
    submitted_at = models.DateTimeField(null=True)
    reviewed_by = models.ForeignKey(User, null=True, on_delete=SET_NULL)
    reviewed_at = models.DateTimeField(null=True)
    field_comments = models.JSONField(default=dict)
    attention_reason = models.CharField(max_length=100, blank=True)  # Why it went to "in_review"

    class Meta:
        unique_together = ('entity', 'fiscal_year')
```

#### 7.2.2 Config-Driven ES Flow Engine

The Economic Substance decision tree varies by jurisdiction and is stored in `JurisdictionConfig.es_flow_config` as JSON. The frontend reads this config and renders questions dynamically.

**Flow config structure (example for BVI):**
```json
{
  "initial_step": "relevant_activities",
  "steps": {
    "relevant_activities": {
      "type": "multi_select",
      "options": ["Banking", "Insurance", "Fund management", "Financing & leasing", ...],
      "special_option": "None of the above",
      "next": {
        "default": "attention_activities",
        "None of the above": "shares_question"
      }
    },
    "shares_question": {
      "type": "yes_no",
      "text": "Are the only assets directly owned by the entity shares of stock in another company?",
      "next": {"yes": "income_question", "no": "tax_residence"}
    },
    "income_question": {
      "type": "yes_no",
      "text": "Is the income earned by the entity dividends or capital gains from the shares of stock?",
      "next": {"yes": "investment_decisions", "no": "tax_residence"}
    },
    "investment_decisions": {
      "type": "yes_no",
      "text": "Are the decisions regarding investments approved by directors/shareholders/agents in the jurisdiction?",
      "next": {"yes": "shareholders", "no": "tax_residence"}
    },
    "shareholders": {
      "type": "shareholders_list",
      "source": "kyc",
      "next": {"default": "consolidated_income"}
    },
    "consolidated_income": {
      "type": "yes_no",
      "text": "Does the group have consolidated income > 750M EUR?",
      "next": {"yes": "attention_750m", "no": "tax_residence"}
    },
    "tax_residence": {
      "type": "yes_no",
      "text": "Is the entity resident for tax purposes outside the jurisdiction?",
      "next": {"yes": "tax_country_select", "no": "review_submit"}
    },
    "tax_country_select": {
      "type": "country_select",
      "next": {"default": "attention_tax_residence"}
    },
    "review_submit": {"type": "terminal", "result": "completed"},
    "attention_activities": {"type": "terminal", "result": "in_review", "reason": "relevant_activities_selected"},
    "attention_750m": {"type": "terminal", "result": "in_review", "reason": "consolidated_income_above_threshold"},
    "attention_tax_residence": {"type": "terminal", "result": "in_review", "reason": "tax_resident_outside_jurisdiction"}
  }
}
```

**Terminal outcomes:**
- `"completed"` → User sees Review & Submit, PDF confirmation email sent, status → `completed`
- `"in_review"` → User sees "Attention" message (ARIFA will contact you), status → `in_review`, notification sent to compliance team

#### 7.2.3 Frontend

- **Config-driven question renderer**: Generic React component that reads the flow config and renders the appropriate input type (yes/no, multi-select, country dropdown, shareholders list)
- **Shareholders List Management**: Add/edit/remove shareholders with ownership percentages, linked to Person records. Can pull data from KYC module if available (story 62)
- **Auto-save with change tracking**: Debounced auto-save on form changes, `flow_answers` persisted per step, visual indicator of unsaved changes
- **"Save for later"**: Explicit save button sets status to `in_progress`, user can resume from `current_step`
- **Page Instructions**: Side panel with contextual help text per step (story 73)
- **"Need Help" button**: Visible on every screen, sends support request to ARIFA (see §7.8)
- **Review & Submit**: Summary page showing all questions and answers as accordion, confirmation modal, status update, PDF email confirmation
- **Guest Form**: Guest link access (like KYC and Accounting Records)
- **ES/EN support**: All question texts and messages localized

### 7.3 Shareholders Calculator & Organigram

#### 7.3.1 Backend

The backend already has `get_ownership_tree()` and `compute_ubos()`. Enhancements needed:

- **Configurable thresholds**: Use `JurisdictionConfig.ubo_threshold_percent` per jurisdiction (BVI/BEL/BAH = 10%, Panama = 25% default, all configurable). Dropdown in UI to switch between jurisdiction threshold views.
- **Exception handling**: Add entity type flags for Stock Exchange listed, Multilateral organization, State-owned — these bypass UBO calculation. Exceptions shown as labels under legal entity nodes.
- **Multi-level indirect calculation**: Ensure recursive calculation handles chains correctly (A owns 60% of B, B owns 50% of C → A indirectly owns 30% of C). Sum direct + indirect per beneficiary.
- **Soft validations** (SP06): Non-blocking warnings when sum of shareholder percentages under a single parent exceeds 100%. Allow user to continue for special cases. Percentages valid 1-100% per node with up to 2 decimals.
- **Audit logging**: Log all ownership tree calculations with inputs, results, user, timestamp, and version (SP04).
- **Integration with KYC Review & Submit** (SP05): Identified reportable beneficiaries and percentages auto-transfer to the Review & Submit section of KYC.

#### 7.3.2 Frontend — React Flow Organigram

- **Visual ownership tree**: Interactive React Flow diagram showing entity→shareholder relationships
- **Custom nodes**: Entity nodes (blue), Person nodes (green), with name, ownership %, and risk badge
- **Edge labels**: Ownership percentages on connecting lines
- **Drill-down**: Click a node to see its details or expand further levels
- **Threshold visualization**: Nodes above UBO threshold highlighted differently
- **Jurisdiction-specific thresholds**: Dropdown to switch between jurisdiction threshold views
- **Export**: Export organigram as PNG/PDF
- **Auto-integration**: Results feed into KYC Review & Submit section

### 7.4 Risk Matrix Enhancements

#### 7.4.1 Backend

- **Risk recalculation by frequency**: Celery Beat schedule based on risk profile (high=annual, medium=biennial, low=triennial) as specified in the compliance roadmap
- **Batch recalculation**: Management command + Celery task for mass recalculation when matrix config changes
- **Risk PDF export**: Complete Gotenberg integration for risk assessment PDF generation

#### 7.4.2 Frontend

- **Risk Matrix Config Editor**: Visual editor for risk factors, weights, and thresholds
- **Risk Dashboard**: Entity risk distribution chart, high-risk entity list, recent risk changes
- **Risk Assessment Detail**: Factor-by-factor breakdown, triggered rules, historical comparison
- **Entity Risk Badge**: Color-coded risk badge (green/yellow/red) visible across all entity views

### 7.5 Accounting Records Enhancements (Panama Law 254/2021)

Already substantially built. Enhancements:

#### 7.5.1 Two Completion Methods

The user stories define two distinct paths for completing accounting records:

**Method 1: Upload Information**
- User selects "Upload Information" as completion method
- File upload (Excel, PDF, or Word) — upload is mandatory to proceed
- Optional password field for encrypted files (validated, stored encrypted)
- Goes directly to Review & Submit after upload
- Confirmation modal → "successfully completed" → PDF email confirmation

**Method 2: Seven Steps**
- User selects "Seven Steps" as completion method
- Step-by-step form wizard (7 steps) with balance sheet generation
- Amount fields are NOT required (user can proceed with empty amounts)
- Page Instructions: Side panel with contextual help on each step (info icon)
- Subtotal auto-calculated and displayed in balance sheet / income statement format
- Delete amounts via trash icon with confirmation dialog
- Steps 4+ have expandable sections ("expand to see the form")
- FAQ link in header opens FAQ modal/page
- Review & Submit shows generated balance sheet + declaration + contact person
- Confirmation → "successfully completed" → PDF email confirmation

Both methods share:
- "Save for later" button → saves progress, sets status to `in_progress`
- Print option on completion screens
- Dashboard/Years update on completion
- Status logic: all years completed → entity status = `completed`

#### 7.5.2 Other Enhancements

- **Exempted Company support**: Controlled by `JurisdictionConfig.exempted_companies_available` (PAN/BVI = Yes, BEL = No). When selected, skips detailed form and goes to Review & Submit with declaration + contact
- **PDF generation**: Auto-generate completed form/balance sheet as PDF via Gotenberg
- **PDF email confirmation**: Send email with PDF attachment on completion (all methods)
- **Email delivery**: Integrate with notification service for sending completed records
- **Bulk creation improvements**: Admin view for bulk-creating records for all entities for a fiscal year
- **Delegation support**: Uses shared ComplianceDelegation model (§3.6)

### 7.6 Compliance Dashboard

- **KPI Cards**: Total entities, pending KYC, pending ES, pending AR, high-risk entities, overdue items
- **Entity Filtering**: By PEP status, risk level, jurisdiction, entity type, compliance status, assigned officer
- **Calendar View**: Upcoming compliance deadlines
- **Export**: CSV/Excel export of compliance data

### 7.8 "Need Help" Contact Button

Per user stories 74, 107: A "Need Help" button visible on every screen of ES, KYC, and Registros Contables modules. This is NOT the AI chatbot — it's a simple human assistance request.

**Backend:**
```python
# Uses the notification service
def request_help(*, user, entity_id, module, current_page, message=''):
    """Send a help request notification to ARIFA compliance team."""
    send_notification(
        template='help_request',
        recipients=User.objects.filter(role='compliance_officer'),
        channels=['email', 'in_app'],
        variables={
            'requester_name': user.get_full_name(),
            'requester_email': user.email,
            'entity_name': entity.name,
            'module': module,
            'current_page': current_page,
            'message': message,
        }
    )
```

**Frontend:**
- Floating "Need Help?" button (bottom-right, below AI assistant if present)
- Click opens a small form: optional message textarea + "Send Request" button
- Confirmation toast: "Your request has been sent. An ARIFA representative will contact you."
- Localized ES/EN

### 7.9 Redesign Existing Compliance Pages

Apply the ARIFA design system to all existing compliance, KYC, and risk matrix pages built in Phase 1.

---

## 8. Phase 4 — Client Services Platform & INC Workflow (Weeks 21–32)

### 8.1 New Django App: `services_platform`

```python
# backend/apps/services_platform/models.py

class ServiceCatalog(TimeStampedModel):
    """Available services offered by ARIFA."""
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)  # INC, ANNUAL, POWER_OF_ATTORNEY, etc.
    description = models.TextField()
    category = models.CharField(max_length=50)  # incorporation, corporate, compliance
    jurisdictions = models.ManyToManyField('compliance.JurisdictionRisk')
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    is_additional = models.BooleanField(default=False)  # Can be added to main service
    form_schema = models.JSONField(default=dict)  # Dynamic form fields for this service
    required_documents = models.JSONField(default=list)  # Doc types required

class PricingRule(TimeStampedModel):
    """Pricing adjustments per client category."""
    service = models.ForeignKey(ServiceCatalog, on_delete=CASCADE)
    client_category = models.CharField(max_length=20)  # silver/gold/platinum/standard
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    commission_markup_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fixed_price_override = models.DecimalField(null=True, blank=True, max_digits=10, decimal_places=2)

class ServiceRequest(TimeStampedModel):
    """A client's request for a service."""
    client = models.ForeignKey('core.Client', on_delete=CASCADE)
    entity = models.ForeignKey('core.Entity', null=True, blank=True, on_delete=SET_NULL)
    primary_service = models.ForeignKey(ServiceCatalog, on_delete=CASCADE)
    additional_services = models.ManyToManyField(ServiceCatalog, blank=True, related_name='additional_requests')
    jurisdiction = models.ForeignKey('compliance.JurisdictionRisk', on_delete=CASCADE)
    status = models.CharField(choices=[
        ('draft', 'Draft'),
        ('quoted', 'Quoted'),
        ('approved', 'Approved'),         # Client approved quote
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], default='draft')
    # Quotation
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    quoted_at = models.DateTimeField(null=True)
    # Incorporation-specific data
    form_data = models.JSONField(default=dict)  # All form data for the service
    # Links
    ticket = models.OneToOneField('workflow.Ticket', null=True, blank=True, on_delete=SET_NULL)
    guest_link = models.ForeignKey('authentication.GuestLink', null=True, blank=True, on_delete=SET_NULL)
    # Tracking
    assigned_abogado = models.ForeignKey(User, null=True, related_name='abogado_requests', on_delete=SET_NULL)
    assigned_coordinadora = models.ForeignKey(User, null=True, related_name='coord_requests', on_delete=SET_NULL)
    assigned_gestora = models.ForeignKey(User, null=True, related_name='gestora_requests', on_delete=SET_NULL)

class Quotation(TimeStampedModel):
    """Proforma/quotation for a service request."""
    service_request = models.ForeignKey(ServiceRequest, on_delete=CASCADE)
    line_items = models.JSONField()  # [{service_code, description, quantity, unit_price, total}]
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    valid_until = models.DateField()
    status = models.CharField(choices=[
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ], default='draft')
    proforma_pdf = models.FileField(upload_to='quotations/', null=True, blank=True)

class IncorporationData(TimeStampedModel):
    """Incorporation-specific data extending a ServiceRequest."""
    service_request = models.OneToOneField(ServiceRequest, on_delete=CASCADE)
    # Entity names
    preferred_names = models.JSONField(default=list)  # [{name, status: available/unavailable/selected}]
    selected_name = models.CharField(max_length=300, blank=True)
    name_verified_at = models.DateTimeField(null=True)
    # Payor info
    payor_name = models.CharField(max_length=300, blank=True)
    payor_aderant_id = models.CharField(max_length=50, blank=True)
    # Notary data
    notary_deed_number = models.CharField(max_length=50, blank=True)
    notary_sheets_used = models.IntegerField(null=True)
    stamped_sheets = models.IntegerField(null=True)
    # Public registry
    folio_number = models.CharField(max_length=50, blank=True)
    registry_date = models.DateTimeField(null=True)
    registry_document = models.FileField(null=True, blank=True)
    # Tax registration (Panama)
    nit = models.CharField(max_length=50, blank=True)
    dv = models.CharField(max_length=10, blank=True)
    ruc = models.CharField(max_length=50, blank=True)
    nit_ruc_registered = models.BooleanField(default=False)
    # High-capital flag (Story 10)
    is_high_capital = models.BooleanField(default=False)
    high_capital_notified = models.BooleanField(default=False)
    # RBUF (Panama)
    rbuf_completed = models.BooleanField(default=False)
    rbuf_completed_at = models.DateTimeField(null=True)
    # Aderant sync
    aderant_client_created = models.BooleanField(default=False)
    aderant_matter_inc_id = models.CharField(max_length=50, blank=True)
    aderant_matter_annual_id = models.CharField(max_length=50, blank=True)

class NotaryDeedPool(TimeStampedModel):
    """Pool of available notary deed numbers."""
    deed_number = models.CharField(max_length=50, unique=True)
    notary_name = models.CharField(max_length=200)
    created_date = models.DateField()
    assigned_to = models.ForeignKey(ServiceRequest, null=True, blank=True, on_delete=SET_NULL)
    assigned_at = models.DateTimeField(null=True)
    is_available = models.BooleanField(default=True)

class ExpenseRecord(TimeStampedModel):
    """Expense tracking for incorporation process."""
    service_request = models.ForeignKey(ServiceRequest, on_delete=CASCADE)
    expense_type = models.CharField(max_length=50)  # primera_tasa, reingreso, courier, etc.
    description = models.CharField(max_length=300)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    receipt = models.FileField(null=True, blank=True)
    paid_by = models.CharField(max_length=50)  # credit_card, cash, transfer
    reimbursed = models.BooleanField(default=False)
    reimbursed_at = models.DateTimeField(null=True)
    aderant_synced = models.BooleanField(default=False)
```

### 8.2 Quotation Engine

#### 8.2.1 Backend Services

```python
# backend/apps/services_platform/services.py

def calculate_quotation(*, service_request_id) -> Quotation:
    """Calculate pricing for a service request based on client category and services selected."""
    # 1. Get client category from Aderant (via harness)
    # 2. Get base prices from ServiceCatalog
    # 3. Apply PricingRule discounts/markups
    # 4. Calculate total
    # 5. Generate proforma PDF
    ...

def generate_proforma_pdf(*, quotation_id) -> str:
    """Generate proforma PDF and return file path."""
    ...
```

#### 8.2.2 Frontend

- **Service Selection**: Dropdown of available services filtered by jurisdiction
- **Additional Services**: Dynamic checkboxes for add-ons with real-time price update
- **Price Display**: Real-time subtotal/discount/total calculation based on client category
- **Proforma Generation**: Button to generate and download proforma PDF
- **Client View**: Quotation summary in client portal with accept/reject actions

### 8.3 Incorporation (INC) Workflow — Panama

Implementation of the 62+ job stories from the INC Roadmap:

#### 8.3.1 Client Registration & Onboarding (Stories 2–9)

- **Registration form**: Names, ID type/number, email, country/city (searchable dropdowns), T&C acceptance, reCAPTCHA
- **Email verification**: Verification email with branded template, password setup after verification
- **Service request form**: Multi-section form divided for easy completion, file upload for passports/IDs
- **Save as draft**: Auto-save + manual save + "continue later" functionality
- **Draft reminders**: 3/7/14 day automated email reminders via notification service
- **Passport expiry validation**: Date field with auto-validation (or OCR via Foundry)
- **Operative company fields**: Conditional economic activity selection when entity is operative

#### 8.3.2 Due Diligence (Stories 13–14)

- **Risk matrix auto-calculation**: Auto-calculate risk score from submitted form data
- **Due diligence checklist**: Per-section checklist (Entity Details, Directors/Officers, Shareholders, Beneficial Owners, Attorneys-in-fact)
- **World-Check integration**: Auto-query World-Check API for each party
- **Document verification**: OCR-based passport validation

#### 8.3.3 Payment & Aderant Client Creation (Stories 15–26)

Since payment gateway is deferred, this phase focuses on:
- **Manual payment recording**: Admin records payment receipt and amount
- **Payment approval trigger**: Coordinator approves payment → triggers RPA jobs
- **High-capital flag** (Story 10): When authorized capital exceeds a configurable threshold, auto-notify accounting team to release card funds. Flag visible as icon/badge on Kanban cards and reports for that incorporation.
- **RPA: Create Client in Aderant**: `INC_CREATE_CLIENT` job
- **RPA: Create Entity/Matter in Aderant**: `INC_CREATE_MATTER_INC` + `INC_CREATE_MATTER_ANNUAL` jobs
- **RPA: Create Payor**: `INC_CREATE_PAYOR` job
- **Billing group setup**: Based on language, country, and other parametrized data

#### 8.3.4 Gestora Assignment & Document Processing (Stories 27–37)

- **Auto-assignment**: Assign to gestora with least active incorporations (configurable)
- **Gestora dashboard**: Filtered Kanban view showing DOC_PROCESSING workflow
- **Notary deed pool**: Module for loading deed number ranges (e.g., 2035–2060), auto-generation of individual numbers
- **Deed number assignment**: Select and assign from available pool, auto-state-change to "En Proceso"
- **Document assembly trigger**: Auto-generate documents when state changes to "En Proceso":
  - Carátula (cover page)
  - Pacto Social (articles of incorporation)
  - Protocolo
  - Share certificates
  - Share register
  - Powers of attorney (if requested)
  - Director resignations (if requested)
  - Cover letter (carta remisoria) with digital signature
- **Notary sheets tracking**: Record sheets used and stamped sheets for accounting control

#### 8.3.5 Legal Support & Notary (Stories 38–41)

- **Legal support Kanban**: Separate LEGAL_SUPPORT workflow
- **Auto-create entry**: When gestora moves to "Notaría", auto-create entry in legal support board
- **Delayed alerts**: Automated notifications when items exceed 24 business hours in notary
- **Bulk state update**: Select multiple items and batch-update state
- **Notarized document upload**: Upload completed notarized documents

#### 8.3.5a Digital Notary Path (Conditional)

When `JurisdictionConfig.supports_digital_notary = True` for Panama:
- **Skip Notaría stage**: Ticket uses `INC_PANAMA_DIGITAL` workflow (no Notaría or Registro Público stages)
- **Skip Legal Support board**: No entry created in LEGAL_SUPPORT Kanban
- **Document flow changes**: Documents go directly from processing to documentation stage
- **Fewer RPA jobs**: No registry presentation expenses, no folio numbers
- **Toggle per incorporation**: Each ServiceRequest can opt into digital notary path (admin setting or per-request flag)
- **Separate metrics tracking**: Dashboard tracks digital notary vs traditional notary processing times separately

#### 8.3.6 Public Registry (Stories 42–46)

- **Registry Kanban**: PUBLIC_REGISTRY workflow with stages
- **Expense tracking**: Record credit card payments per entity
- **State tracking**: Pendientes → Presentadas → Rechazada/Reingreso → Finalizado
- **Auto-notifications to accounting**: 2x daily batch notifications (AM/PM) for new expenses
- **Delayed alerts**: Auto-notifications for processes exceeding standard time in registry
- **Rejection handling**: Record rejection date, reason, comments → auto-trigger Reingreso in DOC_PROCESSING
- **Success handling**: Record folio number, date, upload registry document → trigger RPA to update Aderant statuses

#### 8.3.7 Documentation & Delivery (Stories 47–56)

- **RBUF registration**: Checkbox + timestamp in entity detail view
- **NIT/RUC registration**: Input fields + checkbox → trigger RPA to update Aderant Company Details
- **Auto-generate corporate documents**:
  - Share register (Registro de acciones)
  - Share certificates (Certificados de acciones)
  - Powers of attorney (Poderes)
  - Director resignations (Renuncias)
  - Cover letter (Carta remisoria) with digital signature
- **Client signing workflow**: Upload certificates to portal → email client → 5/3/2 day reminder sequence → client uploads signed docs → auto-notify gestora
- **Client portal access**: View all entities, documents, renewal periods
- **Archive kanban**: Auto-create entry when state → "Enviado a cliente"

#### 8.3.8 Accounting & Invoicing (Stories 51–52, 57–60)

- **Prebill auto-generation**: RPA job to gather WIP and prepare prebill in Aderant
- **Invoice generation**: RPA job to post prebill and generate invoice PDF
- **Expense reimbursement workflow**: ACCOUNTING_REIMB Kanban (Pendientes → Validación → Reembolso → Autorización → Facturado)
- **Vendor invoice creation**: RPA step to create invoice in Aderant for first tasa única
- **Disbursement recording**: RPA step to add disbursement entries
- **Reimbursement tracking**: Checkbox + auto-update accounting entries via RPA
- **Unfactured alert**: Notification when incorporation completes without invoice in Aderant

#### 8.3.9 Reports & Dashboards (Stories 49, 61)

- **Incorporation dashboard**: Filterable by jurisdiction, abogado, coordinator, entity type, period, status
- **Metrics**: Total incorporations, average processing time, billing totals, services breakdown
- **Commission report**: Auto-calculate registry processor commissions based on presentation/approval dates and timing criteria
- **Expense report**: Real-time expense view per entity, accessible by all backoffice users

### 8.4 Incorporation (INC) Workflow — BVI

BVI has fundamentally different stages than Panama (65% step reduction target). No notary or public registry involvement.

#### 8.4.1 BVI Workflow Stages (INC_BVI)

| # | Stage | Description | Key Activities |
|---|-------|-------------|----------------|
| 1 | **Prospección** | Client contact & service request | Same as Panama: registration, quotation, form submission |
| 2 | **Debida Diligencia** | Compliance review | Same as Panama: risk matrix, DD checklist, World-Check, document verification |
| 3 | **M&A - COI** | Memorandum & Articles of Association + Certificate of Incorporation | Prepare M&A docs, submit to BVI registry, receive COI |
| 4 | **Documentación** | Corporate document generation | Generate: M&A, share certificates, share register, powers of attorney, director resignations, cover letter |
| 5 | **Firma de Cliente** | Client document signing | Upload certificates to portal, email client, reminder sequence (5d/3d/2d), client uploads signed docs |
| 6 | **Presentar ROD-ROM-ROB** | File Register of Directors, Register of Members, Register of Beneficial Owners | Submit to BVI Financial Services Commission |
| 7 | **Enviado Cliente** | Documents sent to client | Final document package delivery, courier tracking |
| 8 | **Finalizado** | Process complete | Archive, billing, notifications |

#### 8.4.2 BVI-Specific Differences

- **No Notary**: Documents don't require notarization → no deed numbers, no notary sheets tracking
- **No Public Registry**: BVI entities registered via Financial Services Commission, not a public registry → no folio numbers, no first tasa única
- **ROD/ROM/ROB Filing**: Required filing of beneficial ownership registers with BVI authorities
- **Different document templates**: Memorandum & Articles (instead of Pacto Social), COI (instead of Inscripción)
- **Different RPA jobs**: No client status update to "Open" in Aderant via registry; instead triggered after COI receipt
- **Different expense structure**: No registry presentation fees, different filing fees

#### 8.4.3 BVI Document Assembly

| Document | Template | Variables |
|----------|----------|-----------|
| Memorandum of Association | `bvi/memorandum.docx` | Entity name, registered agent, objects, authorized shares |
| Articles of Association | `bvi/articles.docx` | Entity name, director rules, share classes, meeting rules |
| Certificate of Incorporation | Received from registry | — |
| Share Certificate | `bvi/share_certificate.docx` | Entity name, shareholder, shares, class |
| Register of Directors | `bvi/rod.docx` | Directors list with details |
| Register of Members | `bvi/rom.docx` | Shareholders list with share details |
| Register of Beneficial Owners | `bvi/rob.docx` | UBOs identified by Shareholders Calculator |

#### 8.4.4 BVI Kanban Boards

Unlike Panama (which has 6 separate team Kanbans), BVI uses fewer boards since there's no notary/registry team involvement:
- **Coordinator/Abogado**: INC_BVI main workflow board (8 stages)
- **Gestoras**: DOC_PROCESSING board adapted for BVI (Pendientes → En Proceso → Finalizadas — no Reingreso/Notaría columns)
- **Archive**: Same ARCHIVE board as Panama

### 8.5 Client Portal Enhancements

- **Entity list**: All entities owned by client with status badges
- **Entity detail**: Full entity information, documents, compliance status, renewal dates
- **Document library**: All documents per entity, download capability
- **Service request tracking**: Real-time status of active service requests
- **Notification center**: In-app notifications with read/unread status
- **Profile management**: Update personal information, change password

### 8.6 Courier & Archive Management

- **Courier tracking**: Record courier dispatch dates, tracking numbers per entity
- **Barcode/QR scanning**: Integration point for document scanning before dispatch
- **Archive Kanban**: Track physical document archival process
- **Batch dispatch report**: Daily report of packages to be sent

---

## 9. Phase 5 — Automation, AI & Polish (Weeks 33–40)

### 9.1 AI Assistant

#### 9.1.1 Backend

```python
# backend/apps/core/integrations/ai_assistant.py

class AIAssistant:
    """Context-aware AI assistant powered by Claude API."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._configured = bool(getattr(settings, 'ANTHROPIC_API_KEY', ''))

    async def get_response(self, *, message: str, context: dict) -> str:
        """Get AI response with entity/form context."""
        if not self._configured:
            return self._mock_response(message)

        system_prompt = self._build_system_prompt(context)
        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            system=system_prompt,
            messages=[{"role": "user", "content": message}],
            max_tokens=1024,
        )
        return response.content[0].text

    def _build_system_prompt(self, context: dict) -> str:
        """Build context-aware system prompt based on current page/form."""
        # Include: current form fields, entity data, jurisdiction rules,
        # compliance requirements, help documentation
        ...

    def _mock_response(self, message: str) -> str:
        """Return helpful mock responses when API not configured."""
        ...
```

#### 9.1.2 API Endpoints

```
POST /api/ai/chat/          # Send message, get response
POST /api/ai/suggest/       # Get field suggestions for current form
POST /api/ai/explain-risk/  # Explain risk assessment in natural language
POST /api/ai/review-doc/    # Review uploaded document for completeness
```

#### 9.1.3 Frontend Widget

- **Floating chat widget**: Per the ARIFA UI standards §2.10 AI assistant pattern
- **Context-aware**: Knows which page/form the user is on
- **Suggested questions**: Pre-populated based on current context
- **Form assistance**: Can suggest values for form fields based on entity data
- **Risk explanations**: Natural language explanation of risk scores and factors
- **Document review**: Upload document and get completeness assessment
- **Bilingual**: Responds in ES or EN based on user's language preference

### 9.2 Advanced Email System

- **Branded email templates**: HTML templates with ARIFA logos, consistent styling
- **Delivery tracking**: Track opens, clicks, bounces
- **Reminder engine**: Configurable multi-step reminder campaigns
- **Daily digest**: Configurable daily summary emails for back-office users
- **Batch notifications**: AM/PM accounting notification batches

### 9.3 Advanced Reporting

- **Incorporation metrics dashboard**: Processing times, volumes, bottlenecks
- **Compliance overview dashboard**: KYC/ES/AR completion rates, risk distribution
- **Financial dashboard**: Billing totals, outstanding AR, expense tracking
- **User activity dashboard**: Actions per user, workload distribution
- **CSV/Excel export**: All report views exportable
- **Printable reports**: Print-optimized versions of all dashboards

### 9.4 Gestora Auto-Assignment Algorithm

```python
def auto_assign_gestora(*, ticket_id, jurisdiction_id=None):
    """Assign ticket to the gestora with the least active workload."""
    gestoras = User.objects.filter(
        role='gestora',
        is_active=True,
        # Exclude gestoras on leave (vacation flag)
        profile__is_on_leave=False,
    )
    if jurisdiction_id:
        gestoras = gestoras.filter(profile__jurisdictions=jurisdiction_id)

    # Count active tickets per gestora
    gestora_loads = gestoras.annotate(
        active_count=Count('assigned_tickets', filter=Q(
            assigned_tickets__current_state__is_final=False
        ))
    ).order_by('active_count')

    if gestora_loads.exists():
        return gestora_loads.first()
    return None
```

### 9.5 Search & Filtering Enhancements

- **Dynamic entity search**: Search across all modules (entities, persons, matters, tickets)
- **Advanced filters**: Multi-criteria filtering on all list views
- **Saved filters**: Users can save and reuse filter combinations
- **Natural persons module**: Dedicated view for managing directors, attorneys, beneficial owners across entities

### 9.6 Existing Page Redesign Completion

Complete the redesign of all remaining pages to match ARIFA UI standards:
- Dashboard
- Ticket list/detail
- Admin panel
- Client list/detail
- Entity list/detail
- Person list/detail
- All compliance pages

### 9.7 Internationalization Completion

- Audit all ES/EN translations
- Add missing translation keys for new features
- Date/number formatting per locale
- Currency formatting (USD primary, support for local currencies)

---

## 10. Phase 6 — UAT, Stabilization & Go-Live (Weeks 41–44)

### 10.1 User Acceptance Testing

- **Test scenarios**: Based on all user stories from the docs
- **Test users**: Representatives from each role (coordinator, compliance officer, gestora, director, client)
- **Jurisdiction-specific testing**: Test flows for Panama, BVI, Belize, Bahamas
- **Integration testing**: Aderant SOAP (or mock verification), World-Check, notifications

### 10.2 Performance Optimization

- Database query optimization (N+1 elimination, proper indexing)
- Frontend bundle size optimization (code splitting per route)
- Celery task optimization (batch operations, connection pooling)
- Redis caching strategy for frequently accessed data

### 10.3 Security Audit

- OWASP Top 10 review
- Authentication/authorization review
- API rate limiting verification
- Input validation audit
- CORS configuration review
- Secret management verification

### 10.4 Documentation

- API documentation via Swagger (auto-generated)
- User manual (client portal)
- Admin manual (back-office operations)
- Technical documentation (architecture, deployment, configuration)

### 10.5 Bug Fixes & Stabilization

- 2-week buffer for bug fixes from UAT
- Performance tuning based on test results
- Final UI polish

---

## 11. Integration Architecture

### 11.1 Integration Status Matrix

| Integration | Adapter | Mock Mode | Live Mode | Phase |
|-------------|---------|-----------|-----------|-------|
| **Aderant SOAP** | `aderant_soap/` | Comprehensive mock data | SOAP via zeep | Phase 2 |
| **World-Check** | `compliance/integrations/worldcheck.py` | Mock screening results | REST API | Phase 3 |
| **File Storage** | `common/storage.py` | Local file storage | SharePoint if configured | Phase 2 |
| **Claude AI** | `core/integrations/ai_assistant.py` | Mock responses | Claude API | Phase 5 |
| **Gotenberg** | `documents/integrations/gotenberg.py` | Skip PDF conversion | Gotenberg service | Phase 3 |
| **Foundry OCR** | Already configured | — | Already live | — |
| **Email (SMTP)** | Django email backend | Mailpit (dev) | SES/SMTP (prod) | Phase 2 |

### 11.2 Harness Pattern

Every integration follows the same pattern:

```python
class IntegrationHarness:
    def __init__(self):
        self._configured = self._check_config()
        if not self._configured:
            logger.warning(f"{self.name} not configured - using mock data")

    def _check_config(self) -> bool:
        """Check if required credentials/URLs are set."""
        ...

    @property
    def mode(self) -> str:
        return "live" if self._configured else "mock"
```

---

## 12. Data Model Extensions

### 12.1 New Models Summary

| App | Model | Purpose |
|-----|-------|---------|
| workflow | `WorkflowDefinition` | Named workflow definitions |
| workflow | Updated `WorkflowState` | FK to definition, color, auto-transition |
| workflow | Updated `Ticket` | FK to definition, parent_ticket, jurisdiction, metadata |
| compliance | `ComplianceDelegation` | Shared delegation of entities across modules |
| compliance | `EconomicSubstanceSubmission` | ES annual filing with config-driven flow |
| compliance | `DueDiligenceChecklist` | Per-section DD activity tracking |
| compliance | `JurisdictionConfig` | Jurisdiction-specific settings (incl. ES flow config, UBO thresholds) |
| services_platform | `ServiceCatalog` | Available services |
| services_platform | `PricingRule` | Category-based pricing |
| services_platform | `ServiceRequest` | Client service requests |
| services_platform | `Quotation` | Proforma quotations |
| services_platform | `IncorporationData` | INC-specific data |
| services_platform | `NotaryDeedPool` | Notary deed number management |
| services_platform | `ExpenseRecord` | Expense tracking |
| notifications | `NotificationTemplate` | Email/in-app templates |
| notifications | `Notification` | Individual notifications |
| notifications | `NotificationPreference` | User preferences |
| notifications | `ReminderCampaign` | Reminder sequences |
| notifications | `ReminderStep` | Campaign steps |
| notifications | `DeliveryLog` | Delivery tracking |
| rpa | `RPAJobDefinition` | Job type definitions |
| rpa | `RPAJob` | Job executions |
| rpa | `RPAJobStep` | Step execution logs |

### 12.2 Model Modifications

| Model | Change |
|-------|--------|
| `WorkflowState` | Add `workflow_definition` FK, `color`, `auto_transition_hours`, `required_fields`, `on_enter_actions` |
| `Ticket` | Add `workflow_definition` FK, `parent_ticket` FK, `jurisdiction` FK, `metadata` JSON |
| `User` | Add profile fields: `is_on_leave`, `jurisdictions` M2M, `max_concurrent_tickets` |
| `Entity` | Add `is_stock_exchange_listed`, `is_multilateral`, `is_state_owned` booleans |

---

## 13. API Contracts

### 13.1 New Endpoints

#### Workflow
```
GET    /api/workflow/definitions/                    # List workflow definitions
POST   /api/workflow/definitions/                    # Create definition (director)
GET    /api/workflow/definitions/{id}/               # Definition detail
GET    /api/workflow/definitions/{id}/kanban/        # Kanban data for definition
POST   /api/workflow/tickets/{id}/spawn-sub/         # Spawn sub-ticket
POST   /api/workflow/tickets/bulk-transition/        # Bulk state change
GET    /api/workflow/tickets/{id}/sub-tickets/       # List sub-tickets
```

#### Services Platform
```
GET    /api/services/catalog/                        # Service catalog
GET    /api/services/catalog/{code}/pricing/         # Pricing for a service
POST   /api/services/requests/                       # Create service request
GET    /api/services/requests/                       # List requests (filtered)
GET    /api/services/requests/{id}/                  # Request detail
PATCH  /api/services/requests/{id}/                  # Update request
POST   /api/services/requests/{id}/calculate-quote/  # Calculate quotation
GET    /api/services/requests/{id}/quotation/        # Get quotation
POST   /api/services/requests/{id}/approve-quote/    # Client approves quote
# Incorporation-specific
GET    /api/services/requests/{id}/incorporation/    # INC data
PATCH  /api/services/requests/{id}/incorporation/    # Update INC data
POST   /api/services/requests/{id}/verify-name/      # Check name availability
# Notary deed pool
GET    /api/services/notary-deeds/                   # List available deeds
POST   /api/services/notary-deeds/bulk-create/       # Create range of deeds
POST   /api/services/notary-deeds/{id}/assign/       # Assign deed to request
# Expenses
GET    /api/services/requests/{id}/expenses/         # List expenses
POST   /api/services/requests/{id}/expenses/         # Add expense
# Reports
GET    /api/services/reports/incorporations/         # INC dashboard data
GET    /api/services/reports/commissions/             # Commission report
GET    /api/services/reports/expenses/                # Expense report
```

#### Notifications
```
GET    /api/notifications/                           # User's notifications
POST   /api/notifications/{id}/mark-read/            # Mark as read
POST   /api/notifications/mark-all-read/             # Mark all as read
GET    /api/notifications/unread-count/               # Unread count
GET    /api/notifications/templates/                  # List templates (admin)
PATCH  /api/notifications/templates/{id}/             # Update template
```

#### RPA
```
GET    /api/rpa/jobs/                                # List RPA jobs
GET    /api/rpa/jobs/{id}/                           # Job detail with steps
POST   /api/rpa/jobs/{id}/retry/                     # Retry failed job
POST   /api/rpa/jobs/{id}/cancel/                    # Cancel pending job
GET    /api/rpa/definitions/                         # List job definitions
```

#### AI Assistant
```
POST   /api/ai/chat/                                 # Chat message
POST   /api/ai/suggest/                              # Field suggestions
POST   /api/ai/explain-risk/                         # Risk explanation
POST   /api/ai/review-doc/                           # Document review
```

#### Economic Substance
```
GET    /api/compliance/economic-substance/            # List submissions
POST   /api/compliance/economic-substance/            # Create submission
GET    /api/compliance/economic-substance/{id}/       # Detail
PATCH  /api/compliance/economic-substance/{id}/       # Update (draft)
POST   /api/compliance/economic-substance/{id}/submit/ # Submit
POST   /api/compliance/economic-substance/{id}/approve/ # Approve
POST   /api/compliance/economic-substance/{id}/reject/  # Reject
GET    /api/compliance/economic-substance/{id}/guest/ # Guest view
```

---

## 14. Testing Strategy

### 14.1 Backend Tests

| Category | Framework | Target Coverage |
|----------|-----------|-----------------|
| Unit tests | pytest + pytest-django | 80%+ service layer |
| API tests | DRF APITestCase | All endpoints |
| Integration tests | pytest + docker | Aderant SOAP mock, Celery tasks |
| Model tests | pytest-django | Constraints, validators, signals |

### 14.2 Frontend Tests

| Category | Framework | Target Coverage |
|----------|-----------|-----------------|
| Component tests | Vitest + Testing Library | All design system components |
| Page tests | Vitest + Testing Library | Critical user flows |
| E2E tests | Playwright | Happy paths for each workflow |

### 14.3 Integration Tests

- Aderant SOAP adapter: Test all operations against mock WSDL
- RPA jobs: Test full job execution with mock Aderant responses
- Notification service: Test template rendering and delivery
- Document assembly: Test template variable injection and PDF generation

---

## 15. Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Aderant SOAP API differs from 2018 docs | High | Medium | Comprehensive mock layer allows full development without live Aderant; adapter can be updated when live access available |
| Scope creep from 62+ INC stories | High | High | Strict phase boundaries; each story has clear acceptance criteria; MVP first |
| UI redesign delays | Medium | Medium | Design system built first; pages updated incrementally during feature work |
| Multi-workflow engine complexity | High | Medium | Start with 2 workflows (INC + KYC), add others incrementally |
| Jurisdiction configuration complexity | Medium | Low | Seed migrations with sensible defaults; admin UI for overrides |
| Performance with complex ownership trees | Medium | Low | Pagination, lazy loading, cached calculations |
| Email deliverability | Medium | Medium | Start with Mailpit dev → test with real SMTP early |

---

## 16. Deferred Items

These items are explicitly deferred and should be planned in future iterations:

| Item | Reason | Prerequisite |
|------|--------|--------------|
| Payment gateway (Stripe) | Business decision to defer | Quotation module built |
| Power BI integration | Analytics platform not ready | Data warehouse setup |
| SMS/Push notifications | Email-first approach | Notification service stable |
| Microservices bus (Kafka/RabbitMQ) | Not needed at current scale | High volume requirements |
| HotDocs integration | Using built-in doc assembly | Business need for HotDocs |
| Identity Server / Active Directory | SSO-ready but not connected | AD infrastructure available |
| Mobile app | Web-first, responsive design | Core platform stable |
| Advanced search (Elasticsearch) | Basic filtering sufficient | Performance requirements |
| Two-Factor Authentication | Phase 5 consideration | Security audit results |
| CI/CD pipelines (Bitbucket) | Docker Compose for now | Cloud deployment decision |
| Cloud deployment (AWS/Azure) | Local/Docker for now | Infrastructure decision |
| Belize/Bahamas full workflows | Panama + BVI first | Jurisdiction config system |
| Collections (Cobros) workflow | Deferred with payment gateway | Payment module built |
| DGI form auto-completion (RPA) | Fragile website automation | Validate with ARIFA team |
| Aderant flat file expense import | Use SOAP adapter instead | Aderant SOAP adapter stable |
| IT Support user role | Not in initial scope | Role system extensible |
| View-only reporting role | Not in initial scope | Role system extensible |
| Customer support ticketing | Not in initial scope | Notification service stable |

---

## Appendix A: Document Reference Map

| Document | Relevant Phases |
|----------|----------------|
| Historias de usuario - Cumplimiento por módulo.pdf | Phase 3 (Compliance) |
| ARIFA Plataforma de cumplimiento - Product Roadmap.pdf | Phase 3 (Compliance), Phase 5 (Automation) |
| (ARIFA) Roadmap Proceso Inc. - Automatizaciones.pdf | Phase 4 (INC Workflow) |
| Customer Journey - BVI.pdf | Phase 4 (BVI adaptation) |
| ARIFA 2025 - Presentación iteración III 27.06.pdf | Phase 4 (process optimization targets) |
| RFP DESARROLLO DE LA PLATAFORMA DE SERVICIOS INTEGRAL DE ARIFA_1202.pdf | All phases (master scope) |
| Tecnológico Estándar de Desarrollo - ARIFA - 1.0.2.pdf | Phase 1 (standards adoption) |
| ARIFA - Estándares Patrones y Guías de Diseño v1.0.0.pdf | Phase 1 (design system) |
| Aderant Expert API Reference Guides (5 PDFs) | Phase 2 (SOAP adapter) |

## Appendix B: Aderant SOAP Endpoint Map

| Module | Service Endpoint | Operations |
|--------|-----------------|------------|
| Auth | `/Tools/ToolsWS/AuthenticationService.asmx` | Authenticate, GetSOAPHeader |
| Security | `/Tools/ToolsWS/FunctionalSecurityService.asmx` | CheckRights |
| BOS | `/Tools/ToolsWS/BOSService.asmx` | SubmitJob, GetJobStatus |
| Locking | `/Tools/ToolsWS/DbLockService.asmx` | Lock, Unlock |
| Client | `/FileOpening/ClientService.asmx` | Create, Read, Update, Delete |
| Matter | `/FileOpening/MatterService.asmx` | Create, Read, Update, Delete |
| Name | `/FileOpening/NameService.asmx` | Create, Read, Update, Delete |
| Address | `/FileOpening/AddressService.asmx` | Create, Read, Update, Delete |
| BillGroup | `/FileOpening/BillGroupService.asmx` | Create, Read, Update |
| Time | `/Time/TimeEntryService.asmx` | Create, Update, Delete, Release |
| Billing | `/Billing/` (BOS-based) | GatherWIP, PreparePrebill, PostBill |

## Appendix C: Environment Variables to Add

```env
# Aderant SOAP (Phase 2)
ADERANT_SOAP_URL=https://<server>/CMSNet/
ADERANT_USERNAME=
ADERANT_PASSWORD=
ADERANT_DOMAIN=        # For NTLM auth

# World-Check (Phase 3)
WORLDCHECK_API_URL=
WORLDCHECK_API_KEY=
WORLDCHECK_API_SECRET=
WORLDCHECK_GROUP_ID=

# SharePoint (optional - falls back to local storage)
SHAREPOINT_URL=
SHAREPOINT_CLIENT_ID=
SHAREPOINT_CLIENT_SECRET=
SHAREPOINT_SITE_ID=

# Claude AI (Phase 5)
ANTHROPIC_API_KEY=

# Auth (Phase 1)
JWT_SECRET_KEY=
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7

# Notifications
EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=true
DEFAULT_FROM_EMAIL=noreply@arifa.com
```
