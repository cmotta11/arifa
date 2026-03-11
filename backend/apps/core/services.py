import logging

from django.db import transaction

from .constants import AuditAction, AuditSource, RiskLevel

logger = logging.getLogger(__name__)
from .models import (
    ActivityCatalog,
    Client,
    ClientContact,
    Entity,
    EntityActivity,
    EntityAuditLog,
    EntityOfficer,
    Matter,
    Person,
    PersonAuditLog,
    ShareClass,
    ShareIssuance,
    SourceOfFunds,
    SourceOfFundsCatalog,
    SourceOfWealth,
)


def log_entity_changes(
    *,
    entity,
    model_name,
    record_id=None,
    old_data,
    new_data,
    changed_by,
    source=AuditSource.INTERNAL,
):
    """Compare old_data and new_data dicts, create audit entries for each difference."""
    for field, new_val in new_data.items():
        old_val = old_data.get(field)
        # Normalize for comparison
        if str(old_val) != str(new_val):
            EntityAuditLog.objects.create(
                entity=entity,
                model_name=model_name,
                record_id=record_id,
                action=AuditAction.UPDATE,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
                changed_by=changed_by,
                source=source,
            )


def log_person_changes(
    *,
    person,
    model_name,
    record_id=None,
    old_data,
    new_data,
    changed_by,
    source=AuditSource.INTERNAL,
):
    """Compare old_data and new_data dicts, create audit entries for each difference."""
    for field, new_val in new_data.items():
        old_val = old_data.get(field)
        if str(old_val) != str(new_val):
            PersonAuditLog.objects.create(
                person=person,
                model_name=model_name,
                record_id=record_id,
                action=AuditAction.UPDATE,
                field_name=field,
                old_value=old_val,
                new_value=new_val,
                changed_by=changed_by,
                source=source,
            )


def log_person_creation(
    *,
    person,
    changed_by=None,
    source=AuditSource.INTERNAL,
):
    """Create an audit log entry for a newly created person."""
    PersonAuditLog.objects.create(
        person=person,
        model_name="person",
        record_id=person.id,
        action=AuditAction.CREATE,
        field_name="",
        old_value=None,
        new_value=person.display_name,
        changed_by=changed_by,
        source=source,
    )


def _risk_weight_to_level(weight: int) -> str:
    """Map a JurisdictionRisk.risk_weight (1-10) to a RiskLevel string."""
    if weight >= 8:
        return RiskLevel.ULTRA_HIGH
    elif weight >= 6:
        return RiskLevel.HIGH
    elif weight >= 4:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


@transaction.atomic
def create_client(
    *,
    name: str,
    client_type: str,
    category: str = "silver",
    **kwargs,
) -> Client:
    client = Client.objects.create(
        name=name,
        client_type=client_type,
        category=category,
        **kwargs,
    )
    return client


@transaction.atomic
def create_entity(
    *,
    name: str,
    jurisdiction: str,
    client_id,
    **kwargs,
) -> Entity:
    entity = Entity.objects.create(
        name=name,
        jurisdiction=jurisdiction,
        client_id=client_id,
        **kwargs,
    )
    return entity


@transaction.atomic
def create_matter(
    *,
    client_id,
    description: str,
    **kwargs,
) -> Matter:
    matter = Matter.objects.create(
        client_id=client_id,
        description=description,
        **kwargs,
    )
    return matter


@transaction.atomic
def create_person(
    *,
    full_name: str,
    person_type: str,
    **kwargs,
) -> Person:
    person = Person.objects.create(
        full_name=full_name,
        person_type=person_type,
        **kwargs,
    )
    return person


def search_persons(*, query: str):
    from django.db.models import Q

    return Person.objects.select_related(
        "nationality", "country_of_residence"
    ).filter(Q(full_name__icontains=query) | Q(last_name__icontains=query))


@transaction.atomic
def create_entity_officer(
    *,
    entity_id,
    officer_person_id=None,
    officer_entity_id=None,
    positions: list[str],
    **kwargs,
) -> EntityOfficer:
    officer = EntityOfficer.objects.create(
        entity_id=entity_id,
        officer_person_id=officer_person_id,
        officer_entity_id=officer_entity_id,
        positions=positions,
        **kwargs,
    )

    # Trigger risk recalculation for the entity
    from apps.compliance.services import request_risk_recalculation
    request_risk_recalculation(entity_id=entity_id)

    return officer


@transaction.atomic
def create_share_class(
    *,
    entity_id,
    name: str,
    **kwargs,
) -> ShareClass:
    return ShareClass.objects.create(
        entity_id=entity_id,
        name=name,
        **kwargs,
    )


@transaction.atomic
def create_share_issuance(
    *,
    share_class_id,
    num_shares: int,
    **kwargs,
) -> ShareIssuance:
    issuance = ShareIssuance.objects.create(
        share_class_id=share_class_id,
        num_shares=num_shares,
        **kwargs,
    )

    # Trigger risk recalculation for the entity owning this share class
    from apps.compliance.services import request_risk_recalculation
    try:
        entity_id = ShareClass.objects.filter(id=share_class_id).values_list("entity_id", flat=True).first()
        if entity_id:
            request_risk_recalculation(entity_id=entity_id)
    except Exception:
        logger.exception("Failed to schedule risk recalculation for share issuance")

    return issuance


@transaction.atomic
def create_entity_activity(
    *,
    entity_id,
    activity_id,
    country_ids: list,
    risk_level: str,
    description: str = "",
) -> EntityActivity:
    from apps.compliance.models import JurisdictionRisk

    # Compute country_risk_level from the highest-risk country
    jurisdictions = list(JurisdictionRisk.objects.filter(id__in=country_ids))
    max_weight = max((j.risk_weight for j in jurisdictions), default=1)
    country_risk_level = _risk_weight_to_level(max_weight)

    activity = EntityActivity.objects.create(
        entity_id=entity_id,
        activity_id=activity_id,
        country_risk_level=country_risk_level,
        risk_level=risk_level,
        description=description,
    )
    activity.countries.set(jurisdictions)

    # Trigger risk recalculation for the entity
    from apps.compliance.services import request_risk_recalculation
    request_risk_recalculation(entity_id=entity_id)

    return activity


@transaction.atomic
def create_source_of_funds(
    *,
    entity_id,
    source_id,
    country_ids: list,
    risk_level: str,
    description: str = "",
) -> SourceOfFunds:
    from apps.compliance.models import JurisdictionRisk

    jurisdictions = list(JurisdictionRisk.objects.filter(id__in=country_ids))
    max_weight = max((j.risk_weight for j in jurisdictions), default=1)
    country_risk_level = _risk_weight_to_level(max_weight)

    sof = SourceOfFunds.objects.create(
        entity_id=entity_id,
        source_id=source_id,
        country_risk_level=country_risk_level,
        risk_level=risk_level,
        description=description,
    )
    sof.countries.set(jurisdictions)

    # Trigger risk recalculation for the entity
    from apps.compliance.services import request_risk_recalculation
    request_risk_recalculation(entity_id=entity_id)

    return sof


# ---------------------------------------------------------------------------
# Ownership tree & UBO computation
# ---------------------------------------------------------------------------


def get_ownership_tree(entity_id, *, _depth=0, _max_depth=5, _visited=None):
    """Recursively build ownership tree for an entity.

    Returns a list of shareholder nodes.  Each node is a dict:
        {
            "type": "person" | "entity",
            "id": str(uuid),
            "name": str,
            "pct": float,            # direct % in parent entity
            "person": Person | None, # full object when type=person
            "children": [...]        # recursive for entities
        }
    """
    if _visited is None:
        _visited = set()
    if _depth >= _max_depth or str(entity_id) in _visited:
        return []

    _visited.add(str(entity_id))

    share_classes = (
        ShareClass.objects.filter(entity_id=entity_id)
        .prefetch_related(
            "issuances__shareholder_person__nationality",
            "issuances__shareholder_person__country_of_residence",
            "issuances__shareholder_person__client",
            "issuances__shareholder_entity",
        )
    )

    # Aggregate shares per holder across all classes
    holder_map: dict[str, dict] = {}
    for sc in share_classes:
        all_issuances = list(sc.issuances.all())
        total_issued = sum(iss.num_shares for iss in all_issuances)
        if total_issued == 0:
            continue
        for iss in all_issuances:
            holder_id = str(iss.shareholder_person_id or iss.shareholder_entity_id)
            if holder_id not in holder_map:
                holder_map[holder_id] = {
                    "person": iss.shareholder_person,
                    "entity": iss.shareholder_entity,
                    "total_shares": 0,
                    "total_issued": 0,
                }
            holder_map[holder_id]["total_shares"] += iss.num_shares
            holder_map[holder_id]["total_issued"] += total_issued

    nodes = []
    for _hid, data in holder_map.items():
        pct = (
            (data["total_shares"] / data["total_issued"]) * 100
            if data["total_issued"] > 0
            else 0
        )
        if data["person"]:
            nodes.append(
                {
                    "type": "person",
                    "id": str(data["person"].id),
                    "name": data["person"].display_name,
                    "person": data["person"],
                    "pct": round(pct, 2),
                    "children": [],
                }
            )
        elif data["entity"]:
            children = get_ownership_tree(
                data["entity"].id,
                _depth=_depth + 1,
                _max_depth=_max_depth,
                _visited=_visited,
            )
            nodes.append(
                {
                    "type": "entity",
                    "id": str(data["entity"].id),
                    "name": data["entity"].name,
                    "person": None,
                    "pct": round(pct, 2),
                    "children": children,
                }
            )
    return nodes


def compute_ubos(entity_id, *, threshold=25.0):
    """Walk the ownership tree and return natural persons with effective ownership >= threshold.

    Returns list of dicts:
        {
            "person": Person,
            "effective_pct": float,
            "via": [str, ...],  # chain of entity names (empty for direct)
        }
    """
    tree = get_ownership_tree(entity_id)
    ubo_map: dict[str, dict] = {}

    def _walk(nodes, parent_fraction=1.0, chain=None):
        if chain is None:
            chain = []
        for node in nodes:
            effective_pct = node["pct"] * parent_fraction
            if node["type"] == "person":
                pid = node["id"]
                if pid not in ubo_map:
                    ubo_map[pid] = {
                        "person": node["person"],
                        "effective_pct": 0,
                        "via": list(chain) if chain else [],
                    }
                ubo_map[pid]["effective_pct"] += effective_pct
                # Keep the longest chain for display
                if len(chain) > len(ubo_map[pid]["via"]):
                    ubo_map[pid]["via"] = list(chain)
            elif node["type"] == "entity" and node["children"]:
                _walk(
                    node["children"],
                    effective_pct / 100,
                    chain + [node["name"]],
                )

    _walk(tree)

    return [
        ubo
        for ubo in ubo_map.values()
        if ubo["effective_pct"] >= threshold
    ]


@transaction.atomic
def create_source_of_wealth(
    *,
    person_id,
    description: str,
    **kwargs,
) -> SourceOfWealth:
    sow = SourceOfWealth.objects.create(
        person_id=person_id,
        description=description,
        **kwargs,
    )

    # Trigger risk recalculation for the person
    from apps.compliance.services import request_risk_recalculation
    request_risk_recalculation(person_id=person_id)

    return sow


# ---------------------------------------------------------------------------
# ClientContact CRUD
# ---------------------------------------------------------------------------


@transaction.atomic
def create_client_contact(
    *,
    client_id,
    first_name: str,
    last_name: str = "",
    email: str,
    phone: str = "",
    position: str = "",
    has_portal_access: bool = False,
) -> ClientContact:
    return ClientContact.objects.create(
        client_id=client_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        position=position,
        has_portal_access=has_portal_access,
    )


@transaction.atomic
def update_client_contact(*, contact_id, **data) -> ClientContact:
    contact = ClientContact.objects.get(id=contact_id)
    allowed_fields = {
        "first_name", "last_name", "email", "phone",
        "position", "has_portal_access",
    }
    for field, value in data.items():
        if field in allowed_fields:
            setattr(contact, field, value)
    contact.save()
    return contact


@transaction.atomic
def delete_client_contact(*, contact_id) -> None:
    ClientContact.objects.filter(id=contact_id).delete()
