"""Migrate Person nationality / country_of_residence text to FK references.

Step 2 of 3: For each Person with non-empty text, try to match against
JurisdictionRisk by country_code (case-insensitive) then by country_name.
Unmatched values become NULL.
"""

from django.db import migrations


def migrate_country_text_to_fk(apps, schema_editor):
    Person = apps.get_model("core", "Person")
    JurisdictionRisk = apps.get_model("compliance", "JurisdictionRisk")

    # Build lookup maps
    by_code = {}  # upper-cased country_code -> JurisdictionRisk pk
    by_name = {}  # lower-cased country_name -> JurisdictionRisk pk
    for jr in JurisdictionRisk.objects.all():
        by_code[jr.country_code.upper()] = jr.pk
        by_name[jr.country_name.lower()] = jr.pk

    def resolve(text):
        if not text:
            return None
        upper = text.strip().upper()
        # Try exact code match (e.g. "PAN", "BVI")
        if upper in by_code:
            return by_code[upper]
        # Try 3-char truncation (legacy behaviour)
        if upper[:3] in by_code:
            return by_code[upper[:3]]
        # Try name match
        lower = text.strip().lower()
        if lower in by_name:
            return by_name[lower]
        return None

    for person in Person.objects.all():
        nat_pk = resolve(person.nationality)
        cor_pk = resolve(person.country_of_residence)
        updates = {}
        if nat_pk is not None:
            updates["nationality_new_id"] = nat_pk
        if cor_pk is not None:
            updates["country_of_residence_new_id"] = cor_pk
        if updates:
            Person.objects.filter(pk=person.pk).update(**updates)


def reverse_noop(apps, schema_editor):
    pass  # No reverse: old text columns still exist at this point


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_person_country_fk_add_fields"),
    ]

    operations = [
        migrations.RunPython(migrate_country_text_to_fk, reverse_noop),
    ]
