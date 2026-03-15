"""
Phase 3.6.8 - Risk Matrix Tests

Tests for:
- Risk score calculation (legacy KYC + entity/person)
- Frequency-based recalculation
- Batch recalculation on config change
- Risk level thresholds
- Config resolution
- Duplicate and activate config
"""
import pytest
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone

from apps.authentication.tests.factories import UserFactory
from apps.compliance.constants import (
    RiskFactorCategory,
    RiskFactorCode,
    RiskLevel,
    RiskTrigger,
    TriggerCondition,
)
from apps.compliance.models import (
    AutomaticTriggerRule,
    RiskAssessment,
    RiskFactor,
    RiskMatrixConfig,
)
from apps.compliance.services import (
    _determine_risk_level,
    activate_risk_matrix_config,
    batch_recalculate_on_config_change,
    calculate_risk_score,
    duplicate_risk_matrix_config,
    resolve_matrix_config,
)

from common.exceptions import ApplicationError

from .factories import (
    JurisdictionRiskFactory,
    KYCSubmissionFactory,
    PartyFactory,
    RiskAssessmentFactory,
    WorldCheckCaseFactory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def global_config():
    config = RiskMatrixConfig.objects.create(
        name="Global Default",
        jurisdiction="",
        entity_type="",
        version=1,
        is_active=True,
        high_risk_threshold=70,
        medium_risk_threshold=40,
    )
    # Add entity factors
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.JURISDICTION,
        category=RiskFactorCategory.ENTITY,
        max_score=30,
    )
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.PEP_STATUS,
        category=RiskFactorCategory.ENTITY,
        max_score=25,
    )
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.STRUCTURE_COMPLEXITY,
        category=RiskFactorCategory.ENTITY,
        max_score=20,
    )
    # Add person factors
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.NATIONALITY_RISK,
        category=RiskFactorCategory.PERSON,
        max_score=25,
    )
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.PEP_STATUS,
        category=RiskFactorCategory.PERSON,
        max_score=30,
    )
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.SANCTIONS_SCREENING,
        category=RiskFactorCategory.PERSON,
        max_score=25,
    )
    return config


@pytest.fixture
def bvi_config():
    config = RiskMatrixConfig.objects.create(
        name="BVI Config",
        jurisdiction="BVI",
        entity_type="",
        version=1,
        is_active=True,
        high_risk_threshold=60,
        medium_risk_threshold=30,
    )
    RiskFactor.objects.create(
        matrix_config=config,
        code=RiskFactorCode.JURISDICTION,
        category=RiskFactorCategory.ENTITY,
        max_score=30,
    )
    return config


# ---------------------------------------------------------------------------
# Risk score calculation (legacy KYC path)
# ---------------------------------------------------------------------------


class TestLegacyRiskCalculation:
    def test_basic_risk_calculation(self, kyc_submission):
        PartyFactory(
            kyc_submission=kyc_submission,
            nationality="PA",
            country_of_residence="PA",
            pep_status=False,
        )
        JurisdictionRiskFactory(
            country_code="PA",
            country_name="Panama",
            risk_weight=7,
        )
        assessment = calculate_risk_score(
            kyc_id=kyc_submission.id, trigger=RiskTrigger.MANUAL,
        )
        assert assessment.is_current is True
        assert assessment.total_score >= 0
        assert assessment.risk_level in RiskLevel.values

    def test_empty_kyc_is_low_risk(self, kyc_submission):
        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        assert assessment.total_score == 0
        assert assessment.risk_level == RiskLevel.LOW

    def test_pep_adds_full_weight(self, kyc_submission):
        PartyFactory(kyc_submission=kyc_submission, pep_status=True)
        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        assert assessment.breakdown_json["pep"]["score"] == 25

    def test_worldcheck_match_adds_score(self, kyc_submission):
        party = PartyFactory(kyc_submission=kyc_submission)
        WorldCheckCaseFactory(party=party, screening_status="matched")
        assessment = calculate_risk_score(kyc_id=kyc_submission.id)
        assert assessment.breakdown_json["worldcheck"]["score"] > 0

    def test_previous_assessment_becomes_non_current(self, kyc_submission):
        PartyFactory(kyc_submission=kyc_submission)
        first = calculate_risk_score(kyc_id=kyc_submission.id)
        second = calculate_risk_score(kyc_id=kyc_submission.id)
        first.refresh_from_db()
        assert first.is_current is False
        assert second.is_current is True


# ---------------------------------------------------------------------------
# Risk level thresholds
# ---------------------------------------------------------------------------


class TestRiskLevelThresholds:
    def test_low_risk_below_40(self):
        assert _determine_risk_level(0) == RiskLevel.LOW
        assert _determine_risk_level(20) == RiskLevel.LOW
        assert _determine_risk_level(39) == RiskLevel.LOW

    def test_medium_risk_40_to_69(self):
        assert _determine_risk_level(40) == RiskLevel.MEDIUM
        assert _determine_risk_level(55) == RiskLevel.MEDIUM
        assert _determine_risk_level(69) == RiskLevel.MEDIUM

    def test_high_risk_70_plus(self):
        assert _determine_risk_level(70) == RiskLevel.HIGH
        assert _determine_risk_level(85) == RiskLevel.HIGH
        assert _determine_risk_level(100) == RiskLevel.HIGH

    def test_custom_thresholds(self):
        assert _determine_risk_level(35, high_threshold=60, medium_threshold=30) == RiskLevel.MEDIUM
        assert _determine_risk_level(29, high_threshold=60, medium_threshold=30) == RiskLevel.LOW
        assert _determine_risk_level(60, high_threshold=60, medium_threshold=30) == RiskLevel.HIGH


# ---------------------------------------------------------------------------
# Config resolution
# ---------------------------------------------------------------------------


class TestConfigResolution:
    def test_resolve_global_default(self, global_config):
        config = resolve_matrix_config()
        assert config.id == global_config.id

    def test_resolve_jurisdiction_specific(self, global_config, bvi_config):
        config = resolve_matrix_config(jurisdiction="BVI")
        assert config.id == bvi_config.id

    def test_fallback_to_global_when_no_jurisdiction_match(self, global_config):
        config = resolve_matrix_config(jurisdiction="UNKNOWN")
        assert config.id == global_config.id

    def test_no_config_raises_error(self):
        with pytest.raises(ApplicationError, match="No active RiskMatrixConfig"):
            resolve_matrix_config()

    def test_inactive_config_not_resolved(self, global_config):
        global_config.is_active = False
        global_config.save(update_fields=["is_active"])
        with pytest.raises(ApplicationError, match="No active RiskMatrixConfig"):
            resolve_matrix_config()


# ---------------------------------------------------------------------------
# Duplicate and activate config
# ---------------------------------------------------------------------------


class TestDuplicateAndActivateConfig:
    def test_duplicate_config(self, global_config):
        user = UserFactory()
        new_config = duplicate_risk_matrix_config(
            config_id=global_config.id,
            performed_by=user,
        )
        assert new_config.version == global_config.version + 1
        assert new_config.is_active is False
        assert new_config.name == global_config.name
        # Factors are cloned
        original_count = global_config.factors.count()
        assert new_config.factors.count() == original_count

    def test_duplicate_clones_trigger_rules(self, global_config):
        AutomaticTriggerRule.objects.create(
            matrix_config=global_config,
            condition=TriggerCondition.PEP_STATUS,
            forced_risk_level=RiskLevel.HIGH,
            is_active=True,
        )
        user = UserFactory()
        new_config = duplicate_risk_matrix_config(
            config_id=global_config.id,
            performed_by=user,
        )
        assert new_config.trigger_rules.count() == 1

    def test_activate_config_deactivates_others(self, global_config):
        user = UserFactory()
        new_config = duplicate_risk_matrix_config(
            config_id=global_config.id,
            performed_by=user,
        )
        activated = activate_risk_matrix_config(config_id=new_config.id)
        assert activated.is_active is True

        global_config.refresh_from_db()
        assert global_config.is_active is False

    def test_activate_preserves_different_scope(self, global_config, bvi_config):
        """Activating BVI config should not deactivate the global config."""
        user = UserFactory()
        new_bvi = duplicate_risk_matrix_config(
            config_id=bvi_config.id,
            performed_by=user,
        )
        activate_risk_matrix_config(config_id=new_bvi.id)

        global_config.refresh_from_db()
        assert global_config.is_active is True  # Different scope

        bvi_config.refresh_from_db()
        assert bvi_config.is_active is False  # Same scope


# ---------------------------------------------------------------------------
# Frequency-based recalculation
# ---------------------------------------------------------------------------


class TestFrequencyBasedRecalculation:
    def test_scheduled_risk_recalculation_task_exists(self):
        from apps.compliance.tasks import scheduled_risk_recalculation
        assert scheduled_risk_recalculation is not None

    def test_recalculate_all_risks_task_exists(self):
        from apps.compliance.tasks import recalculate_all_risks
        assert recalculate_all_risks is not None

    def test_recalculate_high_risk_entities_task_exists(self):
        from apps.compliance.tasks import recalculate_high_risk_entities
        assert recalculate_high_risk_entities is not None


# ---------------------------------------------------------------------------
# Batch recalculation on config change
# ---------------------------------------------------------------------------


class TestBatchRecalculationOnConfigChange:
    @patch("apps.compliance.services.request_risk_recalculation")
    def test_batch_recalculation_dispatched(self, mock_recalc, global_config):
        from apps.core.tests.factories import ClientFactory, EntityFactory
        client = ClientFactory()
        e1 = EntityFactory(client=client, status="active", jurisdiction="BVI")
        e2 = EntityFactory(client=client, status="active", jurisdiction="PA")

        batch_recalculate_on_config_change(config_id=global_config.id)

        # Both entities should have been dispatched since global config has no jurisdiction filter
        assert mock_recalc.call_count == 2

    @patch("apps.compliance.services.request_risk_recalculation")
    def test_batch_recalculation_scoped_by_jurisdiction(self, mock_recalc, bvi_config):
        from apps.core.tests.factories import ClientFactory, EntityFactory
        client = ClientFactory()
        EntityFactory(client=client, status="active", jurisdiction="BVI")
        EntityFactory(client=client, status="active", jurisdiction="PA")

        batch_recalculate_on_config_change(config_id=bvi_config.id)

        # Only the BVI entity should be dispatched
        assert mock_recalc.call_count == 1
