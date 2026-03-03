import django.db.models.deletion
from django.db import migrations, models


def convert_position_to_positions(apps, schema_editor):
    """Convert single position string values to JSON list format."""
    EntityOfficer = apps.get_model("core", "EntityOfficer")
    for officer in EntityOfficer.objects.all():
        # After RenameField, the field is now called 'positions' but still holds a string
        val = officer.positions
        if isinstance(val, str) and val:
            officer.positions = [val]
        elif not val:
            officer.positions = []
        # If already a list (unlikely), leave it
        officer.save(update_fields=["positions"])


def convert_positions_to_position(apps, schema_editor):
    """Reverse: take first element of list back to string."""
    EntityOfficer = apps.get_model("core", "EntityOfficer")
    for officer in EntityOfficer.objects.all():
        val = officer.positions
        if isinstance(val, list) and val:
            officer.positions = val[0]
        else:
            officer.positions = ""
        officer.save(update_fields=["positions"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_activitycatalog_entityactivity_entityofficer_and_more"),
    ]

    operations = [
        # 1. Rename person -> officer_person
        migrations.RenameField(
            model_name="entityofficer",
            old_name="person",
            new_name="officer_person",
        ),
        # 2. Make officer_person nullable
        migrations.AlterField(
            model_name="entityofficer",
            name="officer_person",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="officer_positions",
                to="core.person",
            ),
        ),
        # 3. Add officer_entity FK
        migrations.AddField(
            model_name="entityofficer",
            name="officer_entity",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="officer_positions_as_entity",
                to="core.entity",
            ),
        ),
        # 4. Rename position -> positions
        migrations.RenameField(
            model_name="entityofficer",
            old_name="position",
            new_name="positions",
        ),
        # 5. Convert existing string data to list before changing field type
        migrations.RunPython(
            convert_position_to_positions,
            convert_positions_to_position,
        ),
        # 6. Change field type to JSONField
        migrations.AlterField(
            model_name="entityofficer",
            name="positions",
            field=models.JSONField(default=list),
        ),
        # 7. Add XOR constraint
        migrations.AddConstraint(
            model_name="entityofficer",
            constraint=models.CheckConstraint(
                check=(
                    models.Q(
                        officer_person__isnull=False,
                        officer_entity__isnull=True,
                    )
                    | models.Q(
                        officer_person__isnull=True,
                        officer_entity__isnull=False,
                    )
                ),
                name="entity_officer_holder_xor",
            ),
        ),
    ]
