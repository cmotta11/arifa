from django.core.management.base import BaseCommand
from django.db import transaction

from apps.compliance.models import JurisdictionConfig, JurisdictionRisk

# ---------------------------------------------------------------------------
# Jurisdiction Configuration Data
# ---------------------------------------------------------------------------

CONFIGS = [
    {
        "country_code": "PA",
        "country_name": "Panama",
        "risk_weight": 4,
        "config": {
            "inc_workflow": "INC_PANAMA",
            "requires_notary": True,
            "requires_registry": True,
            "requires_nit_ruc": True,
            "requires_rbuf": True,
            "supports_digital_notary": False,
            "ubo_threshold_percent": 25,
            "kyc_renewal_months": 12,
            "es_required": False,
            "ar_required": True,
            "exempted_available": True,
            "entity_types": [
                "sociedad_anonima",
                "sociedad_de_responsabilidad_limitada",
                "fundacion_de_interes_privado",
            ],
            "form_config": {
                "requires_resident_agent": True,
                "requires_registered_office": True,
                "min_directors": 3,
                "min_officers": 3,
                "officer_positions": [
                    "president",
                    "secretary",
                    "treasurer",
                ],
            },
            "es_flow_config": {},
        },
    },
    {
        "country_code": "VG",
        "country_name": "British Virgin Islands",
        "risk_weight": 3,
        "config": {
            "inc_workflow": "INC_BVI",
            "requires_notary": False,
            "requires_registry": False,
            "requires_nit_ruc": False,
            "requires_rbuf": False,
            "supports_digital_notary": False,
            "ubo_threshold_percent": 10,
            "kyc_renewal_months": 12,
            "es_required": True,
            "ar_required": False,
            "exempted_available": True,
            "entity_types": [
                "bc_company",
                "limited_partnership",
                "segregated_portfolio_company",
            ],
            "form_config": {
                "requires_resident_agent": True,
                "requires_registered_office": True,
                "min_directors": 1,
                "min_officers": 0,
                "officer_positions": [],
            },
            "es_flow_config": {
                "filing_deadline_months": 6,
                "categories": [
                    "banking",
                    "insurance",
                    "fund_management",
                    "finance_and_leasing",
                    "headquarters",
                    "shipping",
                    "distribution_and_service_centre",
                    "intellectual_property",
                    "holding",
                ],
            },
        },
    },
    {
        "country_code": "BZ",
        "country_name": "Belize",
        "risk_weight": 4,
        "config": {
            "inc_workflow": "INC_BELIZE",
            "requires_notary": False,
            "requires_registry": False,
            "requires_nit_ruc": False,
            "requires_rbuf": False,
            "supports_digital_notary": False,
            "ubo_threshold_percent": 10,
            "kyc_renewal_months": 12,
            "es_required": True,
            "ar_required": False,
            "exempted_available": False,
            "entity_types": [
                "ibc",
                "limited_liability_company",
            ],
            "form_config": {
                "requires_resident_agent": True,
                "requires_registered_office": True,
                "min_directors": 1,
                "min_officers": 0,
                "officer_positions": [],
            },
            "es_flow_config": {
                "filing_deadline_months": 9,
                "categories": [
                    "banking",
                    "insurance",
                    "fund_management",
                    "finance_and_leasing",
                    "headquarters",
                    "shipping",
                    "distribution_and_service_centre",
                    "intellectual_property",
                    "holding",
                ],
            },
        },
    },
    {
        "country_code": "BS",
        "country_name": "Bahamas",
        "risk_weight": 3,
        "config": {
            "inc_workflow": "INC_BAHAMAS",
            "requires_notary": False,
            "requires_registry": True,
            "requires_nit_ruc": False,
            "requires_rbuf": False,
            "supports_digital_notary": False,
            "ubo_threshold_percent": 10,
            "kyc_renewal_months": 12,
            "es_required": True,
            "ar_required": False,
            "exempted_available": False,
            "entity_types": [
                "ibc",
                "exempted_limited_partnership",
                "segregated_accounts_company",
            ],
            "form_config": {
                "requires_resident_agent": True,
                "requires_registered_office": True,
                "min_directors": 1,
                "min_officers": 0,
                "officer_positions": [],
            },
            "es_flow_config": {
                "filing_deadline_months": 9,
                "categories": [
                    "banking",
                    "insurance",
                    "fund_management",
                    "finance_and_leasing",
                    "headquarters",
                    "shipping",
                    "distribution_and_service_centre",
                    "intellectual_property",
                    "holding",
                ],
            },
        },
    },
]


class Command(BaseCommand):
    help = "Seed jurisdiction configurations for Panama, BVI, Belize, and Bahamas"

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for entry in CONFIGS:
            jr, jr_created = JurisdictionRisk.objects.update_or_create(
                country_code=entry["country_code"],
                defaults={
                    "country_name": entry["country_name"],
                    "risk_weight": entry["risk_weight"],
                },
            )

            cfg = entry["config"]
            _config, config_created = JurisdictionConfig.objects.update_or_create(
                jurisdiction=jr,
                defaults={
                    "inc_workflow": cfg["inc_workflow"],
                    "requires_notary": cfg["requires_notary"],
                    "requires_registry": cfg["requires_registry"],
                    "requires_nit_ruc": cfg["requires_nit_ruc"],
                    "requires_rbuf": cfg["requires_rbuf"],
                    "supports_digital_notary": cfg["supports_digital_notary"],
                    "ubo_threshold_percent": cfg["ubo_threshold_percent"],
                    "kyc_renewal_months": cfg["kyc_renewal_months"],
                    "es_required": cfg["es_required"],
                    "ar_required": cfg["ar_required"],
                    "exempted_available": cfg["exempted_available"],
                    "entity_types": cfg["entity_types"],
                    "form_config": cfg["form_config"],
                    "es_flow_config": cfg["es_flow_config"],
                },
            )

            if config_created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Created config for {entry['country_name']} ({entry['country_code']})"
                    )
                )
            else:
                updated_count += 1
                self.stdout.write(
                    f"  Updated config for {entry['country_name']} ({entry['country_code']})"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {created_count} created, {updated_count} updated."
            )
        )
