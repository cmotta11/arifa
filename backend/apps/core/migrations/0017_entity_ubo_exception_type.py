# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_entity_nominal_directors'),
    ]

    operations = [
        migrations.AddField(
            model_name='entity',
            name='ubo_exception_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('stock_exchange', 'Listed on Stock Exchange'),
                    ('multilateral', 'Multilateral Organization'),
                    ('state_owned', 'State-Owned Entity'),
                ],
                default='',
                max_length=30,
            ),
        ),
    ]
