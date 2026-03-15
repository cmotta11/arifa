"""Seed RPA job definitions.

Creates 10 standard job definition templates for common Aderant/ARIFA
operations.
"""

from django.core.management.base import BaseCommand

from apps.rpa.models import RPAJobDefinition

DEFINITIONS = [
    {
        "name": "INC_CREATE_CLIENT",
        "display_name": "Create Client in Aderant",
        "description": "Creates a new client record in Aderant Expert via SOAP.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["client_name", "client_type"],
        "step_definitions": [
            {"name": "Create Aderant Client", "action": "aderant_create_client", "config": {}},
            {"name": "Update ARIFA Entity", "action": "update_arifa_entity", "config": {}},
        ],
    },
    {
        "name": "INC_CREATE_MATTER_INC",
        "display_name": "Create Incorporation Matter",
        "description": "Creates an incorporation matter in Aderant Expert.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["client_name", "matter_description"],
        "step_definitions": [
            {"name": "Open File in Aderant", "action": "aderant_open_file", "config": {}},
            {"name": "Update ARIFA Entity", "action": "update_arifa_entity", "config": {}},
        ],
    },
    {
        "name": "INC_OPEN_FILE",
        "display_name": "Open Client/Matter File",
        "description": "Opens a complete client + matter file in Aderant.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["client_name", "matter_description"],
        "step_definitions": [
            {"name": "Open File in Aderant", "action": "aderant_open_file", "config": {}},
            {"name": "Update ARIFA Entity", "action": "update_arifa_entity", "config": {}},
            {
                "name": "Advance Ticket",
                "action": "transition_ticket",
                "config": {"target_state_name": "File Opening"},
            },
        ],
    },
    {
        "name": "SYNC_CLIENT_DATA",
        "display_name": "Sync Client from Aderant",
        "description": "Fetches client data from Aderant and updates ARIFA.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["aderant_client_id"],
        "step_definitions": [
            {"name": "Fetch Client Data", "action": "aderant_sync_client", "config": {}},
            {"name": "Update ARIFA Entity", "action": "update_arifa_entity", "config": {}},
        ],
    },
    {
        "name": "POST_TIME_ENTRY",
        "display_name": "Post Time Entry",
        "description": "Posts a time entry to an Aderant matter.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["matter_id", "attorney_id", "hours"],
        "step_definitions": [
            {"name": "Post Time Entry", "action": "aderant_post_time", "config": {}},
        ],
    },
    {
        "name": "INC_COMPLETE_WORKFLOW",
        "display_name": "Complete Incorporation Workflow",
        "description": "Runs full incorporation RPA: open file, create matter, advance ticket.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["client_name", "matter_description"],
        "step_definitions": [
            {"name": "Create Client", "action": "aderant_create_client", "config": {}},
            {"name": "Open Incorporation File", "action": "aderant_open_file", "config": {}},
            {"name": "Update ARIFA Entity", "action": "update_arifa_entity", "config": {}},
            {
                "name": "Advance to File Opening",
                "action": "transition_ticket",
                "config": {"target_state_name": "File Opening"},
            },
        ],
    },
    {
        "name": "ANNUAL_COMPLIANCE",
        "display_name": "Annual Compliance Filing",
        "description": "Creates a compliance matter and posts initial time.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["client_name"],
        "step_definitions": [
            {
                "name": "Create Compliance Matter",
                "action": "aderant_create_matter",
                "config": {},
            },
            {"name": "Post Filing Time", "action": "aderant_post_time", "config": {}},
        ],
    },
    {
        "name": "ES_FILING",
        "display_name": "Economic Substance Filing RPA",
        "description": "Handles economic substance filing in Aderant.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["client_name", "matter_description"],
        "step_definitions": [
            {"name": "Create ES Matter", "action": "aderant_create_matter", "config": {}},
            {"name": "Update Entity", "action": "update_arifa_entity", "config": {}},
            {
                "name": "Advance Ticket",
                "action": "transition_ticket",
                "config": {"target_state_name": "Filed"},
            },
        ],
    },
    {
        "name": "ARCHIVE_ENTITY",
        "display_name": "Archive Entity in Aderant",
        "description": "Closes matters and archives client in Aderant.",
        "target_integration": "aderant_soap",
        "required_input_fields": ["aderant_client_id"],
        "step_definitions": [
            {"name": "Sync Client Data", "action": "aderant_sync_client", "config": {}},
            {
                "name": "Archive Notification",
                "action": "noop",
                "config": {"message": "Entity archived in Aderant"},
            },
        ],
    },
    {
        "name": "MANUAL_REVIEW",
        "display_name": "Manual Review Checkpoint",
        "description": "Placeholder job for manual review steps.",
        "target_integration": "internal",
        "required_input_fields": [],
        "step_definitions": [
            {
                "name": "Awaiting Manual Review",
                "action": "noop",
                "config": {"message": "This step requires manual review"},
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed 10 RPA job definitions"

    def handle(self, *args, **options):
        created = 0
        skipped = 0

        for defn in DEFINITIONS:
            _, was_created = RPAJobDefinition.objects.update_or_create(
                name=defn["name"],
                defaults={
                    "display_name": defn["display_name"],
                    "description": defn["description"],
                    "target_integration": defn["target_integration"],
                    "required_input_fields": defn["required_input_fields"],
                    "step_definitions": defn["step_definitions"],
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  Created {defn['name']}"))
            else:
                skipped += 1
                self.stdout.write(f"  Updated {defn['name']}")

        self.stdout.write(
            self.style.SUCCESS(f"\nDone: {created} created, {skipped} updated.")
        )
