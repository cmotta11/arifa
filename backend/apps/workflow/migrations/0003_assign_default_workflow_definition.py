"""Step 2 of 3: Data migration - create default INC_PANAMA workflow definition
and assign all existing states and tickets to it."""

from django.db import migrations


def forward(apps, schema_editor):
    WorkflowDefinition = apps.get_model("workflow", "WorkflowDefinition")
    WorkflowState = apps.get_model("workflow", "WorkflowState")
    Ticket = apps.get_model("workflow", "Ticket")

    # Only create the default if states exist
    if not WorkflowState.objects.exists():
        return

    default_def = WorkflowDefinition.objects.create(
        name="INC_PANAMA",
        display_name="Panama Incorporation",
        description="Default incorporation workflow for Panama entities",
        category="incorporation",
        is_active=True,
        config={},
    )

    # Assign all existing states to this definition
    WorkflowState.objects.filter(workflow_definition__isnull=True).update(
        workflow_definition=default_def,
    )

    # Assign all existing tickets to this definition
    Ticket.objects.filter(workflow_definition__isnull=True).update(
        workflow_definition=default_def,
    )


def backward(apps, schema_editor):
    WorkflowState = apps.get_model("workflow", "WorkflowState")
    Ticket = apps.get_model("workflow", "Ticket")
    WorkflowDefinition = apps.get_model("workflow", "WorkflowDefinition")

    # Clear the FK references
    WorkflowState.objects.all().update(workflow_definition=None)
    Ticket.objects.all().update(workflow_definition=None)

    # Delete the default definition
    WorkflowDefinition.objects.filter(name="INC_PANAMA").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0002_workflowdefinition_and_model_updates"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
