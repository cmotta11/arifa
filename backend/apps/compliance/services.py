import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from common.exceptions import ApplicationError

from .constants import (
    KYCStatus,
    RFIStatus,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
)
from .models import (
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    WorldCheckCase,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Risk score weights (used by calculate_risk_score)
# ---------------------------------------------------------------------------
_JURISDICTION_WEIGHT = 30  # max contribution from jurisdiction risk
_PEP_WEIGHT = 25  # flat score added when any party is PEP
_STRUCTURE_WEIGHT = 20  # complexity of corporate structure
_WORLDCHECK_WEIGHT = 25  # World-Check match penalties

_HIGH_RISK_THRESHOLD = 70
_MEDIUM_RISK_THRESHOLD = 40


# ===========================================================================
# KYC lifecycle
# ===========================================================================


@transaction.atomic
def create_kyc_submission(*, ticket_id) -> KYCSubmission:
    """Create a new KYC submission in DRAFT status for the given ticket."""
    kyc = KYCSubmission.objects.create(
        ticket_id=ticket_id,
        status=KYCStatus.DRAFT,
    )
    return kyc


@transaction.atomic
def submit_kyc(*, kyc_id, submitted_by) -> KYCSubmission:
    """Transition a KYC submission from DRAFT or SENT_BACK to SUBMITTED."""
    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)

    allowed = {KYCStatus.DRAFT, KYCStatus.SENT_BACK}
    if kyc.status not in allowed:
        raise ApplicationError(
            f"Cannot submit KYC in '{kyc.get_status_display()}' status. "
            "Only DRAFT or SENT_BACK submissions can be submitted."
        )

    kyc.status = KYCStatus.SUBMITTED
    kyc.submitted_at = timezone.now()
    kyc.save(update_fields=["status", "submitted_at", "updated_at"])
    return kyc


@transaction.atomic
def approve_kyc(*, kyc_id, reviewed_by) -> KYCSubmission:
    """Approve a KYC submission. Must be SUBMITTED or UNDER_REVIEW."""
    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)

    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(
            f"Cannot approve KYC in '{kyc.get_status_display()}' status."
        )

    kyc.status = KYCStatus.APPROVED
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return kyc


@transaction.atomic
def reject_kyc(*, kyc_id, reviewed_by) -> KYCSubmission:
    """Reject a KYC submission. Must be SUBMITTED or UNDER_REVIEW."""
    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)

    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(
            f"Cannot reject KYC in '{kyc.get_status_display()}' status."
        )

    kyc.status = KYCStatus.REJECTED
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return kyc


@transaction.atomic
def escalate_kyc(*, kyc_id, escalated_by) -> KYCSubmission:
    """Place a KYC submission under review (escalate). Must be SUBMITTED."""
    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)

    if kyc.status != KYCStatus.SUBMITTED:
        raise ApplicationError(
            f"Cannot escalate KYC in '{kyc.get_status_display()}' status. "
            "Only SUBMITTED submissions can be escalated."
        )

    kyc.status = KYCStatus.UNDER_REVIEW
    kyc.save(update_fields=["status", "updated_at"])
    return kyc


# ===========================================================================
# Party management
# ===========================================================================


@transaction.atomic
def add_party_to_kyc(*, kyc_id, party_data: dict) -> Party:
    """Create a new Party record attached to the given KYC submission."""
    kyc = KYCSubmission.objects.get(id=kyc_id)

    if kyc.status not in {KYCStatus.DRAFT, KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}:
        raise ApplicationError(
            "Cannot add parties to a KYC submission that has been "
            f"'{kyc.get_status_display()}'."
        )

    party = Party.objects.create(kyc_submission=kyc, **party_data)
    return party


@transaction.atomic
def link_existing_person_to_party(*, party_id, person_id) -> Party:
    """Link an existing core.Person record to a compliance Party."""
    from apps.core.models import Person

    party = Party.objects.select_for_update().get(id=party_id)
    person = Person.objects.get(id=person_id)

    party.person = person
    # Sync key fields from the canonical Person record
    party.name = person.full_name
    party.nationality = person.nationality.country_code if person.nationality else ""
    party.country_of_residence = person.country_of_residence.country_code if person.country_of_residence else ""
    party.date_of_birth = person.date_of_birth
    party.identification_number = person.identification_number
    party.pep_status = person.pep_status
    party.save(
        update_fields=[
            "person",
            "name",
            "nationality",
            "country_of_residence",
            "date_of_birth",
            "identification_number",
            "pep_status",
            "updated_at",
        ]
    )
    return party


# ===========================================================================
# Risk assessment
# ===========================================================================


def _score_jurisdiction(parties) -> tuple[int, dict]:
    """Calculate jurisdiction risk component.

    Takes the *maximum* jurisdiction risk weight across all parties'
    nationalities and countries of residence, then scales it to the
    jurisdiction weight bucket.
    """
    country_codes = set()
    for p in parties:
        if p.nationality:
            country_codes.add(p.nationality.upper()[:3])
        if p.country_of_residence:
            country_codes.add(p.country_of_residence.upper()[:3])

    if not country_codes:
        return 0, {"jurisdiction_countries": [], "max_weight": 0}

    jurisdiction_risks = JurisdictionRisk.objects.filter(
        country_code__in=country_codes
    )
    if not jurisdiction_risks.exists():
        return 0, {
            "jurisdiction_countries": list(country_codes),
            "max_weight": 0,
            "note": "No jurisdiction risk data found for these countries",
        }

    max_weight = max(jr.risk_weight for jr in jurisdiction_risks)
    # Scale: weight of 10 -> full _JURISDICTION_WEIGHT points
    score = int((_JURISDICTION_WEIGHT * max_weight) / 10)
    breakdown = {
        "jurisdiction_countries": list(country_codes),
        "max_weight": max_weight,
        "score": score,
    }
    return score, breakdown


def _score_pep(parties) -> tuple[int, dict]:
    """PEP component: flat penalty if any party is a PEP."""
    pep_parties = [p for p in parties if p.pep_status]
    if pep_parties:
        return _PEP_WEIGHT, {
            "pep_count": len(pep_parties),
            "pep_names": [p.name for p in pep_parties],
            "score": _PEP_WEIGHT,
        }
    return 0, {"pep_count": 0, "score": 0}


def _score_structure(parties) -> tuple[int, dict]:
    """Structure complexity: more parties and corporate parties increase risk."""
    total = len(parties)
    corporate_count = sum(1 for p in parties if p.party_type == "corporate")

    if total == 0:
        return 0, {"total_parties": 0, "corporate_count": 0, "score": 0}

    # Base score from party count (diminishing returns via log-like scaling)
    party_score = min(total * 2, 10)
    # Extra score for corporate layers
    corporate_score = min(corporate_count * 3, 10)
    raw = party_score + corporate_score
    score = int((_STRUCTURE_WEIGHT * min(raw, 20)) / 20)

    return score, {
        "total_parties": total,
        "corporate_count": corporate_count,
        "score": score,
    }


def _score_worldcheck(parties) -> tuple[int, dict]:
    """World-Check screening component based on unresolved matches."""
    party_ids = [p.id for p in parties]
    cases = WorldCheckCase.objects.filter(party_id__in=party_ids)

    matched_count = cases.filter(
        screening_status__in=[
            ScreeningStatus.MATCHED,
            ScreeningStatus.TRUE_MATCH,
            ScreeningStatus.ESCALATED,
        ]
    ).count()

    if matched_count == 0:
        return 0, {"matched_cases": 0, "score": 0}

    # Each unresolved match adds to the score, capped at full weight
    score = min(matched_count * 10, _WORLDCHECK_WEIGHT)
    return score, {"matched_cases": matched_count, "score": score}


def _determine_risk_level(total_score: int) -> str:
    """Map total score to a risk level."""
    if total_score >= _HIGH_RISK_THRESHOLD:
        return RiskLevel.HIGH
    if total_score >= _MEDIUM_RISK_THRESHOLD:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


@transaction.atomic
def calculate_risk_score(
    *, kyc_id, trigger: str = RiskTrigger.AUTO
) -> RiskAssessment:
    """Run the full risk matrix algorithm for a KYC submission.

    Creates a versioned RiskAssessment record, marks it as current, and
    marks any previous assessment as non-current.
    """
    kyc = KYCSubmission.objects.get(id=kyc_id)
    parties = list(kyc.parties.all())

    jurisdiction_score, jurisdiction_detail = _score_jurisdiction(parties)
    pep_score, pep_detail = _score_pep(parties)
    structure_score, structure_detail = _score_structure(parties)
    worldcheck_score, worldcheck_detail = _score_worldcheck(parties)

    total_score = jurisdiction_score + pep_score + structure_score + worldcheck_score
    risk_level = _determine_risk_level(total_score)

    breakdown = {
        "jurisdiction": jurisdiction_detail,
        "pep": pep_detail,
        "structure": structure_detail,
        "worldcheck": worldcheck_detail,
        "weights": {
            "jurisdiction_max": _JURISDICTION_WEIGHT,
            "pep_max": _PEP_WEIGHT,
            "structure_max": _STRUCTURE_WEIGHT,
            "worldcheck_max": _WORLDCHECK_WEIGHT,
        },
    }

    # Mark all previous assessments for this KYC as non-current
    RiskAssessment.objects.filter(
        kyc_submission=kyc, is_current=True
    ).update(is_current=False)

    assessment = RiskAssessment.objects.create(
        kyc_submission=kyc,
        total_score=total_score,
        risk_level=risk_level,
        breakdown_json=breakdown,
        is_current=True,
        trigger=trigger,
    )

    logger.info(
        "Risk assessment created: KYC=%s score=%d level=%s trigger=%s",
        kyc_id,
        total_score,
        risk_level,
        trigger,
    )
    return assessment


def generate_risk_change_summary(
    *, previous_assessment: RiskAssessment, new_assessment: RiskAssessment
) -> str:
    """Generate a human-readable summary of what changed between two
    risk assessments.
    """
    parts = []

    # Overall score change
    score_diff = new_assessment.total_score - previous_assessment.total_score
    direction = "increased" if score_diff > 0 else "decreased"
    parts.append(
        f"Risk score {direction} from {previous_assessment.total_score} "
        f"to {new_assessment.total_score} ({score_diff:+d} points)."
    )

    # Level change
    if previous_assessment.risk_level != new_assessment.risk_level:
        parts.append(
            f"Risk level changed from {previous_assessment.get_risk_level_display()} "
            f"to {new_assessment.get_risk_level_display()}."
        )
    else:
        parts.append(
            f"Risk level remains {new_assessment.get_risk_level_display()}."
        )

    # Component-level deltas
    prev_bd = previous_assessment.breakdown_json or {}
    new_bd = new_assessment.breakdown_json or {}

    for component in ("jurisdiction", "pep", "structure", "worldcheck"):
        prev_score = (prev_bd.get(component) or {}).get("score", 0)
        new_score = (new_bd.get(component) or {}).get("score", 0)
        if prev_score != new_score:
            parts.append(
                f"  - {component.capitalize()}: {prev_score} -> {new_score} "
                f"({new_score - prev_score:+d})"
            )

    return "\n".join(parts)


# ===========================================================================
# RFI
# ===========================================================================


@transaction.atomic
def create_rfi(
    *, kyc_id, requested_by, requested_fields: list, notes: str = ""
) -> RFI:
    """Create a Request for Information on a KYC submission."""
    kyc = KYCSubmission.objects.get(id=kyc_id)
    rfi = RFI.objects.create(
        kyc_submission=kyc,
        requested_by=requested_by,
        requested_fields=requested_fields,
        notes=notes,
        status=RFIStatus.OPEN,
    )
    return rfi


@transaction.atomic
def respond_to_rfi(*, rfi_id, response_text: str) -> RFI:
    """Record a response to an RFI."""
    rfi = RFI.objects.select_for_update().get(id=rfi_id)

    if rfi.status != RFIStatus.OPEN:
        raise ApplicationError(
            f"Cannot respond to RFI in '{rfi.get_status_display()}' status."
        )

    rfi.response_text = response_text
    rfi.status = RFIStatus.RESPONDED
    rfi.responded_at = timezone.now()
    rfi.save(update_fields=["response_text", "status", "responded_at", "updated_at"])
    return rfi


# ===========================================================================
# World-Check resolution
# ===========================================================================


@transaction.atomic
def resolve_worldcheck_match(
    *, case_id, resolution: str, resolved_by
) -> WorldCheckCase:
    """Resolve a World-Check match as either FALSE_POSITIVE or TRUE_MATCH."""
    valid_resolutions = {ScreeningStatus.FALSE_POSITIVE, ScreeningStatus.TRUE_MATCH}
    if resolution not in valid_resolutions:
        raise ApplicationError(
            f"Invalid resolution '{resolution}'. "
            f"Must be one of: {', '.join(valid_resolutions)}."
        )

    case = WorldCheckCase.objects.select_for_update().get(id=case_id)

    if case.screening_status not in {ScreeningStatus.MATCHED, ScreeningStatus.ESCALATED}:
        raise ApplicationError(
            f"Cannot resolve a case in '{case.get_screening_status_display()}' status."
        )

    case.screening_status = resolution
    case.resolved_by = resolved_by
    case.resolved_at = timezone.now()
    case.save(
        update_fields=["screening_status", "resolved_by", "resolved_at", "updated_at"]
    )

    logger.info(
        "World-Check case %s resolved as %s by %s",
        case_id,
        resolution,
        resolved_by,
    )
    return case


# ===========================================================================
# Document upload
# ===========================================================================


@transaction.atomic
def upload_kyc_document(
    *,
    kyc_id=None,
    party_id=None,
    document_type: str,
    file_data: dict,
    uploaded_by,
) -> DocumentUpload:
    """Create a DocumentUpload record.

    ``file_data`` should contain keys: original_filename, file_size, mime_type.
    The actual SharePoint upload is dispatched via a Celery task after creation.
    """
    if kyc_id is None and party_id is None:
        raise ApplicationError(
            "At least one of 'kyc_id' or 'party_id' must be provided."
        )

    doc = DocumentUpload.objects.create(
        kyc_submission_id=kyc_id,
        party_id=party_id,
        document_type=document_type,
        original_filename=file_data.get("original_filename", "unknown"),
        file_size=file_data.get("file_size", 0),
        mime_type=file_data.get("mime_type", ""),
        uploaded_by=uploaded_by,
    )

    # Dispatch async SharePoint upload
    from .tasks import upload_document_to_sharepoint_async

    upload_document_to_sharepoint_async.delay(str(doc.id))

    return doc


# ===========================================================================
# Self-service onboarding
# ===========================================================================


def _get_system_user():
    """Return a system user for automated operations."""
    from apps.authentication.constants import COORDINATOR
    from apps.authentication.models import User

    user, _ = User.objects.get_or_create(
        email="system@arifa.law",
        defaults={
            "role": COORDINATOR,
            "first_name": "System",
            "last_name": "User",
        },
    )
    if not user.has_usable_password():
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


@transaction.atomic
def create_self_service_onboarding(
    *,
    client_name: str,
    client_type: str,
    entity_name: str,
    jurisdiction: str,
    contact_email: str,
    contact_name: str,
) -> dict:
    """Create Client + Entity + Ticket + KYC + GuestLink in one transaction.

    Returns a dict with the created objects for the API response.
    """
    from apps.authentication.constants import GUEST_LINK_EXPIRY_DAYS
    from apps.authentication.models import GuestLink
    from apps.core.models import Client, Entity
    from apps.workflow.services import create_ticket

    system_user = _get_system_user()

    # 1. Create Client
    client = Client.objects.create(
        name=client_name,
        client_type=client_type,
    )

    # 2. Create Entity
    entity = Entity.objects.create(
        name=entity_name,
        jurisdiction=jurisdiction,
        client=client,
    )

    # 3. Create Ticket
    ticket = create_ticket(
        title=f"KYC Onboarding - {entity_name}",
        client_id=client.id,
        created_by=system_user,
        entity=entity,
    )

    # 4. Create KYC Submission
    kyc = create_kyc_submission(ticket_id=ticket.id)

    # 5. Create Guest Link
    guest_link = GuestLink.objects.create(
        created_by=system_user,
        kyc_submission=kyc,
        expires_at=timezone.now() + timedelta(days=GUEST_LINK_EXPIRY_DAYS),
    )

    logger.info(
        "Self-service onboarding created: client=%s entity=%s ticket=%s kyc=%s",
        client.id,
        entity.id,
        ticket.id,
        kyc.id,
    )

    return {
        "client": client,
        "entity": entity,
        "ticket": ticket,
        "kyc_submission": kyc,
        "guest_link": guest_link,
    }


# ===========================================================================
# Guest entity snapshot
# ===========================================================================


def build_entity_snapshot(*, entity):
    """Build a complete snapshot of entity data for the guest form."""
    from apps.core.models import (
        ActivityCatalog,
        EntityActivity,
        EntityOfficer,
        Person,
        ShareClass,
        SourceOfFunds,
        SourceOfFundsCatalog,
    )

    # General info
    general = {
        "name": entity.name,
        "jurisdiction": entity.jurisdiction,
        "incorporation_date": str(entity.incorporation_date) if entity.incorporation_date else None,
        "status": entity.status,
    }

    # Officers
    officers_qs = EntityOfficer.objects.filter(entity=entity).select_related(
        "officer_person", "officer_entity"
    )
    officers = []
    person_ids = set()
    for o in officers_qs:
        officer_data = {
            "id": str(o.id),
            "officer_person": None,
            "officer_entity_id": str(o.officer_entity_id) if o.officer_entity_id else None,
            "officer_entity_name": o.officer_entity.name if o.officer_entity else None,
            "positions": o.positions,
            "start_date": str(o.start_date) if o.start_date else None,
            "end_date": str(o.end_date) if o.end_date else None,
            "is_active": o.is_active,
        }
        if o.officer_person:
            officer_data["officer_person"] = {
                "id": str(o.officer_person.id),
                "full_name": o.officer_person.full_name,
                "person_type": o.officer_person.person_type,
            }
            person_ids.add(o.officer_person_id)
        officers.append(officer_data)

    # Share classes + issuances
    share_classes_qs = ShareClass.objects.filter(entity=entity).prefetch_related(
        "issuances__shareholder_person", "issuances__shareholder_entity"
    )
    share_classes = []
    for sc in share_classes_qs:
        issuances = []
        for iss in sc.issuances.all():
            iss_data = {
                "id": str(iss.id),
                "share_class_id": str(sc.id),
                "shareholder_person": None,
                "shareholder_entity_id": str(iss.shareholder_entity_id) if iss.shareholder_entity_id else None,
                "shareholder_entity_name": iss.shareholder_entity.name if iss.shareholder_entity else None,
                "num_shares": iss.num_shares,
                "issue_date": str(iss.issue_date) if iss.issue_date else None,
                "certificate_number": iss.certificate_number,
                "is_jtwros": iss.is_jtwros,
                "jtwros_partner_name": iss.jtwros_partner_name,
                "is_trustee": iss.is_trustee,
                "trustee_for": iss.trustee_for,
            }
            if iss.shareholder_person:
                iss_data["shareholder_person"] = {
                    "id": str(iss.shareholder_person.id),
                    "full_name": iss.shareholder_person.full_name,
                    "person_type": iss.shareholder_person.person_type,
                }
                person_ids.add(iss.shareholder_person_id)
            issuances.append(iss_data)
        share_classes.append({
            "id": str(sc.id),
            "name": sc.name,
            "currency": sc.currency,
            "par_value": str(sc.par_value) if sc.par_value is not None else None,
            "authorized_shares": sc.authorized_shares,
            "voting_rights": sc.voting_rights,
            "issuances": issuances,
        })

    # Activities
    activities_qs = EntityActivity.objects.filter(entity=entity).select_related(
        "activity"
    ).prefetch_related("countries")
    activities = []
    for a in activities_qs:
        activities.append({
            "id": str(a.id),
            "activity_id": str(a.activity_id),
            "activity_name": a.activity.name,
            "countries": [
                {"id": str(c.id), "country_code": c.country_code, "country_name": c.country_name, "risk_weight": c.risk_weight}
                for c in a.countries.all()
            ],
            "risk_level": a.risk_level,
            "description": a.description,
        })

    # Sources of funds
    sof_qs = SourceOfFunds.objects.filter(entity=entity).select_related(
        "source"
    ).prefetch_related("countries")
    sources_of_funds = []
    for s in sof_qs:
        sources_of_funds.append({
            "id": str(s.id),
            "source_id": str(s.source_id),
            "source_name": s.source.name,
            "countries": [
                {"id": str(c.id), "country_code": c.country_code, "country_name": c.country_name, "risk_weight": c.risk_weight}
                for c in s.countries.all()
            ],
            "risk_level": s.risk_level,
            "description": s.description,
        })

    # Persons linked to this entity (for dropdowns)
    persons = list(
        Person.objects.filter(id__in=person_ids).values("id", "full_name", "person_type")
    )
    persons = [{"id": str(p["id"]), "full_name": p["full_name"], "person_type": p["person_type"]} for p in persons]

    # Catalogs
    activity_catalog = list(
        ActivityCatalog.objects.all().values("id", "name", "default_risk_level")
    )
    activity_catalog = [{"id": str(c["id"]), "name": c["name"], "default_risk_level": c["default_risk_level"]} for c in activity_catalog]

    sof_catalog = list(
        SourceOfFundsCatalog.objects.all().values("id", "name", "default_risk_level")
    )
    sof_catalog = [{"id": str(c["id"]), "name": c["name"], "default_risk_level": c["default_risk_level"]} for c in sof_catalog]

    # Countries
    countries = list(
        JurisdictionRisk.objects.all().values("id", "country_code", "country_name", "risk_weight")
    )
    countries = [{"id": str(c["id"]), "country_code": c["country_code"], "country_name": c["country_name"], "risk_weight": c["risk_weight"]} for c in countries]

    return {
        "general": general,
        "officers": officers,
        "share_classes": share_classes,
        "activities": activities,
        "sources_of_funds": sources_of_funds,
        "persons": persons,
        "activity_catalog": activity_catalog,
        "sof_catalog": sof_catalog,
        "countries": countries,
    }


# ===========================================================================
# Approval with entity changes
# ===========================================================================


@transaction.atomic
def approve_kyc_with_entity_changes(*, kyc_id, reviewed_by, modified_data=None) -> KYCSubmission:
    """Approve a KYC and apply proposed entity changes."""
    from apps.core.constants import AuditAction, AuditSource
    from apps.core.models import (
        ActivityCatalog,
        EntityActivity,
        EntityAuditLog,
        EntityOfficer,
        ShareClass,
        ShareIssuance,
        SourceOfFunds,
        SourceOfFundsCatalog,
    )

    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)

    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(
            f"Cannot approve KYC in '{kyc.get_status_display()}' status."
        )

    proposed = modified_data if modified_data else kyc.proposed_entity_data
    if not proposed:
        # No proposed changes, just approve
        kyc.status = KYCStatus.APPROVED
        kyc.reviewed_by = reviewed_by
        kyc.reviewed_at = timezone.now()
        kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        return kyc

    entity = kyc.ticket.entity
    if not entity:
        raise ApplicationError("KYC ticket has no linked entity.")

    def _log(model_name, record_id, action, field_name, old_val, new_val):
        EntityAuditLog.objects.create(
            entity=entity,
            kyc_submission=kyc,
            model_name=model_name,
            record_id=record_id,
            action=action,
            field_name=field_name,
            old_value=old_val,
            new_value=new_val,
            changed_by=reviewed_by,
            source=AuditSource.APPROVAL,
        )

    # Apply general changes
    general = proposed.get("general", {})
    for field in ("name", "incorporation_date"):
        new_val = general.get(field)
        if new_val is not None:
            old_val = getattr(entity, field)
            old_val_str = str(old_val) if old_val is not None else None
            if old_val_str != str(new_val):
                _log("entity", None, AuditAction.UPDATE, field, old_val_str, str(new_val))
                if field == "incorporation_date" and new_val:
                    from datetime import date as date_type
                    if isinstance(new_val, str):
                        entity.incorporation_date = new_val
                    else:
                        entity.incorporation_date = new_val
                else:
                    setattr(entity, field, new_val)
    entity.save()

    # Apply officer changes
    proposed_officers = proposed.get("officers", [])
    existing_officer_ids = set(str(o.id) for o in EntityOfficer.objects.filter(entity=entity))
    proposed_officer_ids = set()
    for odata in proposed_officers:
        oid = odata.get("id")
        if oid and oid in existing_officer_ids:
            proposed_officer_ids.add(oid)
            officer = EntityOfficer.objects.get(id=oid)
            changed = False
            for field in ("positions", "start_date", "end_date", "is_active"):
                if field in odata:
                    old_val = getattr(officer, field)
                    new_val = odata[field]
                    if str(old_val) != str(new_val):
                        _log("entity_officer", officer.id, AuditAction.UPDATE, field, old_val, new_val)
                        setattr(officer, field, new_val)
                        changed = True
            if changed:
                officer.save()
        elif not oid or oid not in existing_officer_ids:
            # New officer
            new_officer = EntityOfficer.objects.create(
                entity=entity,
                officer_person_id=odata.get("officer_person_id"),
                officer_entity_id=odata.get("officer_entity_id"),
                positions=odata.get("positions", []),
                start_date=odata.get("start_date"),
                end_date=odata.get("end_date"),
                is_active=odata.get("is_active", True),
            )
            _log("entity_officer", new_officer.id, AuditAction.CREATE, "officer", None, odata)

    # Apply share class changes
    proposed_share_classes = proposed.get("share_classes", [])
    for scdata in proposed_share_classes:
        scid = scdata.get("id")
        if scid:
            try:
                sc = ShareClass.objects.get(id=scid, entity=entity)
                for field in ("name", "currency", "par_value", "authorized_shares", "voting_rights"):
                    if field in scdata:
                        old_val = getattr(sc, field)
                        new_val = scdata[field]
                        if str(old_val) != str(new_val):
                            _log("share_class", sc.id, AuditAction.UPDATE, field, old_val, new_val)
                            setattr(sc, field, new_val)
                sc.save()
            except ShareClass.DoesNotExist:
                pass
        else:
            new_sc = ShareClass.objects.create(
                entity=entity,
                name=scdata.get("name", ""),
                currency=scdata.get("currency", "USD"),
                par_value=scdata.get("par_value"),
                authorized_shares=scdata.get("authorized_shares"),
                voting_rights=scdata.get("voting_rights", True),
            )
            _log("share_class", new_sc.id, AuditAction.CREATE, "share_class", None, scdata)

    # Apply share issuance changes
    proposed_issuances = proposed.get("share_issuances", [])
    for issdata in proposed_issuances:
        issid = issdata.get("id")
        if issid:
            try:
                iss = ShareIssuance.objects.get(id=issid)
                for field in ("num_shares", "issue_date", "certificate_number"):
                    if field in issdata:
                        old_val = getattr(iss, field)
                        new_val = issdata[field]
                        if str(old_val) != str(new_val):
                            _log("share_issuance", iss.id, AuditAction.UPDATE, field, old_val, new_val)
                            setattr(iss, field, new_val)
                iss.save()
            except ShareIssuance.DoesNotExist:
                pass
        else:
            new_iss = ShareIssuance.objects.create(
                share_class_id=issdata.get("share_class_id"),
                shareholder_person_id=issdata.get("shareholder_person_id"),
                shareholder_entity_id=issdata.get("shareholder_entity_id"),
                num_shares=issdata.get("num_shares", 0),
                issue_date=issdata.get("issue_date"),
                certificate_number=issdata.get("certificate_number", ""),
            )
            _log("share_issuance", new_iss.id, AuditAction.CREATE, "share_issuance", None, issdata)

    # Apply activity changes
    proposed_activities = proposed.get("activities", [])
    for adata in proposed_activities:
        aid = adata.get("id")
        if not aid:
            country_ids = adata.get("country_ids", [])
            from apps.core.services import create_entity_activity
            new_act = create_entity_activity(
                entity_id=entity.id,
                activity_id=adata["activity_id"],
                country_ids=country_ids,
                risk_level=adata.get("risk_level", "low"),
                description=adata.get("description", ""),
            )
            _log("entity_activity", new_act.id, AuditAction.CREATE, "activity", None, adata)

    # Apply source of funds changes
    proposed_sof = proposed.get("sources_of_funds", [])
    for sofdata in proposed_sof:
        sofid = sofdata.get("id")
        if not sofid:
            country_ids = sofdata.get("country_ids", [])
            from apps.core.services import create_source_of_funds
            new_sof = create_source_of_funds(
                entity_id=entity.id,
                source_id=sofdata["source_id"],
                country_ids=country_ids,
                risk_level=sofdata.get("risk_level", "low"),
                description=sofdata.get("description", ""),
            )
            _log("source_of_funds", new_sof.id, AuditAction.CREATE, "source_of_funds", None, sofdata)

    # Mark KYC as approved
    kyc.status = KYCStatus.APPROVED
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])

    return kyc


@transaction.atomic
def send_back_kyc(*, kyc_id, reviewed_by, field_comments: dict) -> KYCSubmission:
    """Send back a KYC with field-level comments for the guest."""
    from apps.core.constants import AuditSource
    from apps.core.models import EntityAuditLog

    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)

    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(
            f"Cannot send back KYC in '{kyc.get_status_display()}' status."
        )

    kyc.field_comments = field_comments
    kyc.status = KYCStatus.SENT_BACK
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["field_comments", "status", "reviewed_by", "reviewed_at", "updated_at"])

    entity = kyc.ticket.entity
    if entity:
        EntityAuditLog.objects.create(
            entity=entity,
            kyc_submission=kyc,
            model_name="kyc_submission",
            action="update",
            field_name="status",
            old_value="submitted",
            new_value="sent_back",
            changed_by=reviewed_by,
            source=AuditSource.SEND_BACK,
            comment=f"Sent back with {len(field_comments)} field comment(s)",
        )

    return kyc
