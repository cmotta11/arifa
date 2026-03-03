"""Seed SourceOfFundsCatalog with common source of funds categories and default risk levels."""

from django.db import migrations


SOURCES = [
    ("Corporate Revenue / Business Operations", "low"),
    ("Investment Returns / Dividends", "low"),
    ("Personal Savings", "low"),
    ("Insurance Proceeds", "low"),
    ("Sale of Securities", "low"),
    ("Inheritance / Family Wealth", "medium"),
    ("Sale of Real Estate", "medium"),
    ("Loan / Financing", "medium"),
    ("Trust / Foundation Distributions", "medium"),
    ("Government Contracts", "medium"),
    ("International Wire Transfers", "high"),
    ("Cash Intensive Business", "high"),
    ("Third-Party Funding", "high"),
    ("Cryptocurrency / Digital Assets", "high"),
    ("Gambling / Gaming Revenue", "ultra_high"),
]


def seed_sources(apps, schema_editor):
    SourceOfFundsCatalog = apps.get_model("core", "SourceOfFundsCatalog")
    for name, risk_level in SOURCES:
        SourceOfFundsCatalog.objects.get_or_create(
            name=name,
            defaults={"default_risk_level": risk_level},
        )


def reverse_seed(apps, schema_editor):
    SourceOfFundsCatalog = apps.get_model("core", "SourceOfFundsCatalog")
    names = [name for name, _ in SOURCES]
    SourceOfFundsCatalog.objects.filter(name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_sourceoffundscatalog_update_sourceoffunds"),
    ]

    operations = [
        migrations.RunPython(seed_sources, reverse_seed),
    ]
