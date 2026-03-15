"""Step 1 of 3: Add WorkflowDefinition model, add nullable FKs to
WorkflowState and Ticket, add new fields."""

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0001_initial"),
        ("compliance", "0009_jurisdictionconfig"),
    ]

    operations = [
        # 1. Create WorkflowDefinition
        migrations.CreateModel(
            name="WorkflowDefinition",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=100, unique=True)),
                ("display_name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("incorporation", "Incorporation"),
                            ("compliance", "Compliance"),
                            ("documents", "Documents"),
                            ("legal_support", "Legal Support"),
                            ("registry", "Registry"),
                            ("accounting", "Accounting"),
                            ("archive", "Archive"),
                            ("custom", "Custom"),
                        ],
                        default="custom",
                        max_length=20,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("config", models.JSONField(blank=True, default=dict)),
                (
                    "jurisdiction",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="workflow_definitions",
                        to="compliance.jurisdictionrisk",
                    ),
                ),
            ],
            options={
                "verbose_name": "Workflow Definition",
                "verbose_name_plural": "Workflow Definitions",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        # 2. WorkflowState: drop old unique on name, add nullable workflow_definition FK
        migrations.AlterField(
            model_name="workflowstate",
            name="name",
            field=models.CharField(max_length=100),
        ),
        migrations.AddField(
            model_name="workflowstate",
            name="workflow_definition",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="states",
                to="workflow.workflowdefinition",
            ),
        ),
        migrations.AddField(
            model_name="workflowstate",
            name="color",
            field=models.CharField(blank=True, default="#6B7280", max_length=7),
        ),
        migrations.AddField(
            model_name="workflowstate",
            name="auto_transition_hours",
            field=models.IntegerField(
                blank=True,
                null=True,
                help_text="Automatically transition after N hours (null = disabled)",
            ),
        ),
        migrations.AddField(
            model_name="workflowstate",
            name="required_fields",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Fields required before entering this state",
            ),
        ),
        migrations.AddField(
            model_name="workflowstate",
            name="on_enter_actions",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Actions to trigger when entering this state",
            ),
        ),
        # 3. Ticket: add nullable FKs
        migrations.AddField(
            model_name="ticket",
            name="workflow_definition",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tickets",
                to="workflow.workflowdefinition",
            ),
        ),
        migrations.AddField(
            model_name="ticket",
            name="parent_ticket",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="sub_tickets",
                to="workflow.ticket",
            ),
        ),
        migrations.AddField(
            model_name="ticket",
            name="jurisdiction",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tickets",
                to="compliance.jurisdictionrisk",
            ),
        ),
        migrations.AddField(
            model_name="ticket",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
