import pytest

from apps.authentication.constants import COMPLIANCE_OFFICER, COORDINATOR, DIRECTOR
from apps.authentication.tests.factories import UserFactory

from .factories import (
    DocumentUploadFactory,
    JurisdictionRiskFactory,
    KYCSubmissionFactory,
    PartyFactory,
    RFIFactory,
    RiskAssessmentFactory,
    WorldCheckCaseFactory,
)


# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def coordinator_user():
    return UserFactory(role=COORDINATOR)


@pytest.fixture
def compliance_officer_user():
    return UserFactory(role=COMPLIANCE_OFFICER)


@pytest.fixture
def director_user():
    return UserFactory(role=DIRECTOR)


# ---------------------------------------------------------------------------
# API client fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def authenticated_client(coordinator_user, api_client):
    api_client.force_authenticate(user=coordinator_user)
    return api_client


@pytest.fixture
def compliance_client(compliance_officer_user, api_client):
    api_client.force_authenticate(user=compliance_officer_user)
    return api_client


@pytest.fixture
def director_client(director_user, api_client):
    api_client.force_authenticate(user=director_user)
    return api_client


# ---------------------------------------------------------------------------
# Model fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def kyc_submission():
    return KYCSubmissionFactory()


@pytest.fixture
def submitted_kyc():
    from apps.compliance.constants import KYCStatus

    return KYCSubmissionFactory(
        status=KYCStatus.SUBMITTED,
        submitted_at="2025-01-15T10:00:00Z",
    )


@pytest.fixture
def party(kyc_submission):
    return PartyFactory(kyc_submission=kyc_submission)


@pytest.fixture
def pep_party(kyc_submission):
    return PartyFactory(
        kyc_submission=kyc_submission,
        pep_status=True,
        name="PEP Person",
    )


@pytest.fixture
def jurisdiction_risk_high():
    return JurisdictionRiskFactory(
        country_code="PA",
        country_name="Panama",
        risk_weight=8,
    )


@pytest.fixture
def jurisdiction_risk_low():
    return JurisdictionRiskFactory(
        country_code="US",
        country_name="United States",
        risk_weight=2,
    )


@pytest.fixture
def risk_assessment(kyc_submission):
    return RiskAssessmentFactory(kyc_submission=kyc_submission)


@pytest.fixture
def rfi(kyc_submission, compliance_officer_user):
    return RFIFactory(
        kyc_submission=kyc_submission,
        requested_by=compliance_officer_user,
    )


@pytest.fixture
def worldcheck_case(party):
    return WorldCheckCaseFactory(party=party)


@pytest.fixture
def document_upload(kyc_submission, coordinator_user):
    return DocumentUploadFactory(
        kyc_submission=kyc_submission,
        uploaded_by=coordinator_user,
    )
