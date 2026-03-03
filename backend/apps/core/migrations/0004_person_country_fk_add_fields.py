"""Add temporary FK fields for nationality and country_of_residence on Person.

Step 1 of 3: adds nationality_new and country_of_residence_new as nullable FK
columns pointing to compliance.JurisdictionRisk. The old CharFields are untouched.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_entityofficer_polymorphic_positions"),
        ("compliance", "0002_populate_jurisdictionrisk"),
    ]

    operations = [
        migrations.AddField(
            model_name="person",
            name="nationality_new",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="compliance.jurisdictionrisk",
            ),
        ),
        migrations.AddField(
            model_name="person",
            name="country_of_residence_new",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="compliance.jurisdictionrisk",
            ),
        ),
    ]
