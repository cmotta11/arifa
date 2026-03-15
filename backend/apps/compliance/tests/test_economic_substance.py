"""
Phase 3.3.10 - Economic Substance Tests

Tests for:
- ES submission creation and draft saving
- Flow step evaluation (branching logic)
- Submit/approve/reject lifecycle
- Guest link ES submission access
- Delegation support
"""
import pytest
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from apps.authentication.constants import COMPLIANCE_OFFICER, COORDINATOR
from apps.authentication.tests.factories import GuestLinkFactory, UserFactory
from apps.compliance.constants import (
    DelegationModule,
    DelegationStatus,
    ESStatus,
)
from apps.compliance.models import (
    ComplianceDelegation,
    EconomicSubstanceSubmission,
    JurisdictionConfig,
)
from apps.compliance.services import (
    accept_delegation,
    advance_es_step,
    approve_es,
    create_es_submission,
    delegate_entity,
    evaluate_es_flow_step,
    reject_es,
    revoke_delegation,
    save_es_draft,
    submit_es,
)
from apps.core.tests.factories import ClientFactory, EntityFactory

from common.exceptions import ApplicationError

from .factories import JurisdictionRiskFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def entity():
    client = ClientFactory()
    return EntityFactory(client=client, jurisdiction="BVI")


@pytest.fixture
def es_submission(entity):
    return create_es_submission(entity_id=entity.id, fiscal_year=2025)


@pytest.fixture
def bvi_flow_config():
    """Sample BVI ES flow configuration with branching logic."""
    return {
        "steps": {
            "is_relevant_activity": {
                "conditions": [
                    {
                        "answer": "yes",
                        "next_step": "has_adequate_employees",
                        "terminal": False,
                        "result": "",
                        "reason": "",
                    },
                    {
                        "answer": "no",
                        "next_step": None,
                        "terminal": True,
                        "result": "exempt",
                        "reason": "Entity does not carry on relevant activity.",
                    },
                ],
            },
            "has_adequate_employees": {
                "conditions": [
                    {
                        "answer": "yes",
                        "next_step": "has_adequate_expenditure",
                        "terminal": False,
                        "result": "",
                        "reason": "",
                    },
                    {
                        "answer": "no",
                        "next_step": None,
                        "terminal": True,
                        "result": "attention",
                        "reason": "Inadequate number of employees.",
                    },
                ],
            },
            "has_adequate_expenditure": {
                "conditions": [
                    {
                        "answer": "yes",
                        "next_step": None,
                        "terminal": True,
                        "result": "pass",
                        "reason": "Entity meets economic substance requirements.",
                    },
                    {
                        "answer": "no",
                        "next_step": None,
                        "terminal": True,
                        "result": "attention",
                        "reason": "Inadequate operating expenditure.",
                    },
                ],
            },
        },
    }


# ---------------------------------------------------------------------------
# ES submission creation and draft saving
# ---------------------------------------------------------------------------


class TestESSubmissionCreation:
    def test_create_es_submission(self, entity):
        sub = create_es_submission(entity_id=entity.id, fiscal_year=2025)
        assert sub.entity == entity
        assert sub.fiscal_year == 2025
        assert sub.status == ESStatus.PENDING
        assert sub.flow_answers == {}
        assert sub.current_step == ""

    def test_unique_per_entity_year(self, entity):
        create_es_submission(entity_id=entity.id, fiscal_year=2025)
        with pytest.raises(Exception):
            create_es_submission(entity_id=entity.id, fiscal_year=2025)

    def test_different_fiscal_years_allowed(self, entity):
        sub1 = create_es_submission(entity_id=entity.id, fiscal_year=2024)
        sub2 = create_es_submission(entity_id=entity.id, fiscal_year=2025)
        assert sub1.id != sub2.id


class TestESDraftSaving:
    def test_save_draft_updates_flow_answers(self, es_submission):
        updated = save_es_draft(
            submission_id=es_submission.id,
            flow_answers={"is_relevant_activity": "yes"},
        )
        assert updated.flow_answers == {"is_relevant_activity": "yes"}
        assert updated.status == ESStatus.IN_PROGRESS

    def test_save_draft_updates_current_step(self, es_submission):
        updated = save_es_draft(
            submission_id=es_submission.id,
            current_step="has_adequate_employees",
        )
        assert updated.current_step == "has_adequate_employees"

    def test_save_draft_updates_shareholders_data(self, es_submission):
        data = [{"name": "John", "ownership": "50%"}]
        updated = save_es_draft(
            submission_id=es_submission.id,
            shareholders_data=data,
        )
        assert updated.shareholders_data == data

    def test_save_draft_transitions_pending_to_in_progress(self, es_submission):
        assert es_submission.status == ESStatus.PENDING
        updated = save_es_draft(
            submission_id=es_submission.id,
            flow_answers={"step1": "answer1"},
        )
        assert updated.status == ESStatus.IN_PROGRESS

    def test_cannot_save_draft_for_completed(self, entity):
        sub = EconomicSubstanceSubmission.objects.create(
            entity=entity,
            fiscal_year=2026,
            status=ESStatus.COMPLETED,
        )
        with pytest.raises(ApplicationError, match="Cannot save draft"):
            save_es_draft(
                submission_id=sub.id,
                flow_answers={"step": "val"},
            )


# ---------------------------------------------------------------------------
# Flow step evaluation (branching logic)
# ---------------------------------------------------------------------------


class TestESFlowStepEvaluation:
    def test_evaluate_yes_continues_flow(self, bvi_flow_config):
        result = evaluate_es_flow_step(
            es_flow_config=bvi_flow_config,
            step_key="is_relevant_activity",
            answer="yes",
            flow_answers={},
        )
        assert result["next_step"] == "has_adequate_employees"
        assert result["terminal"] is False

    def test_evaluate_no_terminates_with_exempt(self, bvi_flow_config):
        result = evaluate_es_flow_step(
            es_flow_config=bvi_flow_config,
            step_key="is_relevant_activity",
            answer="no",
            flow_answers={},
        )
        assert result["terminal"] is True
        assert result["result"] == "exempt"

    def test_evaluate_attention_result(self, bvi_flow_config):
        result = evaluate_es_flow_step(
            es_flow_config=bvi_flow_config,
            step_key="has_adequate_employees",
            answer="no",
            flow_answers={"is_relevant_activity": "yes"},
        )
        assert result["terminal"] is True
        assert result["result"] == "attention"
        assert "employees" in result["reason"].lower()

    def test_evaluate_full_pass(self, bvi_flow_config):
        result = evaluate_es_flow_step(
            es_flow_config=bvi_flow_config,
            step_key="has_adequate_expenditure",
            answer="yes",
            flow_answers={
                "is_relevant_activity": "yes",
                "has_adequate_employees": "yes",
            },
        )
        assert result["terminal"] is True
        assert result["result"] == "pass"

    def test_evaluate_unknown_step(self, bvi_flow_config):
        result = evaluate_es_flow_step(
            es_flow_config=bvi_flow_config,
            step_key="nonexistent_step",
            answer="yes",
            flow_answers={},
        )
        assert result["terminal"] is True
        assert result["result"] == "error"

    def test_advance_step_stores_answer(self, es_submission, bvi_flow_config):
        jr = JurisdictionRiskFactory(country_code="BV", country_name="BVI", risk_weight=3)
        JurisdictionConfig.objects.create(
            jurisdiction=jr,
            es_flow_config=bvi_flow_config,
            es_required=True,
        )
        # Update entity jurisdiction to match
        es_submission.entity.jurisdiction = "BV"
        es_submission.entity.save(update_fields=["jurisdiction"])

        result = advance_es_step(
            submission_id=es_submission.id,
            step_key="is_relevant_activity",
            answer="yes",
        )
        es_submission.refresh_from_db()
        assert es_submission.flow_answers["is_relevant_activity"] == "yes"
        assert result["next_step"] == "has_adequate_employees"


# ---------------------------------------------------------------------------
# Submit/approve/reject lifecycle
# ---------------------------------------------------------------------------


class TestESLifecycle:
    def test_submit_in_progress_es(self, es_submission):
        # Move to in_progress first
        save_es_draft(
            submission_id=es_submission.id,
            flow_answers={"step": "answer"},
        )
        sub = submit_es(submission_id=es_submission.id)
        assert sub.status == ESStatus.IN_REVIEW
        assert sub.submitted_at is not None

    def test_cannot_submit_pending_es(self, es_submission):
        with pytest.raises(ApplicationError, match="Cannot submit"):
            submit_es(submission_id=es_submission.id)

    def test_approve_in_review_es(self, es_submission, compliance_officer_user):
        save_es_draft(
            submission_id=es_submission.id,
            flow_answers={"step": "answer"},
        )
        submit_es(submission_id=es_submission.id)
        approved = approve_es(
            submission_id=es_submission.id,
            reviewed_by=compliance_officer_user,
        )
        assert approved.status == ESStatus.COMPLETED
        assert approved.reviewed_by == compliance_officer_user
        assert approved.reviewed_at is not None

    def test_reject_in_review_es(self, es_submission, compliance_officer_user):
        save_es_draft(
            submission_id=es_submission.id,
            flow_answers={"step": "answer"},
        )
        submit_es(submission_id=es_submission.id)
        rejected = reject_es(
            submission_id=es_submission.id,
            reviewed_by=compliance_officer_user,
        )
        assert rejected.status == ESStatus.IN_PROGRESS

    def test_reject_with_field_comments(self, es_submission, compliance_officer_user):
        save_es_draft(
            submission_id=es_submission.id,
            flow_answers={"step": "answer"},
        )
        submit_es(submission_id=es_submission.id)
        rejected = reject_es(
            submission_id=es_submission.id,
            reviewed_by=compliance_officer_user,
            field_comments={"activity": [{"text": "Provide more detail"}]},
        )
        assert rejected.field_comments is not None
        assert "activity" in rejected.field_comments

    def test_cannot_approve_non_review(self, es_submission, compliance_officer_user):
        with pytest.raises(ApplicationError, match="Cannot approve"):
            approve_es(
                submission_id=es_submission.id,
                reviewed_by=compliance_officer_user,
            )

    def test_cannot_reject_non_review(self, es_submission, compliance_officer_user):
        with pytest.raises(ApplicationError, match="Cannot reject"):
            reject_es(
                submission_id=es_submission.id,
                reviewed_by=compliance_officer_user,
            )


# ---------------------------------------------------------------------------
# Delegation support
# ---------------------------------------------------------------------------


class TestDelegation:
    def test_create_delegation(self, entity, coordinator_user):
        delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.ECONOMIC_SUBSTANCE,
            fiscal_year=2025,
            delegate_email="delegate@example.com",
            delegated_by=coordinator_user,
        )
        assert delegation.status == DelegationStatus.PENDING
        assert delegation.delegate_email == "delegate@example.com"
        assert delegation.module == DelegationModule.ECONOMIC_SUBSTANCE

    def test_accept_delegation(self, entity, coordinator_user):
        delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.ECONOMIC_SUBSTANCE,
            fiscal_year=2025,
            delegate_email="delegate@example.com",
            delegated_by=coordinator_user,
        )
        delegate_user = UserFactory(email="delegate@example.com")
        accepted = accept_delegation(
            delegation_id=delegation.id,
            user=delegate_user,
        )
        assert accepted.status == DelegationStatus.ACCEPTED
        assert accepted.delegate_user == delegate_user
        assert accepted.accepted_at is not None

    def test_revoke_delegation(self, entity, coordinator_user):
        delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.KYC,
            fiscal_year=2025,
            delegate_email="someone@example.com",
            delegated_by=coordinator_user,
        )
        revoked = revoke_delegation(
            delegation_id=delegation.id,
            revoked_by=coordinator_user,
        )
        assert revoked.status == DelegationStatus.REVOKED
        assert revoked.revoked_at is not None

    def test_cannot_accept_with_wrong_email(self, entity, coordinator_user):
        delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.ECONOMIC_SUBSTANCE,
            fiscal_year=2025,
            delegate_email="correct@example.com",
            delegated_by=coordinator_user,
        )
        wrong_user = UserFactory(email="wrong@example.com")
        with pytest.raises(ApplicationError, match="not sent to your email"):
            accept_delegation(delegation_id=delegation.id, user=wrong_user)

    def test_cannot_revoke_already_revoked(self, entity, coordinator_user):
        delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.ACCOUNTING_RECORDS,
            fiscal_year=2025,
            delegate_email="delegate@example.com",
            delegated_by=coordinator_user,
        )
        revoke_delegation(delegation_id=delegation.id, revoked_by=coordinator_user)
        with pytest.raises(ApplicationError, match="Cannot revoke"):
            revoke_delegation(delegation_id=delegation.id, revoked_by=coordinator_user)

    def test_duplicate_active_delegation_error(self, entity, coordinator_user):
        delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.ECONOMIC_SUBSTANCE,
            fiscal_year=2025,
            delegate_email="same@example.com",
            delegated_by=coordinator_user,
        )
        with pytest.raises(ApplicationError, match="active delegation already exists"):
            delegate_entity(
                entity_id=entity.id,
                module=DelegationModule.ECONOMIC_SUBSTANCE,
                fiscal_year=2025,
                delegate_email="same@example.com",
                delegated_by=coordinator_user,
            )

    def test_revoked_delegation_allows_new_one(self, entity, coordinator_user):
        delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.KYC,
            fiscal_year=2025,
            delegate_email="delegate@example.com",
            delegated_by=coordinator_user,
        )
        revoke_delegation(delegation_id=delegation.id, revoked_by=coordinator_user)
        # Now creating a new one should succeed
        new_delegation = delegate_entity(
            entity_id=entity.id,
            module=DelegationModule.KYC,
            fiscal_year=2025,
            delegate_email="delegate@example.com",
            delegated_by=coordinator_user,
        )
        assert new_delegation.status == DelegationStatus.PENDING
