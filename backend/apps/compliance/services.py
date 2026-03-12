import logging
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from common.exceptions import ApplicationError

from .constants import (
    AccountingRecordStatus,
    KYCStatus,
    RFIStatus,
    RiskFactorCategory,
    RiskFactorCode,
    RiskLevel,
    RiskTrigger,
    ScreeningStatus,
    SnapshotStatus,
    TriggerCondition,
)
from .models import (
    AccountingRecord,
    AccountingRecordDocument,
    AutomaticTriggerRule,
    ComplianceSnapshot,
    DocumentUpload,
    JurisdictionRisk,
    KYCSubmission,
    Party,
    RFI,
    RiskAssessment,
    RiskFactor,
    RiskMatrixConfig,
    WorldCheckCase,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Legacy weights (kept for reference / backward compat with old KYC path)
# ---------------------------------------------------------------------------
_JURISDICTION_WEIGHT = 30
_PEP_WEIGHT = 25
_STRUCTURE_WEIGHT = 20
_WORLDCHECK_WEIGHT = 25
_HIGH_RISK_THRESHOLD = 70
_MEDIUM_RISK_THRESHOLD = 40


# ===========================================================================
# Matrix config resolution
# ===========================================================================


def resolve_matrix_config(*, jurisdiction="", entity_type="") -> RiskMatrixConfig:
    """Resolve the best matching active RiskMatrixConfig.

    Priority: exact match (jurisdiction+type) > jurisdiction only > global default.
    """
    # Exact match
    if jurisdiction and entity_type:
        config = RiskMatrixConfig.objects.filter(
            jurisdiction=jurisdiction, entity_type=entity_type, is_active=True
        ).order_by("-version").first()
        if config:
            return config

    # Jurisdiction only
    if jurisdiction:
        config = RiskMatrixConfig.objects.filter(
            jurisdiction=jurisdiction, entity_type="", is_active=True
        ).order_by("-version").first()
        if config:
            return config

    # Global default
    config = RiskMatrixConfig.objects.filter(
        jurisdiction="", entity_type="", is_active=True
    ).order_by("-version").first()
    if config:
        return config

    raise ApplicationError("No active RiskMatrixConfig found.")


def _snapshot_config(config: RiskMatrixConfig) -> dict:
    """Serialize a config + factors + triggers for frozen storage."""
    factors = list(config.factors.all().values(
        "code", "category", "max_score", "description", "scoring_rules_json"
    ))
    triggers = list(config.trigger_rules.filter(is_active=True).values(
        "condition", "forced_risk_level", "description"
    ))
    return {
        "config_id": str(config.id),
        "name": config.name,
        "version": config.version,
        "jurisdiction": config.jurisdiction,
        "entity_type": config.entity_type,
        "high_risk_threshold": config.high_risk_threshold,
        "medium_risk_threshold": config.medium_risk_threshold,
        "factors": factors,
        "trigger_rules": triggers,
    }


def _determine_risk_level(total_score: int, *, high_threshold=70, medium_threshold=40) -> str:
    if total_score >= high_threshold:
        return RiskLevel.HIGH
    if total_score >= medium_threshold:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


_RISK_LEVEL_RANK = {RiskLevel.LOW: 0, RiskLevel.MEDIUM: 1, RiskLevel.HIGH: 2}


# ===========================================================================
# Entity risk calculation
# ===========================================================================


def _score_entity_factor(code, max_score, entity, entity_data):
    """Score a single entity-level factor. Returns (score, detail_dict)."""
    if code == RiskFactorCode.JURISDICTION:
        jr = entity_data.get("entity_jurisdiction_risk")
        if jr:
            score = int((jr.risk_weight / 10) * max_score)
            return score, {"risk_weight": jr.risk_weight, "country": jr.country_code}
        return 0, {"note": "No jurisdiction risk data"}

    if code == RiskFactorCode.STRUCTURE_COMPLEXITY:
        officers = entity_data.get("officers", [])
        shareholders = entity_data.get("shareholders", [])
        total = len(officers) + len(shareholders)
        corporate_count = sum(
            1 for o in officers if o.officer_entity_id
        ) + sum(
            1 for s in shareholders if s.shareholder_entity_id
        )
        party_score = min(total * 2, 10)
        corporate_score = min(corporate_count * 3, 10)
        raw = party_score + corporate_score
        score = int((max_score * min(raw, 20)) / 20)
        return score, {"total": total, "corporate": corporate_count}

    if code == RiskFactorCode.ACTIVITY_RISK:
        activities = entity_data.get("activities", [])
        if not activities:
            return 0, {"note": "No activities"}
        level_map = {"low": 0.2, "medium": 0.5, "high": 0.8, "ultra_high": 1.0}
        max_level = max(level_map.get(a.risk_level, 0) for a in activities)
        score = int(max_level * max_score)
        return score, {"max_risk_level": max_level}

    if code == RiskFactorCode.SOURCE_OF_FUNDS_RISK:
        sources = entity_data.get("sources_of_funds", [])
        if not sources:
            return 0, {"note": "No sources of funds"}
        level_map = {"low": 0.2, "medium": 0.5, "high": 0.8, "ultra_high": 1.0}
        max_level = max(level_map.get(s.risk_level, 0) for s in sources)
        # Overlay country risk
        max_country_weight = 0
        for s in sources:
            for c in s.countries.all():
                max_country_weight = max(max_country_weight, c.risk_weight)
        country_factor = max_country_weight / 10 if max_country_weight else 0
        combined = (max_level + country_factor) / 2
        score = int(combined * max_score)
        return score, {"max_risk_level": max_level, "max_country_weight": max_country_weight}

    if code == RiskFactorCode.OWNERSHIP_OPACITY:
        from apps.core.services import get_ownership_tree
        tree = get_ownership_tree(entity.id, _max_depth=5)

        def _tree_depth(nodes, depth=1):
            if not nodes:
                return depth
            return max((_tree_depth(n.get("children", []), depth + 1) for n in nodes), default=depth)

        depth = _tree_depth(tree) if tree else 0
        has_trustee = any(
            s.is_trustee for s in entity_data.get("shareholders", [])
        )
        raw = min(depth * 2, 8) + (2 if has_trustee else 0)
        score = int((max_score * min(raw, 10)) / 10)
        return score, {"depth": depth, "has_trustee": has_trustee}

    if code == RiskFactorCode.MULTI_JURISDICTION:
        activities = entity_data.get("activities", [])
        sources = entity_data.get("sources_of_funds", [])
        high_risk_countries = set()
        for a in activities:
            for c in a.countries.all():
                if c.risk_weight >= 7:
                    high_risk_countries.add(c.country_code)
        for s in sources:
            for c in s.countries.all():
                if c.risk_weight >= 7:
                    high_risk_countries.add(c.country_code)
        count = len(high_risk_countries)
        score = int((max_score * min(count, 5)) / 5) if count else 0
        return score, {"high_risk_jurisdictions": list(high_risk_countries)}

    if code == RiskFactorCode.RELATIONSHIP_AGE:
        if entity.incorporation_date:
            from datetime import date
            age_years = (date.today() - entity.incorporation_date).days / 365.25
            if age_years < 1:
                score = max_score
            elif age_years < 3:
                score = int(max_score * 0.6)
            elif age_years < 5:
                score = int(max_score * 0.2)
            else:
                score = 0
            return score, {"age_years": round(age_years, 1)}
        return 0, {"note": "No incorporation date"}

    if code == RiskFactorCode.PEP_STATUS:
        persons = entity_data.get("linked_persons", [])
        pep_persons = [p for p in persons if p.pep_status]
        if pep_persons:
            return max_score, {"pep_count": len(pep_persons)}
        return 0, {"pep_count": 0}

    if code == RiskFactorCode.SANCTIONS_SCREENING:
        wc_cases = entity_data.get("worldcheck_cases", [])
        if not wc_cases:
            return 0, {"note": "No screening data"}
        status_scores = {
            ScreeningStatus.TRUE_MATCH: 1.0,
            ScreeningStatus.MATCHED: 0.6,
            ScreeningStatus.ESCALATED: 0.4,
            ScreeningStatus.CLEAR: 0,
            ScreeningStatus.PENDING: 0,
            ScreeningStatus.FALSE_POSITIVE: 0,
        }
        worst = max(status_scores.get(c.screening_status, 0) for c in wc_cases)
        score = int(worst * max_score)
        return score, {"worst_status": worst}

    return 0, {"note": f"Unknown factor code: {code}"}


def _load_entity_data(entity):
    """Load all data needed for entity risk calculation."""
    from apps.core.models import (
        EntityActivity,
        EntityOfficer,
        Person,
        ShareIssuance,
        SourceOfFunds,
    )

    # Entity's own jurisdiction risk
    entity_jurisdiction_risk = JurisdictionRisk.objects.filter(
        country_code__iexact=entity.jurisdiction
    ).first()

    officers = list(
        EntityOfficer.objects.filter(entity=entity, is_active=True)
        .select_related("officer_person", "officer_entity")
    )
    shareholders = list(
        ShareIssuance.objects.filter(share_class__entity=entity)
        .select_related("shareholder_person", "shareholder_entity")
    )
    activities = list(
        EntityActivity.objects.filter(entity=entity)
        .select_related("activity")
        .prefetch_related("countries")
    )
    sources_of_funds = list(
        SourceOfFunds.objects.filter(entity=entity)
        .select_related("source")
        .prefetch_related("countries")
    )

    # Collect all linked persons
    person_ids = set()
    for o in officers:
        if o.officer_person_id:
            person_ids.add(o.officer_person_id)
    for s in shareholders:
        if s.shareholder_person_id:
            person_ids.add(s.shareholder_person_id)

    linked_persons = list(
        Person.objects.filter(id__in=person_ids)
        .select_related("nationality", "country_of_residence")
    ) if person_ids else []

    # WorldCheck cases for linked persons via compliance parties
    wc_cases = []
    if person_ids:
        wc_cases = list(
            WorldCheckCase.objects.filter(party__person_id__in=person_ids)
            .select_related("party")
        )

    return {
        "entity_jurisdiction_risk": entity_jurisdiction_risk,
        "officers": officers,
        "shareholders": shareholders,
        "activities": activities,
        "sources_of_funds": sources_of_funds,
        "linked_persons": linked_persons,
        "worldcheck_cases": wc_cases,
    }


def _snapshot_entity_input(entity, entity_data):
    """Create a JSON-serializable snapshot of entity input data."""
    return {
        "entity": {
            "id": str(entity.id),
            "name": entity.name,
            "jurisdiction": entity.jurisdiction,
            "incorporation_date": str(entity.incorporation_date) if entity.incorporation_date else None,
            "status": entity.status,
        },
        "officers_count": len(entity_data["officers"]),
        "shareholders_count": len(entity_data["shareholders"]),
        "activities_count": len(entity_data["activities"]),
        "sources_of_funds_count": len(entity_data["sources_of_funds"]),
        "linked_persons_count": len(entity_data["linked_persons"]),
        "linked_persons": [
            {
                "id": str(p.id),
                "name": p.display_name,
                "pep_status": p.pep_status,
                "nationality": p.nationality.country_code if p.nationality else None,
            }
            for p in entity_data["linked_persons"]
        ],
        "worldcheck_cases_count": len(entity_data["worldcheck_cases"]),
    }


def _evaluate_entity_triggers(config, entity, entity_data):
    """Check automatic trigger rules against entity data. Returns list of fired triggers."""
    fired = []
    rules = config.trigger_rules.filter(is_active=True)

    for rule in rules:
        if rule.condition == TriggerCondition.PEP_STATUS:
            persons = entity_data.get("linked_persons", [])
            pep_persons = [p for p in persons if p.pep_status]
            if pep_persons:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"{len(pep_persons)} PEP(s) detected",
                })

        elif rule.condition == TriggerCondition.SANCTIONS_MATCH:
            wc_cases = entity_data.get("worldcheck_cases", [])
            true_matches = [c for c in wc_cases if c.screening_status == ScreeningStatus.TRUE_MATCH]
            if true_matches:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"{len(true_matches)} sanctions TRUE_MATCH(es)",
                })

        elif rule.condition == TriggerCondition.HIGH_RISK_JURISDICTION:
            jr = entity_data.get("entity_jurisdiction_risk")
            if jr and jr.risk_weight >= 9:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"Entity jurisdiction {jr.country_code} weight={jr.risk_weight}",
                })
            # Also check linked persons' nationalities
            for p in entity_data.get("linked_persons", []):
                if p.nationality and p.nationality.risk_weight >= 9:
                    fired.append({
                        "condition": rule.condition,
                        "forced_level": rule.forced_risk_level,
                        "detail": f"Person {p.display_name} nationality {p.nationality.country_code} weight={p.nationality.risk_weight}",
                    })
                    break

        elif rule.condition == TriggerCondition.COMPLEX_STRUCTURE:
            from apps.core.services import get_ownership_tree
            tree = get_ownership_tree(entity.id, _max_depth=5)

            def _max_corporate_depth(nodes, depth=0):
                if not nodes:
                    return depth
                return max(
                    _max_corporate_depth(n.get("children", []), depth + 1)
                    for n in nodes
                    if n.get("type") == "entity"
                ) if any(n.get("type") == "entity" for n in nodes) else depth

            max_depth = _max_corporate_depth(tree) if tree else 0
            if max_depth > 3:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"Corporate layers depth={max_depth}",
                })

    return fired


@transaction.atomic
def calculate_entity_risk(
    *, entity_id, trigger: str = RiskTrigger.AUTO, snapshot=None, assessed_by=None
) -> RiskAssessment:
    """Run the full risk matrix algorithm for an entity."""
    from apps.core.models import Entity

    entity = Entity.objects.get(id=entity_id)
    config = resolve_matrix_config(jurisdiction=entity.jurisdiction)
    entity_data = _load_entity_data(entity)

    # Score each entity factor
    factors = config.factors.filter(category=RiskFactorCategory.ENTITY)
    breakdown = {}
    total_score = 0

    for factor in factors:
        score, detail = _score_entity_factor(
            factor.code, factor.max_score, entity, entity_data
        )
        breakdown[factor.code] = {
            "score": score,
            "max_score": factor.max_score,
            "detail": detail,
        }
        total_score += score

    # Evaluate automatic triggers
    fired_triggers = _evaluate_entity_triggers(config, entity, entity_data)
    risk_level = _determine_risk_level(
        total_score,
        high_threshold=config.high_risk_threshold,
        medium_threshold=config.medium_risk_threshold,
    )

    is_auto_triggered = False
    if fired_triggers:
        highest_forced = max(
            _RISK_LEVEL_RANK.get(t["forced_level"], 0) for t in fired_triggers
        )
        current_rank = _RISK_LEVEL_RANK.get(risk_level, 0)
        if highest_forced > current_rank:
            # Override to the highest forced level
            for level, rank in _RISK_LEVEL_RANK.items():
                if rank == highest_forced:
                    risk_level = level
                    break
            is_auto_triggered = True

    # Mark previous assessments as non-current
    RiskAssessment.objects.filter(
        entity=entity, is_current=True
    ).update(is_current=False)

    assessment = RiskAssessment.objects.create(
        entity=entity,
        total_score=total_score,
        risk_level=risk_level,
        breakdown_json=breakdown,
        is_current=True,
        trigger=trigger,
        matrix_config=config,
        matrix_config_snapshot=_snapshot_config(config),
        input_data_snapshot=_snapshot_entity_input(entity, entity_data),
        triggered_rules=fired_triggers,
        is_auto_triggered=is_auto_triggered,
        assessed_by=assessed_by,
        snapshot=snapshot,
    )

    logger.info(
        "Entity risk assessment: entity=%s score=%d level=%s trigger=%s auto_triggered=%s",
        entity_id, total_score, risk_level, trigger, is_auto_triggered,
    )
    return assessment


# ===========================================================================
# Person risk calculation
# ===========================================================================


def _load_person_data(person):
    """Load all data needed for person risk calculation."""
    from apps.core.models import SourceOfWealth

    sources_of_wealth = list(SourceOfWealth.objects.filter(person=person))

    # WorldCheck cases via compliance parties
    party_ids = Party.objects.filter(person=person).values_list("id", flat=True)
    wc_cases = list(WorldCheckCase.objects.filter(party_id__in=party_ids))

    # Check for ID documents
    has_id_doc = DocumentUpload.objects.filter(
        party__person=person,
        document_type__in=["passport", "cedula"],
    ).exists()

    return {
        "sources_of_wealth": sources_of_wealth,
        "worldcheck_cases": wc_cases,
        "has_id_doc": has_id_doc,
    }


def _score_person_factor(code, max_score, person, person_data):
    """Score a single person-level factor."""
    if code == RiskFactorCode.NATIONALITY_RISK:
        if person.nationality:
            score = int((person.nationality.risk_weight / 10) * max_score)
            return score, {"country": person.nationality.country_code, "weight": person.nationality.risk_weight}
        return 0, {"note": "No nationality set"}

    if code == RiskFactorCode.RESIDENCE_RISK:
        if person.country_of_residence:
            score = int((person.country_of_residence.risk_weight / 10) * max_score)
            return score, {"country": person.country_of_residence.country_code, "weight": person.country_of_residence.risk_weight}
        return 0, {"note": "No residence set"}

    if code == RiskFactorCode.PEP_STATUS:
        if person.pep_status:
            return max_score, {"is_pep": True}
        return 0, {"is_pep": False}

    if code == RiskFactorCode.SANCTIONS_SCREENING:
        wc_cases = person_data.get("worldcheck_cases", [])
        if not wc_cases:
            return 0, {"note": "No screening data"}
        status_scores = {
            ScreeningStatus.TRUE_MATCH: 1.0,
            ScreeningStatus.MATCHED: 0.6,
            ScreeningStatus.ESCALATED: 0.4,
            ScreeningStatus.CLEAR: 0,
            ScreeningStatus.PENDING: 0,
            ScreeningStatus.FALSE_POSITIVE: 0,
        }
        worst = max(status_scores.get(c.screening_status, 0) for c in wc_cases)
        score = int(worst * max_score)
        return score, {"worst_status": worst}

    if code == RiskFactorCode.SOURCE_OF_WEALTH_RISK:
        sources = person_data.get("sources_of_wealth", [])
        if not sources:
            return 0, {"note": "No sources of wealth"}
        level_map = {"low": 0.2, "medium": 0.5, "high": 0.8, "ultra_high": 1.0}
        max_level = max(level_map.get(s.risk_level, 0) for s in sources)
        score = int(max_level * max_score)
        return score, {"max_risk_level": max_level}

    if code == RiskFactorCode.ID_VERIFICATION:
        if not person_data.get("has_id_doc"):
            return max_score, {"verified": False}
        return 0, {"verified": True}

    return 0, {"note": f"Unknown factor code: {code}"}


def _snapshot_person_input(person, person_data):
    """Create a JSON-serializable snapshot of person input data."""
    return {
        "person": {
            "id": str(person.id),
            "name": person.display_name,
            "person_type": person.person_type,
            "pep_status": person.pep_status,
            "nationality": person.nationality.country_code if person.nationality else None,
            "country_of_residence": person.country_of_residence.country_code if person.country_of_residence else None,
        },
        "sources_of_wealth_count": len(person_data["sources_of_wealth"]),
        "worldcheck_cases_count": len(person_data["worldcheck_cases"]),
        "has_id_doc": person_data["has_id_doc"],
    }


def _evaluate_person_triggers(config, person, person_data):
    """Check automatic trigger rules against person data."""
    fired = []
    rules = config.trigger_rules.filter(is_active=True)

    for rule in rules:
        if rule.condition == TriggerCondition.PEP_STATUS:
            if person.pep_status:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": "Person is PEP",
                })

        elif rule.condition == TriggerCondition.SANCTIONS_MATCH:
            wc_cases = person_data.get("worldcheck_cases", [])
            true_matches = [c for c in wc_cases if c.screening_status == ScreeningStatus.TRUE_MATCH]
            if true_matches:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"{len(true_matches)} sanctions TRUE_MATCH(es)",
                })

        elif rule.condition == TriggerCondition.HIGH_RISK_JURISDICTION:
            if person.nationality and person.nationality.risk_weight >= 9:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"Nationality {person.nationality.country_code} weight={person.nationality.risk_weight}",
                })
            elif person.country_of_residence and person.country_of_residence.risk_weight >= 9:
                fired.append({
                    "condition": rule.condition,
                    "forced_level": rule.forced_risk_level,
                    "detail": f"Residence {person.country_of_residence.country_code} weight={person.country_of_residence.risk_weight}",
                })

    return fired


@transaction.atomic
def calculate_person_risk(
    *, person_id, trigger: str = RiskTrigger.AUTO, snapshot=None, assessed_by=None
) -> RiskAssessment:
    """Run the full risk matrix algorithm for a person."""
    from apps.core.models import Person

    person = Person.objects.select_related(
        "nationality", "country_of_residence"
    ).get(id=person_id)

    # Use nationality jurisdiction for config resolution, fallback to global
    jurisdiction = person.nationality.country_code if person.nationality else ""
    config = resolve_matrix_config(jurisdiction=jurisdiction)
    person_data = _load_person_data(person)

    # Score each person factor
    factors = config.factors.filter(category=RiskFactorCategory.PERSON)
    breakdown = {}
    total_score = 0

    for factor in factors:
        score, detail = _score_person_factor(
            factor.code, factor.max_score, person, person_data
        )
        breakdown[factor.code] = {
            "score": score,
            "max_score": factor.max_score,
            "detail": detail,
        }
        total_score += score

    # Evaluate automatic triggers
    fired_triggers = _evaluate_person_triggers(config, person, person_data)
    risk_level = _determine_risk_level(
        total_score,
        high_threshold=config.high_risk_threshold,
        medium_threshold=config.medium_risk_threshold,
    )

    is_auto_triggered = False
    if fired_triggers:
        highest_forced = max(
            _RISK_LEVEL_RANK.get(t["forced_level"], 0) for t in fired_triggers
        )
        current_rank = _RISK_LEVEL_RANK.get(risk_level, 0)
        if highest_forced > current_rank:
            for level, rank in _RISK_LEVEL_RANK.items():
                if rank == highest_forced:
                    risk_level = level
                    break
            is_auto_triggered = True

    # Mark previous assessments as non-current
    RiskAssessment.objects.filter(
        person=person, is_current=True
    ).update(is_current=False)

    assessment = RiskAssessment.objects.create(
        person=person,
        total_score=total_score,
        risk_level=risk_level,
        breakdown_json=breakdown,
        is_current=True,
        trigger=trigger,
        matrix_config=config,
        matrix_config_snapshot=_snapshot_config(config),
        input_data_snapshot=_snapshot_person_input(person, person_data),
        triggered_rules=fired_triggers,
        is_auto_triggered=is_auto_triggered,
        assessed_by=assessed_by,
        snapshot=snapshot,
    )

    logger.info(
        "Person risk assessment: person=%s score=%d level=%s trigger=%s auto_triggered=%s",
        person_id, total_score, risk_level, trigger, is_auto_triggered,
    )
    return assessment


# ===========================================================================
# Auto-recalculation (debounced via Redis)
# ===========================================================================


def request_risk_recalculation(
    *, entity_id=None, person_id=None, trigger=RiskTrigger.AUTO, delay_seconds=5
):
    """Request a debounced risk recalculation via Celery.

    Uses Redis cache key to prevent rapid-fire recalculations.
    """
    from .tasks import recalculate_entity_risk_task, recalculate_person_risk_task

    if entity_id:
        cache_key = f"risk_recalc:entity:{entity_id}"
        if cache.add(cache_key, True, timeout=delay_seconds + 2):
            recalculate_entity_risk_task.apply_async(
                kwargs={"entity_id": str(entity_id), "trigger": trigger},
                countdown=delay_seconds,
            )
            logger.debug("Scheduled entity risk recalculation: %s", entity_id)

    if person_id:
        cache_key = f"risk_recalc:person:{person_id}"
        if cache.add(cache_key, True, timeout=delay_seconds + 2):
            recalculate_person_risk_task.apply_async(
                kwargs={"person_id": str(person_id), "trigger": trigger},
                countdown=delay_seconds,
            )
            logger.debug("Scheduled person risk recalculation: %s", person_id)


# ===========================================================================
# Compliance snapshots
# ===========================================================================


@transaction.atomic
def create_compliance_snapshot(*, name, notes="", created_by=None) -> ComplianceSnapshot:
    """Create a compliance snapshot and dispatch batch calculation."""
    snapshot = ComplianceSnapshot.objects.create(
        name=name,
        snapshot_date=timezone.now(),
        created_by=created_by,
        status=SnapshotStatus.RUNNING,
        notes=notes,
    )

    from .tasks import run_compliance_snapshot_task
    run_compliance_snapshot_task.delay(str(snapshot.id))

    return snapshot


# ===========================================================================
# Legacy KYC risk (preserved for backward compat)
# ===========================================================================


def _score_jurisdiction(parties) -> tuple[int, dict]:
    country_codes = set()
    for p in parties:
        if p.nationality:
            country_codes.add(p.nationality.upper()[:3])
        if p.country_of_residence:
            country_codes.add(p.country_of_residence.upper()[:3])
    if not country_codes:
        return 0, {"jurisdiction_countries": [], "max_weight": 0}
    jurisdiction_risks = JurisdictionRisk.objects.filter(country_code__in=country_codes)
    if not jurisdiction_risks.exists():
        return 0, {"jurisdiction_countries": list(country_codes), "max_weight": 0, "note": "No jurisdiction risk data"}
    max_weight = max(jr.risk_weight for jr in jurisdiction_risks)
    score = int((_JURISDICTION_WEIGHT * max_weight) / 10)
    return score, {"jurisdiction_countries": list(country_codes), "max_weight": max_weight, "score": score}


def _score_pep(parties) -> tuple[int, dict]:
    pep_parties = [p for p in parties if p.pep_status]
    if pep_parties:
        return _PEP_WEIGHT, {"pep_count": len(pep_parties), "pep_names": [p.name for p in pep_parties], "score": _PEP_WEIGHT}
    return 0, {"pep_count": 0, "score": 0}


def _score_structure(parties) -> tuple[int, dict]:
    total = len(parties)
    corporate_count = sum(1 for p in parties if p.party_type == "corporate")
    if total == 0:
        return 0, {"total_parties": 0, "corporate_count": 0, "score": 0}
    party_score = min(total * 2, 10)
    corporate_score = min(corporate_count * 3, 10)
    raw = party_score + corporate_score
    score = int((_STRUCTURE_WEIGHT * min(raw, 20)) / 20)
    return score, {"total_parties": total, "corporate_count": corporate_count, "score": score}


def _score_worldcheck(parties) -> tuple[int, dict]:
    party_ids = [p.id for p in parties]
    cases = WorldCheckCase.objects.filter(party_id__in=party_ids)
    matched_count = cases.filter(
        screening_status__in=[ScreeningStatus.MATCHED, ScreeningStatus.TRUE_MATCH, ScreeningStatus.ESCALATED]
    ).count()
    if matched_count == 0:
        return 0, {"matched_cases": 0, "score": 0}
    score = min(matched_count * 10, _WORLDCHECK_WEIGHT)
    return score, {"matched_cases": matched_count, "score": score}


@transaction.atomic
def calculate_risk_score(*, kyc_id, trigger: str = RiskTrigger.AUTO) -> RiskAssessment:
    """Run the legacy risk matrix for a KYC submission (backward compat)."""
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

    # Also link to entity if available
    entity_id = None
    try:
        entity_id = kyc.ticket.entity_id
    except Exception:
        pass

    RiskAssessment.objects.filter(
        kyc_submission=kyc, is_current=True
    ).update(is_current=False)

    assessment = RiskAssessment.objects.create(
        kyc_submission=kyc,
        entity_id=entity_id,
        total_score=total_score,
        risk_level=risk_level,
        breakdown_json=breakdown,
        is_current=True,
        trigger=trigger,
    )

    logger.info(
        "Risk assessment created: KYC=%s score=%d level=%s trigger=%s",
        kyc_id, total_score, risk_level, trigger,
    )
    return assessment


def generate_risk_change_summary(
    *, previous_assessment: RiskAssessment, new_assessment: RiskAssessment
) -> str:
    parts = []
    score_diff = new_assessment.total_score - previous_assessment.total_score
    direction = "increased" if score_diff > 0 else "decreased"
    parts.append(
        f"Risk score {direction} from {previous_assessment.total_score} "
        f"to {new_assessment.total_score} ({score_diff:+d} points)."
    )
    if previous_assessment.risk_level != new_assessment.risk_level:
        parts.append(
            f"Risk level changed from {previous_assessment.get_risk_level_display()} "
            f"to {new_assessment.get_risk_level_display()}."
        )
    else:
        parts.append(f"Risk level remains {new_assessment.get_risk_level_display()}.")
    prev_bd = previous_assessment.breakdown_json or {}
    new_bd = new_assessment.breakdown_json or {}
    for component in ("jurisdiction", "pep", "structure", "worldcheck"):
        prev_score = (prev_bd.get(component) or {}).get("score", 0)
        new_score = (new_bd.get(component) or {}).get("score", 0)
        if prev_score != new_score:
            parts.append(f"  - {component.capitalize()}: {prev_score} -> {new_score} ({new_score - prev_score:+d})")
    return "\n".join(parts)


# ===========================================================================
# KYC lifecycle
# ===========================================================================


@transaction.atomic
def create_kyc_submission(*, ticket_id) -> KYCSubmission:
    kyc = KYCSubmission.objects.create(ticket_id=ticket_id, status=KYCStatus.DRAFT)
    return kyc


@transaction.atomic
def submit_kyc(*, kyc_id, submitted_by) -> KYCSubmission:
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
    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)
    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(f"Cannot approve KYC in '{kyc.get_status_display()}' status.")
    kyc.status = KYCStatus.APPROVED
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return kyc


@transaction.atomic
def reject_kyc(*, kyc_id, reviewed_by) -> KYCSubmission:
    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)
    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(f"Cannot reject KYC in '{kyc.get_status_display()}' status.")
    kyc.status = KYCStatus.REJECTED
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return kyc


@transaction.atomic
def escalate_kyc(*, kyc_id, escalated_by) -> KYCSubmission:
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
    kyc = KYCSubmission.objects.get(id=kyc_id)
    if kyc.status not in {KYCStatus.DRAFT, KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}:
        raise ApplicationError(
            f"Cannot add parties to a KYC submission that has been '{kyc.get_status_display()}'."
        )
    party = Party.objects.create(kyc_submission=kyc, **party_data)
    return party


@transaction.atomic
def link_existing_person_to_party(*, party_id, person_id) -> Party:
    from apps.core.models import Person
    party = Party.objects.select_for_update().get(id=party_id)
    person = Person.objects.get(id=person_id)
    party.person = person
    party.name = person.display_name
    party.nationality = person.nationality.country_code if person.nationality else ""
    party.country_of_residence = person.country_of_residence.country_code if person.country_of_residence else ""
    party.date_of_birth = person.date_of_birth
    party.identification_number = person.identification_number
    party.pep_status = person.pep_status
    party.save(update_fields=[
        "person", "name", "nationality", "country_of_residence",
        "date_of_birth", "identification_number", "pep_status", "updated_at",
    ])
    return party


# ===========================================================================
# RFI
# ===========================================================================


@transaction.atomic
def create_rfi(*, kyc_id, requested_by, requested_fields: list, notes: str = "") -> RFI:
    kyc = KYCSubmission.objects.get(id=kyc_id)
    rfi = RFI.objects.create(
        kyc_submission=kyc, requested_by=requested_by,
        requested_fields=requested_fields, notes=notes, status=RFIStatus.OPEN,
    )
    return rfi


@transaction.atomic
def respond_to_rfi(*, rfi_id, response_text: str) -> RFI:
    rfi = RFI.objects.select_for_update().get(id=rfi_id)
    if rfi.status != RFIStatus.OPEN:
        raise ApplicationError(f"Cannot respond to RFI in '{rfi.get_status_display()}' status.")
    rfi.response_text = response_text
    rfi.status = RFIStatus.RESPONDED
    rfi.responded_at = timezone.now()
    rfi.save(update_fields=["response_text", "status", "responded_at", "updated_at"])
    return rfi


# ===========================================================================
# World-Check resolution
# ===========================================================================


@transaction.atomic
def resolve_worldcheck_match(*, case_id, resolution: str, resolved_by) -> WorldCheckCase:
    valid_resolutions = {ScreeningStatus.FALSE_POSITIVE, ScreeningStatus.TRUE_MATCH}
    if resolution not in valid_resolutions:
        raise ApplicationError(
            f"Invalid resolution '{resolution}'. Must be one of: {', '.join(valid_resolutions)}."
        )
    case = WorldCheckCase.objects.select_for_update().get(id=case_id)
    if case.screening_status not in {ScreeningStatus.MATCHED, ScreeningStatus.ESCALATED}:
        raise ApplicationError(f"Cannot resolve a case in '{case.get_screening_status_display()}' status.")
    case.screening_status = resolution
    case.resolved_by = resolved_by
    case.resolved_at = timezone.now()
    case.save(update_fields=["screening_status", "resolved_by", "resolved_at", "updated_at"])

    logger.info("World-Check case %s resolved as %s by %s", case_id, resolution, resolved_by)

    # Trigger recalculation for affected entities/persons
    if case.party and case.party.person_id:
        request_risk_recalculation(person_id=case.party.person_id)
        # Also recalc entities this person is linked to
        from apps.core.models import EntityOfficer, ShareIssuance
        entity_ids = set()
        entity_ids.update(
            EntityOfficer.objects.filter(officer_person_id=case.party.person_id)
            .values_list("entity_id", flat=True)
        )
        entity_ids.update(
            ShareIssuance.objects.filter(shareholder_person_id=case.party.person_id)
            .values_list("share_class__entity_id", flat=True)
        )
        for eid in entity_ids:
            request_risk_recalculation(entity_id=eid)

    return case


# ===========================================================================
# Document upload
# ===========================================================================


@transaction.atomic
def upload_kyc_document(*, kyc_id=None, party_id=None, document_type: str, file_data: dict, uploaded_by) -> DocumentUpload:
    if kyc_id is None and party_id is None:
        raise ApplicationError("At least one of 'kyc_id' or 'party_id' must be provided.")
    doc = DocumentUpload.objects.create(
        kyc_submission_id=kyc_id, party_id=party_id, document_type=document_type,
        original_filename=file_data.get("original_filename", "unknown"),
        file_size=file_data.get("file_size", 0),
        mime_type=file_data.get("mime_type", ""),
        uploaded_by=uploaded_by,
    )
    from .tasks import upload_document_to_sharepoint_async
    upload_document_to_sharepoint_async.delay(str(doc.id))
    return doc


# ===========================================================================
# Self-service onboarding
# ===========================================================================


def _get_system_user():
    from apps.authentication.constants import COORDINATOR
    from apps.authentication.models import User
    user, _ = User.objects.get_or_create(
        email="system@arifa.law",
        defaults={"role": COORDINATOR, "first_name": "System", "last_name": "User"},
    )
    if not user.has_usable_password():
        user.set_unusable_password()
        user.save(update_fields=["password"])
    return user


@transaction.atomic
def create_self_service_onboarding(
    *, client_name: str, client_type: str, entity_name: str,
    jurisdiction: str, contact_email: str, contact_name: str,
) -> dict:
    from apps.authentication.constants import GUEST_LINK_EXPIRY_DAYS
    from apps.authentication.models import GuestLink
    from apps.core.models import Client, Entity
    from apps.workflow.services import create_ticket

    system_user = _get_system_user()
    client = Client.objects.create(name=client_name, client_type=client_type)
    entity = Entity.objects.create(name=entity_name, jurisdiction=jurisdiction, client=client)
    ticket = create_ticket(
        title=f"KYC Onboarding - {entity_name}",
        client_id=client.id, created_by=system_user, entity=entity,
    )
    kyc = create_kyc_submission(ticket_id=ticket.id)
    guest_link = GuestLink.objects.create(
        created_by=system_user, kyc_submission=kyc,
        expires_at=timezone.now() + timedelta(days=GUEST_LINK_EXPIRY_DAYS),
    )
    logger.info(
        "Self-service onboarding created: client=%s entity=%s ticket=%s kyc=%s",
        client.id, entity.id, ticket.id, kyc.id,
    )
    return {
        "client": client, "entity": entity, "ticket": ticket,
        "kyc_submission": kyc, "guest_link": guest_link,
    }


# ===========================================================================
# Guest entity snapshot
# ===========================================================================


def build_entity_snapshot(*, entity):
    from apps.core.models import (
        ActivityCatalog, EntityActivity, EntityOfficer, Person,
        ShareClass, SourceOfFunds, SourceOfFundsCatalog,
    )

    general = {
        "name": entity.name,
        "jurisdiction": entity.jurisdiction,
        "incorporation_date": str(entity.incorporation_date) if entity.incorporation_date else None,
        "status": entity.status,
        "nominal_directors_requested": entity.nominal_directors_requested,
    }

    officers_qs = EntityOfficer.objects.filter(entity=entity).select_related("officer_person", "officer_entity")
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
                "full_name": o.officer_person.display_name,
                "person_type": o.officer_person.person_type,
            }
            person_ids.add(o.officer_person_id)
        officers.append(officer_data)

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
                    "full_name": iss.shareholder_person.display_name,
                    "person_type": iss.shareholder_person.person_type,
                }
                person_ids.add(iss.shareholder_person_id)
            issuances.append(iss_data)
        share_classes.append({
            "id": str(sc.id), "name": sc.name, "currency": sc.currency,
            "par_value": str(sc.par_value) if sc.par_value is not None else None,
            "authorized_shares": sc.authorized_shares, "voting_rights": sc.voting_rights,
            "issuances": issuances,
        })

    activities_qs = EntityActivity.objects.filter(entity=entity).select_related("activity").prefetch_related("countries")
    activities = []
    for a in activities_qs:
        activities.append({
            "id": str(a.id), "activity_id": str(a.activity_id), "activity_name": a.activity.name,
            "countries": [{"id": str(c.id), "country_code": c.country_code, "country_name": c.country_name, "risk_weight": c.risk_weight} for c in a.countries.all()],
            "risk_level": a.risk_level, "description": a.description,
        })

    sof_qs = SourceOfFunds.objects.filter(entity=entity).select_related("source").prefetch_related("countries")
    sources_of_funds = []
    for s in sof_qs:
        sources_of_funds.append({
            "id": str(s.id), "source_id": str(s.source_id), "source_name": s.source.name,
            "countries": [{"id": str(c.id), "country_code": c.country_code, "country_name": c.country_name, "risk_weight": c.risk_weight} for c in s.countries.all()],
            "risk_level": s.risk_level, "description": s.description,
        })

    persons_qs = Person.objects.filter(id__in=person_ids)
    persons = [{"id": str(p.id), "full_name": p.display_name, "person_type": p.person_type} for p in persons_qs]

    activity_catalog = list(ActivityCatalog.objects.all().values("id", "name", "default_risk_level"))
    activity_catalog = [{"id": str(c["id"]), "name": c["name"], "default_risk_level": c["default_risk_level"]} for c in activity_catalog]

    sof_catalog = list(SourceOfFundsCatalog.objects.all().values("id", "name", "default_risk_level"))
    sof_catalog = [{"id": str(c["id"]), "name": c["name"], "default_risk_level": c["default_risk_level"]} for c in sof_catalog]

    countries = list(JurisdictionRisk.objects.all().values("id", "country_code", "country_name", "risk_weight"))
    countries = [{"id": str(c["id"]), "country_code": c["country_code"], "country_name": c["country_name"], "risk_weight": c["risk_weight"]} for c in countries]

    return {
        "general": general, "officers": officers, "share_classes": share_classes,
        "activities": activities, "sources_of_funds": sources_of_funds, "persons": persons,
        "activity_catalog": activity_catalog, "sof_catalog": sof_catalog, "countries": countries,
    }


# ===========================================================================
# Approval with entity changes
# ===========================================================================


@transaction.atomic
def approve_kyc_with_entity_changes(*, kyc_id, reviewed_by, modified_data=None) -> KYCSubmission:
    from apps.core.constants import AuditAction, AuditSource
    from apps.core.models import (
        ActivityCatalog, EntityActivity, EntityAuditLog, EntityOfficer,
        ShareClass, ShareIssuance, SourceOfFunds, SourceOfFundsCatalog,
    )

    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)
    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(f"Cannot approve KYC in '{kyc.get_status_display()}' status.")

    proposed = modified_data if modified_data else kyc.proposed_entity_data
    if not proposed:
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
            entity=entity, kyc_submission=kyc, model_name=model_name,
            record_id=record_id, action=action, field_name=field_name,
            old_value=old_val, new_value=new_val, changed_by=reviewed_by,
            source=AuditSource.APPROVAL,
        )

    general = proposed.get("general", {})
    for field in ("name", "incorporation_date", "nominal_directors_requested"):
        new_val = general.get(field)
        if new_val is not None:
            old_val = getattr(entity, field)
            old_val_str = str(old_val) if old_val is not None else None
            if old_val_str != str(new_val):
                _log("entity", None, AuditAction.UPDATE, field, old_val_str, str(new_val))
                if field == "incorporation_date" and new_val:
                    entity.incorporation_date = new_val
                elif field == "nominal_directors_requested":
                    entity.nominal_directors_requested = bool(new_val)
                else:
                    setattr(entity, field, new_val)
    entity.save()

    proposed_officers = proposed.get("officers", [])
    existing_officer_ids = set(str(o.id) for o in EntityOfficer.objects.filter(entity=entity))
    for odata in proposed_officers:
        oid = odata.get("id")
        if oid and oid in existing_officer_ids:
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
                entity=entity, name=scdata.get("name", ""),
                currency=scdata.get("currency", "USD"), par_value=scdata.get("par_value"),
                authorized_shares=scdata.get("authorized_shares"),
                voting_rights=scdata.get("voting_rights", True),
            )
            _log("share_class", new_sc.id, AuditAction.CREATE, "share_class", None, scdata)

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

    proposed_activities = proposed.get("activities", [])
    for adata in proposed_activities:
        aid = adata.get("id")
        if not aid:
            from apps.core.services import create_entity_activity
            new_act = create_entity_activity(
                entity_id=entity.id, activity_id=adata["activity_id"],
                country_ids=adata.get("country_ids", []),
                risk_level=adata.get("risk_level", "low"),
                description=adata.get("description", ""),
            )
            _log("entity_activity", new_act.id, AuditAction.CREATE, "activity", None, adata)

    proposed_sof = proposed.get("sources_of_funds", [])
    for sofdata in proposed_sof:
        sofid = sofdata.get("id")
        if not sofid:
            from apps.core.services import create_source_of_funds
            new_sof = create_source_of_funds(
                entity_id=entity.id, source_id=sofdata["source_id"],
                country_ids=sofdata.get("country_ids", []),
                risk_level=sofdata.get("risk_level", "low"),
                description=sofdata.get("description", ""),
            )
            _log("source_of_funds", new_sof.id, AuditAction.CREATE, "source_of_funds", None, sofdata)

    kyc.status = KYCStatus.APPROVED
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])

    # Trigger risk recalculation for the entity
    if entity:
        request_risk_recalculation(entity_id=entity.id)

    return kyc


@transaction.atomic
def send_back_kyc(*, kyc_id, reviewed_by, field_comments: dict) -> KYCSubmission:
    from apps.core.constants import AuditSource
    from apps.core.models import EntityAuditLog

    kyc = KYCSubmission.objects.select_for_update().get(id=kyc_id)
    allowed = {KYCStatus.SUBMITTED, KYCStatus.UNDER_REVIEW}
    if kyc.status not in allowed:
        raise ApplicationError(f"Cannot send back KYC in '{kyc.get_status_display()}' status.")

    kyc.field_comments = field_comments
    kyc.status = KYCStatus.SENT_BACK
    kyc.reviewed_by = reviewed_by
    kyc.reviewed_at = timezone.now()
    kyc.save(update_fields=["field_comments", "status", "reviewed_by", "reviewed_at", "updated_at"])

    entity = kyc.ticket.entity
    if entity:
        EntityAuditLog.objects.create(
            entity=entity, kyc_submission=kyc, model_name="kyc_submission",
            action="update", field_name="status",
            old_value="submitted", new_value="sent_back",
            changed_by=reviewed_by, source=AuditSource.SEND_BACK,
            comment=f"Sent back with {len(field_comments)} field comment(s)",
        )
    return kyc


# ===========================================================================
# PDF generation
# ===========================================================================


def generate_risk_pdf(*, assessment_id) -> bytes:
    """Generate a PDF report for a risk assessment."""
    from django.template.loader import render_to_string

    assessment = RiskAssessment.objects.select_related(
        "entity", "person", "matrix_config", "assessed_by", "kyc_submission"
    ).get(id=assessment_id)

    # Use frozen data if available, otherwise current
    is_historical = not assessment.is_current

    if assessment.entity_id:
        template = "compliance/risk_report_entity.html"
    else:
        template = "compliance/risk_report_person.html"

    context = {
        "assessment": assessment,
        "breakdown": assessment.breakdown_json,
        "config_snapshot": assessment.matrix_config_snapshot,
        "input_snapshot": assessment.input_data_snapshot,
        "triggered_rules": assessment.triggered_rules,
        "is_historical": is_historical,
    }

    html_content = render_to_string(template, context)

    from apps.documents.integrations.gotenberg import GotenbergClient
    client = GotenbergClient()
    return client.convert_html_to_pdf(html_content)


def generate_snapshot_pdf(*, snapshot_id) -> bytes:
    """Generate a PDF summary for a compliance snapshot."""
    from django.template.loader import render_to_string

    snapshot = ComplianceSnapshot.objects.get(id=snapshot_id)
    assessments = RiskAssessment.objects.filter(snapshot=snapshot).select_related(
        "entity", "person"
    ).order_by("-total_score")

    context = {
        "snapshot": snapshot,
        "assessments": assessments,
    }

    html_content = render_to_string("compliance/risk_report_snapshot.html", context)

    from apps.documents.integrations.gotenberg import GotenbergClient
    client = GotenbergClient()
    return client.convert_html_to_pdf(html_content)


# ===========================================================================
# Accounting Records (Panama Law 254/2021)
# ===========================================================================


@transaction.atomic
def create_accounting_record(*, entity_id, fiscal_year=None) -> AccountingRecord:
    """Create a single accounting record for an entity."""
    from datetime import date

    if fiscal_year is None:
        fiscal_year = date.today().year - 1

    record = AccountingRecord.objects.create(
        entity_id=entity_id,
        fiscal_year=fiscal_year,
        status=AccountingRecordStatus.PENDING,
    )
    logger.info("Accounting record created: entity=%s fiscal_year=%d", entity_id, fiscal_year)
    return record


@transaction.atomic
def bulk_create_accounting_records(*, fiscal_year=None, created_by) -> list[AccountingRecord]:
    """Create AccountingRecord + GuestLink for all Panama entities that don't have one."""
    from datetime import date

    from apps.authentication.constants import GUEST_LINK_EXPIRY_DAYS
    from apps.authentication.models import GuestLink
    from apps.core.models import Entity

    if fiscal_year is None:
        fiscal_year = date.today().year - 1

    panama_entities = Entity.objects.filter(
        jurisdiction__iexact="panama",
    ).exclude(
        accounting_records__fiscal_year=fiscal_year,
    )

    records = []
    for entity in panama_entities:
        record = AccountingRecord.objects.create(
            entity=entity,
            fiscal_year=fiscal_year,
            status=AccountingRecordStatus.PENDING,
        )
        GuestLink.objects.create(
            created_by=created_by,
            accounting_record=record,
            expires_at=timezone.now() + timedelta(days=GUEST_LINK_EXPIRY_DAYS),
        )
        records.append(record)

    logger.info(
        "Bulk created %d accounting records for FY%d by %s",
        len(records), fiscal_year, created_by,
    )
    return records


@transaction.atomic
def save_accounting_record_draft(
    *,
    record_id,
    form_type="",
    form_data=None,
    signature_data="",
    signer_name="",
    signer_identification="",
) -> AccountingRecord:
    """Auto-save from guest form. Transitions PENDING->DRAFT on first save."""
    record = AccountingRecord.objects.select_for_update().get(id=record_id)
    if record.status not in {AccountingRecordStatus.PENDING, AccountingRecordStatus.DRAFT, AccountingRecordStatus.REJECTED}:
        raise ApplicationError(f"Cannot save draft for record in '{record.get_status_display()}' status.")

    update_fields = ["updated_at"]

    if form_type is not None:
        record.form_type = form_type
        update_fields.append("form_type")
    if form_data is not None:
        record.form_data = form_data
        update_fields.append("form_data")
    if signature_data is not None:
        record.signature_data = signature_data
        update_fields.append("signature_data")
    if signer_name is not None:
        record.signer_name = signer_name
        update_fields.append("signer_name")
    if signer_identification is not None:
        record.signer_identification = signer_identification
        update_fields.append("signer_identification")

    if record.status == AccountingRecordStatus.PENDING:
        record.status = AccountingRecordStatus.DRAFT
        update_fields.append("status")

    # If rejected, move back to draft when client edits and clear review metadata
    if record.status == AccountingRecordStatus.REJECTED:
        record.status = AccountingRecordStatus.DRAFT
        record.reviewed_by = None
        record.reviewed_at = None
        record.review_notes = ""
        update_fields.extend(["status", "reviewed_by", "reviewed_at", "review_notes"])

    record.save(update_fields=list(set(update_fields)))
    return record


@transaction.atomic
def submit_accounting_record(*, record_id) -> AccountingRecord:
    """Validate required fields and transition to SUBMITTED."""
    record = AccountingRecord.objects.select_for_update().get(id=record_id)
    if record.status not in {AccountingRecordStatus.DRAFT}:
        raise ApplicationError(f"Cannot submit record in '{record.get_status_display()}' status.")

    if not record.form_type:
        raise ApplicationError("Form type is required before submitting.")
    if not record.signature_data:
        raise ApplicationError("Signature is required before submitting.")
    if not record.signer_name:
        raise ApplicationError("Signer name is required before submitting.")

    record.status = AccountingRecordStatus.SUBMITTED
    record.submitted_at = timezone.now()
    record.save(update_fields=["status", "submitted_at", "updated_at"])

    logger.info("Accounting record submitted: id=%s", record_id)
    return record


@transaction.atomic
def approve_accounting_record(*, record_id, reviewed_by, review_notes="") -> AccountingRecord:
    """Approve a submitted accounting record."""
    record = AccountingRecord.objects.select_for_update().get(id=record_id)
    if record.status != AccountingRecordStatus.SUBMITTED:
        raise ApplicationError(f"Cannot approve record in '{record.get_status_display()}' status.")

    record.status = AccountingRecordStatus.APPROVED
    record.reviewed_by = reviewed_by
    record.reviewed_at = timezone.now()
    record.review_notes = review_notes
    record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_notes", "updated_at"])

    logger.info("Accounting record approved: id=%s by %s", record_id, reviewed_by)
    return record


@transaction.atomic
def reject_accounting_record(*, record_id, reviewed_by, review_notes="") -> AccountingRecord:
    """Reject a submitted accounting record so client can re-submit."""
    record = AccountingRecord.objects.select_for_update().get(id=record_id)
    if record.status != AccountingRecordStatus.SUBMITTED:
        raise ApplicationError(f"Cannot reject record in '{record.get_status_display()}' status.")

    record.status = AccountingRecordStatus.REJECTED
    record.reviewed_by = reviewed_by
    record.reviewed_at = timezone.now()
    record.review_notes = review_notes
    record.save(update_fields=["status", "reviewed_by", "reviewed_at", "review_notes", "updated_at"])

    logger.info("Accounting record rejected: id=%s by %s", record_id, reviewed_by)
    return record


ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
    "application/vnd.ms-excel",  # xls
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
}
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_DOCUMENTS_PER_RECORD = 20


def upload_accounting_document(*, record_id, file_obj, description="") -> AccountingRecordDocument:
    """Upload a supporting document for an accounting record."""
    record = AccountingRecord.objects.get(id=record_id)

    # Only allow uploads for records that are not yet approved
    if record.status == AccountingRecordStatus.APPROVED:
        raise ApplicationError("Cannot upload documents for an approved record.")

    # File size validation
    if file_obj.size > MAX_DOCUMENT_SIZE:
        raise ApplicationError(f"File size exceeds the maximum of {MAX_DOCUMENT_SIZE // (1024 * 1024)} MB.")

    # File type validation
    mime_type = getattr(file_obj, "content_type", "")
    if mime_type and mime_type not in ALLOWED_DOCUMENT_TYPES:
        raise ApplicationError(
            f"File type '{mime_type}' is not allowed. "
            "Accepted formats: PDF, JPEG, PNG, GIF, XLSX, XLS, DOCX."
        )

    # Document count limit
    existing_count = AccountingRecordDocument.objects.filter(
        accounting_record_id=record_id
    ).count()
    if existing_count >= MAX_DOCUMENTS_PER_RECORD:
        raise ApplicationError(f"Maximum of {MAX_DOCUMENTS_PER_RECORD} documents per record reached.")

    doc = AccountingRecordDocument.objects.create(
        accounting_record_id=record_id,
        file=file_obj,
        original_filename=file_obj.name,
        file_size=file_obj.size,
        mime_type=mime_type,
        description=description,
    )
    return doc
