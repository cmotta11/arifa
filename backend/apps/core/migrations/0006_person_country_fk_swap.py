"""Drop old CharField columns and rename FK columns to final names.

Step 3 of 3: removes nationality and country_of_residence (CharField), then
renames nationality_new -> nationality and country_of_residence_new ->
country_of_residence with the correct related_names.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_person_country_fk_data"),
    ]

    operations = [
        # Drop old CharFields
        migrations.RemoveField(
            model_name="person",
            name="nationality",
        ),
        migrations.RemoveField(
            model_name="person",
            name="country_of_residence",
        ),
        # Rename temp FK columns to final names
        migrations.RenameField(
            model_name="person",
            old_name="nationality_new",
            new_name="nationality",
        ),
        migrations.RenameField(
            model_name="person",
            old_name="country_of_residence_new",
            new_name="country_of_residence",
        ),
        # Fix related_names to match the model definition
        migrations.AlterField(
            model_name="person",
            name="nationality",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="persons_by_nationality",
                to="compliance.jurisdictionrisk",
            ),
        ),
        migrations.AlterField(
            model_name="person",
            name="country_of_residence",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="persons_by_residence",
                to="compliance.jurisdictionrisk",
            ),
        ),
    ]
