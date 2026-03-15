# Generated manually

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0006_guestlink_accounting_record_and_more'),
        ('compliance', '0010_phase3_models'),
    ]

    operations = [
        # Remove old 3-target constraint
        migrations.RemoveConstraint(
            model_name='guestlink',
            name='guest_link_exactly_one_target',
        ),
        # Add ES submission FK
        migrations.AddField(
            model_name='guestlink',
            name='es_submission',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='guest_links',
                to='compliance.economicsubstancesubmission',
            ),
        ),
        # Re-add constraint with 4 targets
        migrations.AddConstraint(
            model_name='guestlink',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ('ticket__isnull', False),
                        ('kyc_submission__isnull', True),
                        ('accounting_record__isnull', True),
                        ('es_submission__isnull', True),
                    ),
                    models.Q(
                        ('ticket__isnull', True),
                        ('kyc_submission__isnull', False),
                        ('accounting_record__isnull', True),
                        ('es_submission__isnull', True),
                    ),
                    models.Q(
                        ('ticket__isnull', True),
                        ('kyc_submission__isnull', True),
                        ('accounting_record__isnull', False),
                        ('es_submission__isnull', True),
                    ),
                    models.Q(
                        ('ticket__isnull', True),
                        ('kyc_submission__isnull', True),
                        ('accounting_record__isnull', True),
                        ('es_submission__isnull', False),
                    ),
                    _connector='OR',
                ),
                name='guest_link_exactly_one_target',
            ),
        ),
    ]
