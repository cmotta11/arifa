import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0008_accounting_record_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="JurisdictionConfig",
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
                (
                    "inc_workflow",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Default incorporation workflow definition name",
                        max_length=50,
                    ),
                ),
                ("requires_notary", models.BooleanField(default=False)),
                ("requires_registry", models.BooleanField(default=False)),
                ("requires_nit_ruc", models.BooleanField(default=False)),
                ("requires_rbuf", models.BooleanField(default=False)),
                ("supports_digital_notary", models.BooleanField(default=False)),
                (
                    "ubo_threshold_percent",
                    models.DecimalField(
                        decimal_places=2,
                        default=25,
                        help_text="Ownership % threshold for UBO identification",
                        max_digits=5,
                    ),
                ),
                (
                    "kyc_renewal_months",
                    models.IntegerField(
                        default=12,
                        help_text="Months between KYC renewal cycles",
                    ),
                ),
                (
                    "es_required",
                    models.BooleanField(
                        default=False,
                        help_text="Whether Economic Substance filing is required",
                    ),
                ),
                (
                    "ar_required",
                    models.BooleanField(
                        default=False,
                        help_text="Whether Accounting Records (Panama Law 254) filing is required",
                    ),
                ),
                (
                    "exempted_available",
                    models.BooleanField(
                        default=False,
                        help_text="Whether exempted entity category is available",
                    ),
                ),
                (
                    "entity_types",
                    models.JSONField(
                        blank=True,
                        default=list,
                        help_text="Available entity types for this jurisdiction",
                    ),
                ),
                (
                    "form_config",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Jurisdiction-specific form field configuration",
                    ),
                ),
                (
                    "es_flow_config",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Economic Substance flow configuration",
                    ),
                ),
                (
                    "jurisdiction",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="config",
                        to="compliance.jurisdictionrisk",
                    ),
                ),
                (
                    "default_risk_matrix",
                    models.ForeignKey(
                        blank=True,
                        help_text="Default risk matrix for this jurisdiction",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="jurisdiction_configs",
                        to="compliance.riskmatrixconfig",
                    ),
                ),
            ],
            options={
                "verbose_name": "Jurisdiction Configuration",
                "verbose_name_plural": "Jurisdiction Configurations",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
    ]
