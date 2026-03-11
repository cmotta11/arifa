# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_add_person_last_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='entity',
            name='nominal_directors_requested',
            field=models.BooleanField(default=False),
        ),
    ]
