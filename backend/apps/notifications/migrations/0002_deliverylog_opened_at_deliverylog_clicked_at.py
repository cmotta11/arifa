# Generated manually for Phase 5.3 email tracking enhancements

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="deliverylog",
            name="opened_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="deliverylog",
            name="clicked_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
