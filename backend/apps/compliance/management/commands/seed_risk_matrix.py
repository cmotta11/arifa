from django.core.management.base import BaseCommand
from django.db import transaction

from apps.compliance.constants import (
    RiskFactorCategory,
    RiskFactorCode,
    RiskLevel,
    TriggerCondition,
)
from apps.compliance.models import (
    AutomaticTriggerRule,
    RiskFactor,
    RiskMatrixConfig,
)

# ---------------------------------------------------------------------------
# Default configurations
# ---------------------------------------------------------------------------

CONFIGS = [
    {
        "name": "Global Default",
        "jurisdiction": "",
        "entity_type": "",
        "version": 1,
        "is_active": True,
        "high_risk_threshold": 70,
        "medium_risk_threshold": 40,
        "notes": "Default global risk matrix configuration with FATF-aligned weights.",
    },
    {
        "name": "BVI Configuration",
        "jurisdiction": "bvi",
        "entity_type": "",
        "version": 1,
        "is_active": True,
        "high_risk_threshold": 65,
        "medium_risk_threshold": 35,
        "notes": "BVI-specific risk matrix with adjusted thresholds.",
    },
    {
        "name": "Panama Configuration",
        "jurisdiction": "panama",
        "entity_type": "",
        "version": 1,
        "is_active": True,
        "high_risk_threshold": 60,
        "medium_risk_threshold": 35,
        "notes": "Panama-specific risk matrix with lower thresholds due to FATF grey list history.",
    },
]

# Entity-level factors (default max scores sum to ~100)
ENTITY_FACTORS = [
    {
        "code": RiskFactorCode.JURISDICTION,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 15,
        "description": "Risk based on entity's jurisdiction of incorporation.",
    },
    {
        "code": RiskFactorCode.STRUCTURE_COMPLEXITY,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 10,
        "description": "Complexity of corporate structure (party count, layers).",
    },
    {
        "code": RiskFactorCode.ACTIVITY_RISK,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 15,
        "description": "Risk level of entity's business activities.",
    },
    {
        "code": RiskFactorCode.SOURCE_OF_FUNDS_RISK,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 15,
        "description": "Risk from sources of funds and associated countries.",
    },
    {
        "code": RiskFactorCode.OWNERSHIP_OPACITY,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 10,
        "description": "Opacity of ownership tree (depth, nominee/trustee usage).",
    },
    {
        "code": RiskFactorCode.MULTI_JURISDICTION,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 10,
        "description": "Exposure to multiple high-risk jurisdictions.",
    },
    {
        "code": RiskFactorCode.RELATIONSHIP_AGE,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 5,
        "description": "Age of client relationship (newer = higher risk).",
    },
    {
        "code": RiskFactorCode.PEP_STATUS,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 10,
        "description": "PEP status of linked officers and shareholders.",
    },
    {
        "code": RiskFactorCode.SANCTIONS_SCREENING,
        "category": RiskFactorCategory.ENTITY,
        "max_score": 10,
        "description": "World-Check screening results for linked persons.",
    },
]

# Person-level factors (default max scores sum to 100)
PERSON_FACTORS = [
    {
        "code": RiskFactorCode.NATIONALITY_RISK,
        "category": RiskFactorCategory.PERSON,
        "max_score": 20,
        "description": "Risk based on person's nationality jurisdiction.",
    },
    {
        "code": RiskFactorCode.RESIDENCE_RISK,
        "category": RiskFactorCategory.PERSON,
        "max_score": 15,
        "description": "Risk based on person's country of residence.",
    },
    {
        "code": RiskFactorCode.PEP_STATUS,
        "category": RiskFactorCategory.PERSON,
        "max_score": 25,
        "description": "Politically Exposed Person status.",
    },
    {
        "code": RiskFactorCode.SANCTIONS_SCREENING,
        "category": RiskFactorCategory.PERSON,
        "max_score": 25,
        "description": "World-Check sanctions screening result.",
    },
    {
        "code": RiskFactorCode.SOURCE_OF_WEALTH_RISK,
        "category": RiskFactorCategory.PERSON,
        "max_score": 10,
        "description": "Risk level from declared sources of wealth.",
    },
    {
        "code": RiskFactorCode.ID_VERIFICATION,
        "category": RiskFactorCategory.PERSON,
        "max_score": 5,
        "description": "Status of identity document verification.",
    },
]

# Automatic trigger rules
TRIGGER_RULES = [
    {
        "condition": TriggerCondition.PEP_STATUS,
        "forced_risk_level": RiskLevel.HIGH,
        "is_active": True,
        "description": "Force HIGH risk when any linked person is a PEP.",
    },
    {
        "condition": TriggerCondition.SANCTIONS_MATCH,
        "forced_risk_level": RiskLevel.HIGH,
        "is_active": True,
        "description": "Force HIGH risk when a sanctions TRUE MATCH is found.",
    },
    {
        "condition": TriggerCondition.HIGH_RISK_JURISDICTION,
        "forced_risk_level": RiskLevel.HIGH,
        "is_active": True,
        "description": "Force HIGH risk when entity or person involves FATF blacklist jurisdiction (risk_weight >= 9).",
    },
    {
        "condition": TriggerCondition.COMPLEX_STRUCTURE,
        "forced_risk_level": RiskLevel.MEDIUM,
        "is_active": True,
        "description": "Force minimum MEDIUM risk when ownership structure has >3 corporate layers.",
    },
]


class Command(BaseCommand):
    help = "Seed default risk matrix configurations, factors, and trigger rules."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Delete existing configs and re-create from scratch.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force = options.get("force", False)

        if force:
            count = RiskMatrixConfig.objects.count()
            RiskMatrixConfig.objects.all().delete()
            self.stdout.write(f"  Deleted {count} existing configuration(s).")

        for config_data in CONFIGS:
            config, created = RiskMatrixConfig.objects.update_or_create(
                name=config_data["name"],
                defaults={
                    "jurisdiction": config_data["jurisdiction"],
                    "entity_type": config_data["entity_type"],
                    "version": config_data["version"],
                    "is_active": config_data["is_active"],
                    "high_risk_threshold": config_data["high_risk_threshold"],
                    "medium_risk_threshold": config_data["medium_risk_threshold"],
                    "notes": config_data["notes"],
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action} config: {config.name}")

            # Seed entity factors
            for factor_data in ENTITY_FACTORS:
                factor, f_created = RiskFactor.objects.update_or_create(
                    matrix_config=config,
                    code=factor_data["code"],
                    category=factor_data["category"],
                    defaults={
                        "max_score": factor_data["max_score"],
                        "description": factor_data["description"],
                    },
                )
                f_action = "Created" if f_created else "Updated"
                self.stdout.write(f"    {f_action} entity factor: {factor.code}")

            # Seed person factors
            for factor_data in PERSON_FACTORS:
                factor, f_created = RiskFactor.objects.update_or_create(
                    matrix_config=config,
                    code=factor_data["code"],
                    category=factor_data["category"],
                    defaults={
                        "max_score": factor_data["max_score"],
                        "description": factor_data["description"],
                    },
                )
                f_action = "Created" if f_created else "Updated"
                self.stdout.write(f"    {f_action} person factor: {factor.code}")

            # Seed trigger rules
            for rule_data in TRIGGER_RULES:
                rule, r_created = AutomaticTriggerRule.objects.update_or_create(
                    matrix_config=config,
                    condition=rule_data["condition"],
                    defaults={
                        "forced_risk_level": rule_data["forced_risk_level"],
                        "is_active": rule_data["is_active"],
                        "description": rule_data["description"],
                    },
                )
                r_action = "Created" if r_created else "Updated"
                self.stdout.write(f"    {r_action} trigger: {rule.condition}")

        self.stdout.write(
            self.style.SUCCESS(
                "Risk matrix configurations seeded successfully."
            )
        )
