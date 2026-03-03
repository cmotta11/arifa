"""Add SourceOfFundsCatalog model and update SourceOfFunds to mirror EntityActivity pattern."""

import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0002_populate_jurisdictionrisk"),
        ("core", "0008_seed_activity_catalog"),
    ]

    operations = [
        # 1. Create the catalog table
        migrations.CreateModel(
            name="SourceOfFundsCatalog",
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
                ("name", models.CharField(max_length=255, unique=True)),
                (
                    "default_risk_level",
                    models.CharField(
                        choices=[
                            ("low", "Low"),
                            ("medium", "Medium"),
                            ("high", "High"),
                            ("ultra_high", "Ultra High"),
                        ],
                        default="low",
                        max_length=20,
                    ),
                ),
            ],
            options={
                "verbose_name": "Source of Funds Catalog",
                "verbose_name_plural": "Source of Funds Catalog",
                "ordering": ["-created_at"],
                "abstract": False,
            },
        ),
        # 2. Add new fields to SourceOfFunds
        migrations.AddField(
            model_name="sourceoffunds",
            name="source",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="entity_sources",
                to="core.sourceoffundscatalog",
            ),
        ),
        migrations.AddField(
            model_name="sourceoffunds",
            name="countries",
            field=models.ManyToManyField(
                blank=True,
                related_name="entity_sources_of_funds",
                to="compliance.jurisdictionrisk",
            ),
        ),
        migrations.AddField(
            model_name="sourceoffunds",
            name="country_risk_level",
            field=models.CharField(
                choices=[
                    ("low", "Low"),
                    ("medium", "Medium"),
                    ("high", "High"),
                    ("ultra_high", "Ultra High"),
                ],
                default="low",
                max_length=20,
            ),
        ),
        # 3. Make description optional (was required TextField)
        migrations.AlterField(
            model_name="sourceoffunds",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        # 4. Remove default from risk_level (now required, derived from catalog)
        migrations.AlterField(
            model_name="sourceoffunds",
            name="risk_level",
            field=models.CharField(
                choices=[
                    ("low", "Low"),
                    ("medium", "Medium"),
                    ("high", "High"),
                    ("ultra_high", "Ultra High"),
                ],
                max_length=20,
            ),
        ),
    ]
