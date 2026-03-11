"""
Risk Matrix System - new models and RiskAssessment enhancements.

Adds:
- RiskMatrixConfig (versioned weight configuration per jurisdiction + entity type)
- RiskFactor (individual factor in a matrix config)
- AutomaticTriggerRule (rules that force a risk level)
- ComplianceSnapshot (batch analysis point-in-time)

Modifies RiskAssessment:
- Makes kyc_submission nullable
- Adds entity, person FKs
- Adds matrix_config FK + snapshot fields
- Adds triggered_rules, is_auto_triggered, assessed_by, snapshot FK
- Adds CheckConstraint requiring at least one subject
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0003_entity_audit_and_kyc_changes"),
        ("core", "0015_add_person_last_name"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── New models ──────────────────────────────────────────────
        migrations.CreateModel(
            name="RiskMatrixConfig",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=__import__("uuid").uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("jurisdiction", models.CharField(blank=True, default="", max_length=20)),
                ("entity_type", models.CharField(blank=True, default="", max_length=20)),
                ("version", models.PositiveIntegerField(default=1)),
                ("is_active", models.BooleanField(default=True)),
                ("high_risk_threshold", models.IntegerField(default=70)),
                ("medium_risk_threshold", models.IntegerField(default=40)),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="risk_matrix_configs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Risk Matrix Config",
                "verbose_name_plural": "Risk Matrix Configs",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="RiskFactor",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=__import__("uuid").uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "code",
                    models.CharField(
                        choices=[
                            ("jurisdiction", "Jurisdiction Risk"),
                            ("structure_complexity", "Structure Complexity"),
                            ("activity_risk", "Activity Risk"),
                            ("source_of_funds_risk", "Source of Funds Risk"),
                            ("ownership_opacity", "Ownership Opacity"),
                            ("multi_jurisdiction", "Multi-Jurisdiction Exposure"),
                            ("relationship_age", "Relationship Age"),
                            ("nationality_risk", "Nationality Risk"),
                            ("residence_risk", "Residence Risk"),
                            ("pep_status", "PEP Status"),
                            ("sanctions_screening", "Sanctions Screening"),
                            ("source_of_wealth_risk", "Source of Wealth Risk"),
                            ("id_verification", "ID Verification"),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    "category",
                    models.CharField(
                        choices=[("entity", "Entity"), ("person", "Person")],
                        max_length=10,
                    ),
                ),
                ("max_score", models.IntegerField()),
                ("description", models.TextField(blank=True, default="")),
                ("scoring_rules_json", models.JSONField(blank=True, default=dict)),
                (
                    "matrix_config",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="factors",
                        to="compliance.riskmatrixconfig",
                    ),
                ),
            ],
            options={
                "verbose_name": "Risk Factor",
                "verbose_name_plural": "Risk Factors",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="riskfactor",
            constraint=models.UniqueConstraint(
                fields=("matrix_config", "code", "category"),
                name="unique_factor_per_config",
            ),
        ),
        migrations.CreateModel(
            name="AutomaticTriggerRule",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=__import__("uuid").uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "condition",
                    models.CharField(
                        choices=[
                            ("pep_status", "PEP Detected"),
                            ("sanctions_match", "Sanctions Match"),
                            ("high_risk_jurisdiction", "High-Risk Jurisdiction"),
                            ("complex_structure", "Complex Structure"),
                        ],
                        max_length=30,
                    ),
                ),
                (
                    "forced_risk_level",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("medium", "Medium"),
                            ("high", "High"),
                        ],
                        default="high",
                        max_length=10,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("description", models.TextField(blank=True, default="")),
                (
                    "matrix_config",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trigger_rules",
                        to="compliance.riskmatrixconfig",
                    ),
                ),
            ],
            options={
                "verbose_name": "Automatic Trigger Rule",
                "verbose_name_plural": "Automatic Trigger Rules",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        migrations.CreateModel(
            name="ComplianceSnapshot",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=__import__("uuid").uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("snapshot_date", models.DateTimeField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("running", "Running"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        default="running",
                        max_length=20,
                    ),
                ),
                ("total_entities", models.IntegerField(default=0)),
                ("total_persons", models.IntegerField(default=0)),
                ("high_risk_count", models.IntegerField(default=0)),
                ("medium_risk_count", models.IntegerField(default=0)),
                ("low_risk_count", models.IntegerField(default=0)),
                ("notes", models.TextField(blank=True, default="")),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="compliance_snapshots",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Compliance Snapshot",
                "verbose_name_plural": "Compliance Snapshots",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        # ── Modify RiskAssessment ───────────────────────────────────
        # Make kyc_submission nullable
        migrations.AlterField(
            model_name="riskassessment",
            name="kyc_submission",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="risk_assessments",
                to="compliance.kycsubmission",
            ),
        ),
        # Add entity FK
        migrations.AddField(
            model_name="riskassessment",
            name="entity",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="risk_assessments",
                to="core.entity",
            ),
        ),
        # Add person FK
        migrations.AddField(
            model_name="riskassessment",
            name="person",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="risk_assessments",
                to="core.person",
            ),
        ),
        # Add matrix_config FK
        migrations.AddField(
            model_name="riskassessment",
            name="matrix_config",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assessments",
                to="compliance.riskmatrixconfig",
            ),
        ),
        # Add snapshot fields
        migrations.AddField(
            model_name="riskassessment",
            name="matrix_config_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="input_data_snapshot",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="triggered_rules",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="is_auto_triggered",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="assessed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="risk_assessments",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="snapshot",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="assessments",
                to="compliance.compliancesnapshot",
            ),
        ),
        # Add CheckConstraint
        migrations.AddConstraint(
            model_name="riskassessment",
            constraint=models.CheckConstraint(
                check=(
                    models.Q(entity__isnull=False)
                    | models.Q(person__isnull=False)
                    | models.Q(kyc_submission__isnull=False)
                ),
                name="risk_assessment_has_subject",
            ),
        ),
    ]
