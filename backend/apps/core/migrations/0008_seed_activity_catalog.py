"""Seed ActivityCatalog with common business activities and their default risk levels."""

from django.db import migrations


ACTIVITIES = [
    ("International Trade & Commerce", "medium"),
    ("Investment Management & Advisory", "medium"),
    ("Real Estate Transactions", "medium"),
    ("Mining & Extractive Industries", "high"),
    ("Cryptocurrency & Digital Assets", "high"),
    ("Banking & Financial Services", "high"),
    ("Gambling & Gaming", "ultra_high"),
    ("Arms & Defense", "ultra_high"),
    ("Non-Profit & Charitable Organizations", "medium"),
    ("Legal & Professional Services", "low"),
    ("Technology & Software Services", "low"),
    ("Construction & Development", "medium"),
    ("Agriculture & Farming", "low"),
    ("Pharmaceutical & Healthcare", "medium"),
    ("Oil, Gas & Energy", "high"),
]


def seed_activities(apps, schema_editor):
    ActivityCatalog = apps.get_model("core", "ActivityCatalog")
    for name, risk_level in ACTIVITIES:
        ActivityCatalog.objects.get_or_create(
            name=name,
            defaults={"default_risk_level": risk_level},
        )


def reverse_seed(apps, schema_editor):
    ActivityCatalog = apps.get_model("core", "ActivityCatalog")
    names = [name for name, _ in ACTIVITIES]
    ActivityCatalog.objects.filter(name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_entityactivity_countries_m2m"),
    ]

    operations = [
        migrations.RunPython(seed_activities, reverse_seed),
    ]
