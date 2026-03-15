"""Seed workflow definitions with states and transitions.

Creates 11 workflow definitions with their full state/transition trees.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.workflow.models import WorkflowDefinition, WorkflowState, WorkflowTransition

# ---------------------------------------------------------------------------
# Workflow Definitions Data
# ---------------------------------------------------------------------------

ALL_ROLES = ["director", "compliance_officer", "coordinator", "gestora"]

DEFINITIONS = [
    {
        "name": "INC_PANAMA",
        "display_name": "Panama Incorporation",
        "category": "incorporation",
        "description": "Standard Panama S.A. incorporation workflow with notary, registry, and NIT/RUC steps.",
        "states": [
            {"name": "New", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "KYC Review", "order_index": 1, "color": "#3B82F6"},
            {"name": "Drafting", "order_index": 2, "color": "#8B5CF6"},
            {"name": "Notary", "order_index": 3, "color": "#F59E0B"},
            {"name": "Public Registry", "order_index": 4, "color": "#F97316"},
            {"name": "NIT/RUC", "order_index": 5, "color": "#EF4444"},
            {"name": "File Opening", "order_index": 6, "color": "#10B981"},
            {"name": "Completed", "order_index": 7, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("New", "KYC Review", "Start KYC Review", ALL_ROLES),
            ("KYC Review", "Drafting", "Approve KYC", ["director", "compliance_officer"]),
            ("KYC Review", "New", "Send Back", ["director", "compliance_officer"]),
            ("Drafting", "Notary", "Send to Notary", ["coordinator", "gestora"]),
            ("Notary", "Public Registry", "Notarized", ["coordinator", "gestora"]),
            ("Public Registry", "NIT/RUC", "Registered", ["coordinator", "gestora"]),
            ("NIT/RUC", "File Opening", "NIT/RUC Obtained", ["coordinator", "gestora"]),
            ("File Opening", "Completed", "Complete", ALL_ROLES),
        ],
    },
    {
        "name": "INC_PANAMA_DIGITAL",
        "display_name": "Panama Digital Incorporation",
        "category": "incorporation",
        "description": "Digital notary workflow for Panama incorporations.",
        "states": [
            {"name": "New", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "KYC Review", "order_index": 1, "color": "#3B82F6"},
            {"name": "Drafting", "order_index": 2, "color": "#8B5CF6"},
            {"name": "Digital Notary", "order_index": 3, "color": "#F59E0B"},
            {"name": "Public Registry", "order_index": 4, "color": "#F97316"},
            {"name": "NIT/RUC", "order_index": 5, "color": "#EF4444"},
            {"name": "Completed", "order_index": 6, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("New", "KYC Review", "Start KYC Review", ALL_ROLES),
            ("KYC Review", "Drafting", "Approve KYC", ["director", "compliance_officer"]),
            ("KYC Review", "New", "Send Back", ["director", "compliance_officer"]),
            ("Drafting", "Digital Notary", "Submit Digital", ["coordinator", "gestora"]),
            ("Digital Notary", "Public Registry", "Notarized", ["coordinator", "gestora"]),
            ("Public Registry", "NIT/RUC", "Registered", ["coordinator", "gestora"]),
            ("NIT/RUC", "Completed", "Complete", ALL_ROLES),
        ],
    },
    {
        "name": "INC_BVI",
        "display_name": "BVI Incorporation",
        "category": "incorporation",
        "description": "British Virgin Islands BC Company incorporation.",
        "states": [
            {"name": "New", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "KYC Review", "order_index": 1, "color": "#3B82F6"},
            {"name": "Drafting", "order_index": 2, "color": "#8B5CF6"},
            {"name": "Registry Agent", "order_index": 3, "color": "#F59E0B"},
            {"name": "File Opening", "order_index": 4, "color": "#10B981"},
            {"name": "Completed", "order_index": 5, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("New", "KYC Review", "Start KYC Review", ALL_ROLES),
            ("KYC Review", "Drafting", "Approve KYC", ["director", "compliance_officer"]),
            ("KYC Review", "New", "Send Back", ["director", "compliance_officer"]),
            ("Drafting", "Registry Agent", "Submit to Agent", ["coordinator", "gestora"]),
            ("Registry Agent", "File Opening", "Incorporated", ["coordinator", "gestora"]),
            ("File Opening", "Completed", "Complete", ALL_ROLES),
        ],
    },
    {
        "name": "DOC_PROCESSING",
        "display_name": "Document Processing",
        "category": "documents",
        "description": "General document drafting and processing workflow.",
        "states": [
            {"name": "Requested", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "Drafting", "order_index": 1, "color": "#3B82F6"},
            {"name": "Review", "order_index": 2, "color": "#F59E0B"},
            {"name": "Approved", "order_index": 3, "color": "#10B981"},
            {"name": "Delivered", "order_index": 4, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Requested", "Drafting", "Start Drafting", ["coordinator", "gestora"]),
            ("Drafting", "Review", "Submit for Review", ["coordinator", "gestora"]),
            ("Review", "Drafting", "Request Changes", ["director", "compliance_officer"]),
            ("Review", "Approved", "Approve", ["director"]),
            ("Approved", "Delivered", "Deliver", ALL_ROLES),
        ],
    },
    {
        "name": "LEGAL_SUPPORT",
        "display_name": "Legal Support",
        "category": "legal_support",
        "description": "Legal consultation and support request workflow.",
        "states": [
            {"name": "Open", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "In Progress", "order_index": 1, "color": "#3B82F6"},
            {"name": "Pending Client", "order_index": 2, "color": "#F59E0B"},
            {"name": "Resolved", "order_index": 3, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Open", "In Progress", "Start Work", ALL_ROLES),
            ("In Progress", "Pending Client", "Waiting on Client", ALL_ROLES),
            ("Pending Client", "In Progress", "Client Responded", ALL_ROLES),
            ("In Progress", "Resolved", "Resolve", ALL_ROLES),
        ],
    },
    {
        "name": "PUBLIC_REGISTRY",
        "display_name": "Public Registry Filing",
        "category": "registry",
        "description": "Filing and tracking for public registry submissions.",
        "states": [
            {"name": "Pending", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "Submitted", "order_index": 1, "color": "#3B82F6"},
            {"name": "Under Review", "order_index": 2, "color": "#F59E0B"},
            {"name": "Corrections Needed", "order_index": 3, "color": "#EF4444"},
            {"name": "Registered", "order_index": 4, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Pending", "Submitted", "Submit to Registry", ["coordinator", "gestora"]),
            ("Submitted", "Under Review", "In Review", ["coordinator", "gestora"]),
            ("Under Review", "Corrections Needed", "Needs Corrections", ["coordinator", "gestora"]),
            ("Corrections Needed", "Submitted", "Resubmit", ["coordinator", "gestora"]),
            ("Under Review", "Registered", "Registered", ALL_ROLES),
        ],
    },
    {
        "name": "ACCOUNTING_REIMB",
        "display_name": "Accounting & Reimbursement",
        "category": "accounting",
        "description": "Accounting record filing and reimbursement tracking.",
        "states": [
            {"name": "Pending", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "In Progress", "order_index": 1, "color": "#3B82F6"},
            {"name": "Under Review", "order_index": 2, "color": "#F59E0B"},
            {"name": "Approved", "order_index": 3, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Pending", "In Progress", "Start", ALL_ROLES),
            ("In Progress", "Under Review", "Submit for Review", ALL_ROLES),
            ("Under Review", "In Progress", "Request Changes", ["director", "compliance_officer"]),
            ("Under Review", "Approved", "Approve", ["director"]),
        ],
    },
    {
        "name": "ARCHIVE",
        "display_name": "Archive Process",
        "category": "archive",
        "description": "Entity archival and closure workflow.",
        "states": [
            {"name": "Requested", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "Compliance Check", "order_index": 1, "color": "#3B82F6"},
            {"name": "Pending Closure", "order_index": 2, "color": "#F59E0B"},
            {"name": "Archived", "order_index": 3, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Requested", "Compliance Check", "Start Check", ["compliance_officer", "director"]),
            ("Compliance Check", "Pending Closure", "Clear for Closure", ["compliance_officer", "director"]),
            ("Compliance Check", "Requested", "Blocked", ["compliance_officer", "director"]),
            ("Pending Closure", "Archived", "Archive", ["director"]),
        ],
    },
    {
        "name": "COMPLIANCE_KYC",
        "display_name": "KYC Compliance Review",
        "category": "compliance",
        "description": "KYC submission and compliance review cycle.",
        "states": [
            {"name": "Draft", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "Submitted", "order_index": 1, "color": "#3B82F6"},
            {"name": "Under Review", "order_index": 2, "color": "#F59E0B"},
            {"name": "RFI Sent", "order_index": 3, "color": "#EF4444"},
            {"name": "Approved", "order_index": 4, "is_final": True, "color": "#059669"},
            {"name": "Rejected", "order_index": 5, "is_final": True, "color": "#DC2626"},
        ],
        "transitions": [
            ("Draft", "Submitted", "Submit", ALL_ROLES),
            ("Submitted", "Under Review", "Start Review", ["compliance_officer", "director"]),
            ("Under Review", "RFI Sent", "Request Information", ["compliance_officer", "director"]),
            ("RFI Sent", "Under Review", "RFI Responded", ALL_ROLES),
            ("Under Review", "Approved", "Approve", ["compliance_officer", "director"]),
            ("Under Review", "Rejected", "Reject", ["director"]),
        ],
    },
    {
        "name": "COMPLIANCE_ES",
        "display_name": "Economic Substance Filing",
        "category": "compliance",
        "description": "Economic Substance declaration and filing workflow.",
        "states": [
            {"name": "Pending", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "Data Collection", "order_index": 1, "color": "#3B82F6"},
            {"name": "Review", "order_index": 2, "color": "#F59E0B"},
            {"name": "Filed", "order_index": 3, "color": "#10B981"},
            {"name": "Confirmed", "order_index": 4, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Pending", "Data Collection", "Start Collection", ALL_ROLES),
            ("Data Collection", "Review", "Submit for Review", ALL_ROLES),
            ("Review", "Data Collection", "Need More Info", ["compliance_officer", "director"]),
            ("Review", "Filed", "File Declaration", ["compliance_officer", "director"]),
            ("Filed", "Confirmed", "Confirm Receipt", ALL_ROLES),
        ],
    },
    {
        "name": "CUSTOM",
        "display_name": "Custom Workflow",
        "category": "custom",
        "description": "Generic customizable workflow template.",
        "states": [
            {"name": "Open", "order_index": 0, "is_initial": True, "color": "#6B7280"},
            {"name": "In Progress", "order_index": 1, "color": "#3B82F6"},
            {"name": "Closed", "order_index": 2, "is_final": True, "color": "#059669"},
        ],
        "transitions": [
            ("Open", "In Progress", "Start", ALL_ROLES),
            ("In Progress", "Closed", "Close", ALL_ROLES),
            ("In Progress", "Open", "Reopen", ALL_ROLES),
        ],
    },
]


class Command(BaseCommand):
    help = "Seed 11 workflow definitions with states and transitions"

    @transaction.atomic
    def handle(self, *args, **options):
        created = 0
        skipped = 0

        for defn in DEFINITIONS:
            if WorkflowDefinition.objects.filter(name=defn["name"]).exists():
                self.stdout.write(f"  Skipped {defn['name']} (already exists)")
                skipped += 1
                continue

            # Create definition
            wf_def = WorkflowDefinition.objects.create(
                name=defn["name"],
                display_name=defn["display_name"],
                category=defn["category"],
                description=defn["description"],
                is_active=True,
                config={},
            )

            # Create states
            state_map = {}
            for state_data in defn["states"]:
                state = WorkflowState.objects.create(
                    workflow_definition=wf_def,
                    name=state_data["name"],
                    order_index=state_data["order_index"],
                    is_initial=state_data.get("is_initial", False),
                    is_final=state_data.get("is_final", False),
                    color=state_data.get("color", "#6B7280"),
                )
                state_map[state_data["name"]] = state

            # Create transitions
            for from_name, to_name, trans_name, roles in defn["transitions"]:
                WorkflowTransition.objects.create(
                    from_state=state_map[from_name],
                    to_state=state_map[to_name],
                    name=trans_name,
                    allowed_roles=roles,
                )

            created += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"  Created {defn['name']}: "
                    f"{len(defn['states'])} states, "
                    f"{len(defn['transitions'])} transitions"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {created} created, {skipped} skipped."
            )
        )
