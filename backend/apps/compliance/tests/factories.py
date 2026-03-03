import factory
from decimal import Decimal

from django.utils import timezone

from apps.authentication.tests.factories import UserFactory
from apps.compliance.constants import (
    DocumentType,
    KYCStatus,
    LLMExtractionStatus,
    PartyRole,
    PartyType,
    RecalculationStatus,
    RFIStatus,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
)
from apps.compliance.models import (
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    RiskRecalculationLog,
    WorldCheckCase,
)


class KYCSubmissionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = KYCSubmission

    ticket = factory.LazyFunction(lambda: _create_ticket())
    status = KYCStatus.DRAFT


def _create_ticket():
    """Helper to lazily create a workflow Ticket for KYC factories.

    Uses the workflow app's TicketFactory to properly create all required
    related objects (Client, WorkflowState, User).
    """
    from apps.workflow.tests.factories import TicketFactory

    return TicketFactory()


class PartyFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Party

    kyc_submission = factory.SubFactory(KYCSubmissionFactory)
    party_type = PartyType.NATURAL
    role = PartyRole.UBO
    name = factory.Faker("name")
    nationality = "PA"
    country_of_residence = "PA"
    pep_status = False
    ownership_percentage = Decimal("25.00")
    date_of_birth = factory.Faker("date_of_birth", minimum_age=18, maximum_age=80)
    identification_number = factory.Sequence(lambda n: f"ID-{n:06d}")


class JurisdictionRiskFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = JurisdictionRisk

    country_code = factory.Sequence(lambda n: f"C{n:02d}")
    country_name = factory.Faker("country")
    risk_weight = 5


class RiskAssessmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RiskAssessment

    kyc_submission = factory.SubFactory(KYCSubmissionFactory)
    total_score = 45
    risk_level = RiskLevel.MEDIUM
    breakdown_json = factory.LazyFunction(lambda: {
        "jurisdiction": {"score": 15},
        "pep": {"score": 0},
        "structure": {"score": 10},
        "worldcheck": {"score": 20},
    })
    is_current = True
    trigger = RiskTrigger.MANUAL


class RiskRecalculationLogFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RiskRecalculationLog

    status = RecalculationStatus.COMPLETED
    triggered_by = "test"
    total_entities = 10
    recalculated_count = 10
    changed_count = 2


class RFIFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RFI

    kyc_submission = factory.SubFactory(KYCSubmissionFactory)
    requested_by = factory.SubFactory(UserFactory)
    requested_fields = factory.LazyFunction(lambda: ["passport", "proof_of_address"])
    notes = "Please provide the required documents."
    status = RFIStatus.OPEN


class WorldCheckCaseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = WorldCheckCase

    party = factory.SubFactory(PartyFactory)
    case_system_id = factory.Sequence(lambda n: f"WC-{n:06d}")
    screening_status = ScreeningStatus.PENDING
    last_screened_at = factory.LazyFunction(timezone.now)
    ongoing_monitoring_enabled = False
    match_data_json = factory.LazyFunction(dict)


class DocumentUploadFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DocumentUpload

    kyc_submission = factory.SubFactory(KYCSubmissionFactory)
    document_type = DocumentType.PASSPORT
    original_filename = "passport_scan.pdf"
    uploaded_by = factory.SubFactory(UserFactory)
    file_size = 1024000
    mime_type = "application/pdf"
    llm_extraction_status = LLMExtractionStatus.PENDING
