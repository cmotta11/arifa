from django.core.management.base import BaseCommand
from django.db import transaction

from apps.compliance.models import JurisdictionRisk
from apps.services_platform.constants import ServiceCategory
from apps.services_platform.models import PricingRule, ServiceCatalog

# ---------------------------------------------------------------------------
# Service Catalog Seed Data
# ---------------------------------------------------------------------------

SERVICES = [
    {
        "code": "INC_PANAMA_CORP",
        "name": "Panama Corporation",
        "category": ServiceCategory.INCORPORATION,
        "jurisdiction_code": "PA",
        "description": "Incorporation of a Panama Corporation (Sociedad Anonima). Includes drafting of articles of incorporation, notarization, and public registry filing.",
        "base_price": "1500.00",
        "estimated_days": 15,
        "requires_entity": False,
        "config": {
            "required_documents": ["articles_of_incorporation", "poder_constitutivo"],
            "min_directors": 3,
            "min_officers": 3,
        },
    },
    {
        "code": "INC_PANAMA_FOUNDATION",
        "name": "Panama Foundation",
        "category": ServiceCategory.INCORPORATION,
        "jurisdiction_code": "PA",
        "description": "Incorporation of a Panama Private Interest Foundation (Fundacion de Interes Privado). Includes charter preparation, notarization, and public registry filing.",
        "base_price": "2000.00",
        "estimated_days": 20,
        "requires_entity": False,
        "config": {
            "required_documents": ["foundation_charter", "foundation_regulations"],
            "min_council_members": 3,
        },
    },
    {
        "code": "INC_PANAMA_LLC",
        "name": "Panama LLC",
        "category": ServiceCategory.INCORPORATION,
        "jurisdiction_code": "PA",
        "description": "Incorporation of a Panama Limited Liability Company (Sociedad de Responsabilidad Limitada). Includes articles of organization, notarization, and public registry filing.",
        "base_price": "1800.00",
        "estimated_days": 15,
        "requires_entity": False,
        "config": {
            "required_documents": ["articles_of_organization"],
            "min_members": 2,
            "max_members": 25,
        },
    },
    {
        "code": "INC_BVI_BC",
        "name": "BVI Business Company",
        "category": ServiceCategory.INCORPORATION,
        "jurisdiction_code": "VG",
        "description": "Incorporation of a BVI Business Company (BC). Includes memorandum and articles of association, and filing with the BVI Registry of Corporate Affairs.",
        "base_price": "1200.00",
        "estimated_days": 5,
        "requires_entity": False,
        "config": {
            "required_documents": ["memorandum_of_association", "articles_of_association"],
            "min_directors": 1,
        },
    },
    {
        "code": "INC_BVI_LLC",
        "name": "BVI LLC",
        "category": ServiceCategory.INCORPORATION,
        "jurisdiction_code": "VG",
        "description": "Incorporation of a BVI Limited Liability Company. Includes operating agreement and filing with the BVI Registry of Corporate Affairs.",
        "base_price": "1500.00",
        "estimated_days": 7,
        "requires_entity": False,
        "config": {
            "required_documents": ["operating_agreement"],
            "min_members": 1,
        },
    },
    {
        "code": "ANNUAL_PANAMA",
        "name": "Annual Renewal Panama",
        "category": ServiceCategory.ANNUAL_RENEWAL,
        "jurisdiction_code": "PA",
        "description": "Annual renewal and maintenance for Panama entities. Includes resident agent fee, registered office, and government franchise tax.",
        "base_price": "800.00",
        "estimated_days": 10,
        "requires_entity": True,
        "config": {
            "includes": ["resident_agent_fee", "registered_office", "franchise_tax"],
        },
    },
    {
        "code": "ANNUAL_BVI",
        "name": "Annual Renewal BVI",
        "category": ServiceCategory.ANNUAL_RENEWAL,
        "jurisdiction_code": "VG",
        "description": "Annual renewal and maintenance for BVI entities. Includes registered agent fee and government license fee.",
        "base_price": "450.00",
        "estimated_days": 5,
        "requires_entity": True,
        "config": {
            "includes": ["registered_agent_fee", "government_license"],
        },
    },
    {
        "code": "KYC_ENHANCED",
        "name": "Enhanced Due Diligence",
        "category": ServiceCategory.COMPLIANCE_KYC,
        "jurisdiction_code": None,
        "description": "Enhanced due diligence and KYC review for high-risk clients or entities. Includes World-Check screening, source of wealth verification, and comprehensive risk assessment.",
        "base_price": "500.00",
        "estimated_days": 10,
        "requires_entity": True,
        "config": {
            "includes": ["worldcheck_screening", "source_of_wealth_verification", "risk_assessment"],
        },
    },
    {
        "code": "DOC_APOSTILLE",
        "name": "Document Apostille",
        "category": ServiceCategory.DOCUMENT_GENERATION,
        "jurisdiction_code": None,
        "description": "Apostille certification for documents to be used internationally under the Hague Convention.",
        "base_price": "150.00",
        "estimated_days": 5,
        "requires_entity": False,
        "config": {},
    },
    {
        "code": "DOC_TRANSLATION",
        "name": "Document Translation",
        "category": ServiceCategory.DOCUMENT_GENERATION,
        "jurisdiction_code": None,
        "description": "Professional legal translation of documents. Price is per standard document; complex or lengthy documents may vary.",
        "base_price": "200.00",
        "estimated_days": 7,
        "requires_entity": False,
        "config": {
            "languages": ["en", "es"],
            "per_page_surcharge": 25,
        },
    },
]

# Pricing rules: gold = 5% discount, platinum = 10% discount
PRICING_RULES = [
    {"client_category": "gold", "discount_percentage": "5.00"},
    {"client_category": "platinum", "discount_percentage": "10.00"},
]


class Command(BaseCommand):
    help = "Seed the service catalog with Panama and BVI services and pricing rules"

    @transaction.atomic
    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        # Cache jurisdiction lookups
        jurisdictions = {}
        for jr in JurisdictionRisk.objects.all():
            jurisdictions[jr.country_code] = jr

        for entry in SERVICES:
            jurisdiction_code = entry.get("jurisdiction_code")
            jurisdiction = jurisdictions.get(jurisdiction_code) if jurisdiction_code else None

            service, service_created = ServiceCatalog.objects.update_or_create(
                code=entry["code"],
                defaults={
                    "name": entry["name"],
                    "category": entry["category"],
                    "jurisdiction": jurisdiction,
                    "description": entry["description"],
                    "base_price": entry["base_price"],
                    "currency": "USD",
                    "is_active": True,
                    "requires_entity": entry["requires_entity"],
                    "estimated_days": entry["estimated_days"],
                    "config": entry["config"],
                },
            )

            if service_created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Created service: {entry['code']} - {entry['name']}"
                    )
                )
            else:
                updated_count += 1
                self.stdout.write(
                    f"  Updated service: {entry['code']} - {entry['name']}"
                )

            # Create pricing rules for this service
            for rule in PRICING_RULES:
                _pricing_rule, _pr_created = PricingRule.objects.update_or_create(
                    service=service,
                    client_category=rule["client_category"],
                    defaults={
                        "discount_percentage": rule["discount_percentage"],
                        "is_active": True,
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {created_count} services created, {updated_count} updated."
            )
        )

        total_rules = PricingRule.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Total pricing rules: {total_rules}"
            )
        )
