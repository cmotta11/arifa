"""Phase 3 models: DueDiligenceChecklist, EconomicSubstanceSubmission, OwnershipSnapshot, AccountingRecord enhancements."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("compliance", "0009_jurisdictionconfig"),
        ("core", "0016_entity_nominal_directors"),
    ]

    operations = [
        # DueDiligenceChecklist
        migrations.CreateModel(
            name="DueDiligenceChecklist",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("section", models.CharField(
                    choices=[
                        ("entity_details", "Entity Details"),
                        ("directors_officers", "Directors & Officers"),
                        ("shareholders", "Shareholders"),
                        ("beneficial_owners", "Beneficial Owners"),
                        ("attorneys_in_fact", "Attorneys-in-Fact"),
                    ],
                    max_length=50,
                )),
                ("items", models.JSONField(default=list)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("completed_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="completed_checklists",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("kyc_submission", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="checklists",
                    to="compliance.kycsubmission",
                )),
            ],
            options={
                "verbose_name": "Due Diligence Checklist",
                "verbose_name_plural": "Due Diligence Checklists",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="duediligencechecklist",
            constraint=models.UniqueConstraint(
                fields=["kyc_submission", "section"],
                name="unique_checklist_per_kyc_section",
            ),
        ),
        # EconomicSubstanceSubmission
        migrations.CreateModel(
            name="EconomicSubstanceSubmission",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("fiscal_year", models.IntegerField()),
                ("status", models.CharField(
                    choices=[
                        ("pending", "Pending"),
                        ("in_progress", "In Progress"),
                        ("in_review", "In Review"),
                        ("completed", "Completed"),
                    ],
                    default="pending",
                    max_length=20,
                )),
                ("flow_answers", models.JSONField(default=dict)),
                ("current_step", models.CharField(blank=True, default="", max_length=50)),
                ("shareholders_data", models.JSONField(default=list)),
                ("submitted_at", models.DateTimeField(blank=True, null=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("field_comments", models.JSONField(blank=True, default=dict)),
                ("attention_reason", models.CharField(blank=True, default="", max_length=100)),
                ("entity", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="es_submissions",
                    to="core.entity",
                )),
                ("reviewed_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="reviewed_es_submissions",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "verbose_name": "Economic Substance Submission",
                "verbose_name_plural": "Economic Substance Submissions",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="economicsubstancesubmission",
            constraint=models.UniqueConstraint(
                fields=["entity", "fiscal_year"],
                name="unique_es_per_entity_year",
            ),
        ),
        migrations.AddIndex(
            model_name="economicsubstancesubmission",
            index=models.Index(fields=["entity", "fiscal_year"], name="es_entity_fy_idx"),
        ),
        migrations.AddIndex(
            model_name="economicsubstancesubmission",
            index=models.Index(fields=["status"], name="es_status_idx"),
        ),
        # OwnershipSnapshot
        migrations.CreateModel(
            name="OwnershipSnapshot",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("nodes", models.JSONField(default=list)),
                ("edges", models.JSONField(default=list)),
                ("reportable_ubos", models.JSONField(default=list)),
                ("warnings", models.JSONField(default=list)),
                ("entity", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="ownership_snapshots",
                    to="core.entity",
                )),
                ("saved_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="saved_ownership_snapshots",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "verbose_name": "Ownership Snapshot",
                "verbose_name_plural": "Ownership Snapshots",
                "ordering": ["-created_at"],
            },
        ),
        # AccountingRecord enhancements
        migrations.AddField(
            model_name="accountingrecord",
            name="completion_method",
            field=models.CharField(
                blank=True,
                choices=[("upload_information", "Upload Information"), ("seven_steps", "Seven Steps")],
                default="",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="accountingrecord",
            name="uploaded_file",
            field=models.FileField(blank=True, null=True, upload_to="accounting_records/uploads/"),
        ),
        migrations.AddField(
            model_name="accountingrecord",
            name="file_password",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="accountingrecord",
            name="generated_pdf",
            field=models.FileField(blank=True, null=True, upload_to="accounting_records/pdfs/"),
        ),
    ]
