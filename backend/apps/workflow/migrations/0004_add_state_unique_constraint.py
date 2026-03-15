"""Step 3 of 3: Add unique constraint on (workflow_definition, name) for WorkflowState."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0003_assign_default_workflow_definition"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="workflowstate",
            constraint=models.UniqueConstraint(
                fields=["workflow_definition", "name"],
                name="unique_state_per_workflow",
            ),
        ),
    ]
