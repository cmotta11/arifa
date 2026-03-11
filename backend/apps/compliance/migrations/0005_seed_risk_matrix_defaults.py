"""
Data migration: seed default RiskMatrixConfig, RiskFactors, AutomaticTriggerRules,
and back-populate entity FKs on existing RiskAssessments.
"""

from django.db import migrations


def seed_defaults(apps, schema_editor):
    RiskMatrixConfig = apps.get_model("compliance", "RiskMatrixConfig")
    RiskFactor = apps.get_model("compliance", "RiskFactor")
    AutomaticTriggerRule = apps.get_model("compliance", "AutomaticTriggerRule")
    RiskAssessment = apps.get_model("compliance", "RiskAssessment")

    # ── Create global default config ──────────────────────────────
    config = RiskMatrixConfig.objects.create(
        name="Global Default",
        jurisdiction="",
        entity_type="",
        version=1,
        is_active=True,
        high_risk_threshold=70,
        medium_risk_threshold=40,
        notes="Auto-generated default config matching original 4-factor weights.",
    )

    # ── Entity-level factors ──────────────────────────────────────
    entity_factors = [
        ("jurisdiction", "entity", 15, "Entity jurisdiction risk weight scaled to max"),
        ("structure_complexity", "entity", 10, "Party count + corporate layers"),
        ("activity_risk", "entity", 15, "Max activity risk level"),
        ("source_of_funds_risk", "entity", 15, "Max source of funds risk + country"),
        ("ownership_opacity", "entity", 10, "Ownership tree depth, trustee/nominee indicators"),
        ("multi_jurisdiction", "entity", 10, "Distinct high-risk jurisdictions"),
        ("relationship_age", "entity", 5, "Time since entity incorporation"),
        ("pep_status", "entity", 10, "Any linked person is PEP"),
        ("sanctions_screening", "entity", 10, "Worst WorldCheckCase status across linked persons"),
    ]
    for code, category, max_score, desc in entity_factors:
        RiskFactor.objects.create(
            matrix_config=config,
            code=code,
            category=category,
            max_score=max_score,
            description=desc,
        )

    # ── Person-level factors ──────────────────────────────────────
    person_factors = [
        ("nationality_risk", "person", 20, "Person nationality risk weight"),
        ("residence_risk", "person", 15, "Person country of residence risk weight"),
        ("pep_status", "person", 25, "PEP status boolean"),
        ("sanctions_screening", "person", 25, "WorldCheckCase screening status"),
        ("source_of_wealth_risk", "person", 10, "Max source of wealth risk level"),
        ("id_verification", "person", 5, "ID document verification status"),
    ]
    for code, category, max_score, desc in person_factors:
        RiskFactor.objects.create(
            matrix_config=config,
            code=code,
            category=category,
            max_score=max_score,
            description=desc,
        )

    # ── Default automatic trigger rules ───────────────────────────
    triggers = [
        ("pep_status", "high", "PEP detected on any linked person"),
        ("sanctions_match", "high", "Sanctions TRUE_MATCH on any linked person"),
        ("high_risk_jurisdiction", "high", "FATF blacklist jurisdiction (risk_weight >= 9)"),
        ("complex_structure", "medium", "Complex corporate structure (>3 layers)"),
    ]
    for condition, level, desc in triggers:
        AutomaticTriggerRule.objects.create(
            matrix_config=config,
            condition=condition,
            forced_risk_level=level,
            is_active=True,
            description=desc,
        )

    # ── Back-populate entity FKs on existing RiskAssessments ──────
    for assessment in RiskAssessment.objects.filter(
        kyc_submission__isnull=False, entity__isnull=True
    ).select_related("kyc_submission__ticket"):
        try:
            entity_id = assessment.kyc_submission.ticket.entity_id
            if entity_id:
                assessment.entity_id = entity_id
                assessment.save(update_fields=["entity_id"])
        except Exception:
            pass


def reverse_seed(apps, schema_editor):
    RiskMatrixConfig = apps.get_model("compliance", "RiskMatrixConfig")
    RiskMatrixConfig.objects.filter(name="Global Default", version=1).delete()

    RiskAssessment = apps.get_model("compliance", "RiskAssessment")
    RiskAssessment.objects.filter(entity__isnull=False).update(entity=None)


class Migration(migrations.Migration):

    dependencies = [
        ("compliance", "0004_risk_matrix_system"),
    ]

    operations = [
        migrations.RunPython(seed_defaults, reverse_seed),
    ]
