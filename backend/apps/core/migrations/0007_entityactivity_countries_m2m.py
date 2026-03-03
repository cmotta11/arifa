"""Replace EntityActivity.country CharField with countries M2M to JurisdictionRisk."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_person_country_fk_swap"),
        ("compliance", "0002_populate_jurisdictionrisk"),
    ]

    operations = [
        # Add M2M field
        migrations.AddField(
            model_name="entityactivity",
            name="countries",
            field=models.ManyToManyField(
                blank=True,
                related_name="entity_activities",
                to="compliance.jurisdictionrisk",
            ),
        ),
        # Remove old country CharField
        migrations.RemoveField(
            model_name="entityactivity",
            name="country",
        ),
    ]
