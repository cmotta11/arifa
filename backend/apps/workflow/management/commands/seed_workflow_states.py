from django.core.management.base import BaseCommand
from django.db import transaction

from apps.authentication.constants import (
    COMPLIANCE_OFFICER,
    COORDINATOR,
    DIRECTOR,
    GESTORA,
)
from apps.workflow.models import WorkflowState, WorkflowTransition


STATES = [
    {"name": "Recibido", "order_index": 1, "is_initial": True, "is_final": False},
    {"name": "Revisión Compliance", "order_index": 2, "is_initial": False, "is_final": False},
    {"name": "En Proceso", "order_index": 3, "is_initial": False, "is_final": False},
    {"name": "Registro Público", "order_index": 4, "is_initial": False, "is_final": False},
    {"name": "Completado", "order_index": 5, "is_initial": False, "is_final": True},
    {"name": "Rechazado", "order_index": 6, "is_initial": False, "is_final": True},
]

# Transitions between consecutive states
CONSECUTIVE_TRANSITIONS = [
    {
        "from": "Recibido",
        "to": "Revisión Compliance",
        "name": "Enviar a Compliance",
        "allowed_roles": [COORDINATOR],
    },
    {
        "from": "Revisión Compliance",
        "to": "En Proceso",
        "name": "Aprobar Compliance",
        "allowed_roles": [COMPLIANCE_OFFICER],
    },
    {
        "from": "En Proceso",
        "to": "Registro Público",
        "name": "Enviar a Registro Público",
        "allowed_roles": [GESTORA, COORDINATOR],
    },
    {
        "from": "Registro Público",
        "to": "Completado",
        "name": "Completar",
        "allowed_roles": [GESTORA, COORDINATOR, DIRECTOR],
    },
]

# Rejection transitions from every non-final state
REJECTION_SOURCES = ["Recibido", "Revisión Compliance", "En Proceso", "Registro Público"]
REJECTION_ROLES = [COORDINATOR, COMPLIANCE_OFFICER, DIRECTOR]


class Command(BaseCommand):
    help = "Seed the INC workflow states and transitions."

    @transaction.atomic
    def handle(self, *args, **options):
        # Create or update states
        state_map = {}
        for state_data in STATES:
            state, created = WorkflowState.objects.update_or_create(
                name=state_data["name"],
                defaults={
                    "order_index": state_data["order_index"],
                    "is_initial": state_data["is_initial"],
                    "is_final": state_data["is_final"],
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action} state: {state.name}")
            state_map[state.name] = state

        # Create consecutive transitions
        for trans_data in CONSECUTIVE_TRANSITIONS:
            transition, created = WorkflowTransition.objects.update_or_create(
                from_state=state_map[trans_data["from"]],
                to_state=state_map[trans_data["to"]],
                defaults={
                    "name": trans_data["name"],
                    "allowed_roles": trans_data["allowed_roles"],
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action} transition: {transition.name}")

        # Create rejection transitions
        rechazado = state_map["Rechazado"]
        for source_name in REJECTION_SOURCES:
            from_state = state_map[source_name]
            transition, created = WorkflowTransition.objects.update_or_create(
                from_state=from_state,
                to_state=rechazado,
                defaults={
                    "name": f"Rechazar desde {source_name}",
                    "allowed_roles": REJECTION_ROLES,
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action} transition: {transition.name}")

        self.stdout.write(
            self.style.SUCCESS("Workflow states and transitions seeded successfully.")
        )
