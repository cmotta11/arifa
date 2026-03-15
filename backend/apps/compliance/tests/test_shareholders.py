"""
Phase 3.5.18 - Shareholders Calculator Tests

Tests for:
- Multi-level indirect ownership calculation
- Jurisdiction threshold application (10% vs 25%)
- Exception flags (stock exchange, multilateral, state-owned)
- Soft validation for >100% ownership sum
"""
import pytest
from decimal import Decimal

from apps.compliance.models import JurisdictionConfig
from apps.compliance.services import calculate_ubo_tree, save_ownership_tree
from apps.authentication.tests.factories import UserFactory
from apps.core.tests.factories import ClientFactory, EntityFactory, PersonFactory

from .factories import JurisdictionRiskFactory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def root_entity():
    client = ClientFactory()
    return EntityFactory(client=client, jurisdiction="BVI", name="Root Entity")


@pytest.fixture
def child_entity():
    client = ClientFactory()
    return EntityFactory(client=client, jurisdiction="PA", name="Child Entity Corp")


@pytest.fixture
def person_a():
    return PersonFactory(full_name="Alice Shareholder", person_type="natural")


@pytest.fixture
def person_b():
    return PersonFactory(full_name="Bob Shareholder", person_type="natural")


def _create_share_class(entity, name="Common", authorized_shares=100):
    from apps.core.models import ShareClass
    return ShareClass.objects.create(
        entity=entity,
        name=name,
        currency="USD",
        par_value=Decimal("1.00"),
        authorized_shares=authorized_shares,
        voting_rights=True,
    )


def _create_issuance(share_class, *, person=None, entity=None, num_shares):
    from apps.core.models import ShareIssuance
    return ShareIssuance.objects.create(
        share_class=share_class,
        shareholder_person=person,
        shareholder_entity=entity,
        num_shares=num_shares,
    )


# ---------------------------------------------------------------------------
# Multi-level indirect ownership calculation
# ---------------------------------------------------------------------------


class TestMultiLevelOwnership:
    def test_direct_ownership_single_person(self, root_entity, person_a):
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=60)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert len(result["nodes"]) >= 2  # entity + person
        assert len(result["edges"]) == 1

        edge = result["edges"][0]
        assert Decimal(edge["ownership_pct"]) == Decimal("60.00")
        assert Decimal(edge["effective_pct"]) == Decimal("60.00")

    def test_direct_ownership_multiple_persons(self, root_entity, person_a, person_b):
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=50)
        _create_issuance(sc, person=person_b, num_shares=30)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        person_nodes = [n for n in result["nodes"] if n["type"] == "person"]
        assert len(person_nodes) == 2
        assert len(result["edges"]) == 2

    def test_indirect_ownership_through_entity(
        self, root_entity, child_entity, person_a
    ):
        """Root Entity (100% owned by Child Entity, which is 80% owned by Person A)
        => effective ownership of Person A = 80%"""
        root_sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(root_sc, entity=child_entity, num_shares=100)

        child_sc = _create_share_class(child_entity, authorized_shares=100)
        _create_issuance(child_sc, person=person_a, num_shares=80)

        result = calculate_ubo_tree(entity_id=root_entity.id)

        # Should find Person A as reportable UBO
        ubo_names = [u["name"] for u in result["reportable_ubos"]]
        assert "Alice Shareholder" in ubo_names

        # Effective ownership: 100% * 80% = 80%
        for ubo in result["reportable_ubos"]:
            if ubo["name"] == "Alice Shareholder":
                assert Decimal(ubo["effective_ownership"]) == Decimal("80.00")

    def test_two_level_indirect_ownership(self, person_a):
        """Three-level chain: Root -> Mid -> Leaf, Leaf has person_a at 50%
        Root->Mid: 60%, Mid->Leaf: 90%, Leaf->person_a: 50%
        Effective: 60% * 90% * 50% = 27% (above 25% threshold)"""
        client = ClientFactory()
        root = EntityFactory(client=client, jurisdiction="BVI", name="Root")
        mid = EntityFactory(client=client, jurisdiction="BVI", name="Mid")
        leaf = EntityFactory(client=client, jurisdiction="BVI", name="Leaf")

        root_sc = _create_share_class(root, authorized_shares=100)
        _create_issuance(root_sc, entity=mid, num_shares=60)

        mid_sc = _create_share_class(mid, authorized_shares=100)
        _create_issuance(mid_sc, entity=leaf, num_shares=90)

        leaf_sc = _create_share_class(leaf, authorized_shares=100)
        _create_issuance(leaf_sc, person=person_a, num_shares=50)

        result = calculate_ubo_tree(entity_id=root.id)
        # Effective: 60% * 90% * 50% = 27%
        ubo_names = [u["name"] for u in result["reportable_ubos"]]
        assert "Alice Shareholder" in ubo_names

    def test_no_shareholders_produces_empty_tree(self, root_entity):
        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert len(result["edges"]) == 0
        assert len(result["reportable_ubos"]) == 0


# ---------------------------------------------------------------------------
# Jurisdiction threshold application
# ---------------------------------------------------------------------------


class TestJurisdictionThreshold:
    def test_default_25_percent_threshold(self, root_entity, person_a):
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=25)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert Decimal(result["threshold"]) == Decimal("25.00")
        assert len(result["reportable_ubos"]) == 1

    def test_person_below_threshold_not_reported(self, root_entity, person_a):
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=24)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert len(result["reportable_ubos"]) == 0

    def test_custom_10_percent_threshold(self, root_entity, person_a):
        """Jurisdiction with 10% threshold identifies more UBOs."""
        jr = JurisdictionRiskFactory(
            country_code="BV", country_name="BVI", risk_weight=4,
        )
        JurisdictionConfig.objects.create(
            jurisdiction=jr,
            ubo_threshold_percent=Decimal("10.00"),
        )
        root_entity.jurisdiction = "BV"
        root_entity.save(update_fields=["jurisdiction"])

        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=12)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert Decimal(result["threshold"]) == Decimal("10.00")
        assert len(result["reportable_ubos"]) == 1

    def test_person_at_exact_threshold(self, root_entity, person_a):
        """Person at exactly 25% should be reportable."""
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=25)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert len(result["reportable_ubos"]) == 1

    def test_override_jurisdiction_code(self, root_entity, person_a):
        """Test passing explicit jurisdiction_code to override entity's."""
        jr = JurisdictionRiskFactory(
            country_code="KY", country_name="Cayman Islands", risk_weight=5,
        )
        JurisdictionConfig.objects.create(
            jurisdiction=jr,
            ubo_threshold_percent=Decimal("15.00"),
        )

        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=16)

        result = calculate_ubo_tree(
            entity_id=root_entity.id, jurisdiction_code="KY",
        )
        assert Decimal(result["threshold"]) == Decimal("15.00")
        assert len(result["reportable_ubos"]) == 1


# ---------------------------------------------------------------------------
# Exception flags (stock exchange, multilateral, state-owned)
# ---------------------------------------------------------------------------


class TestExceptionFlags:
    def test_entity_with_stock_exchange_exception(self):
        """Entities listed on a recognized stock exchange have exception_type set."""
        client = ClientFactory()
        entity = EntityFactory(
            client=client,
            jurisdiction="BVI",
            name="Listed Corp",
        )
        entity.ubo_exception_type = "stock_exchange"
        entity.save(update_fields=["ubo_exception_type"])

        result = calculate_ubo_tree(entity_id=entity.id)
        root_node = [n for n in result["nodes"] if n["type"] == "entity" and n["name"] == "Listed Corp"]
        assert len(root_node) == 1
        assert root_node[0]["exception_type"] == "stock_exchange"

    def test_entity_with_state_owned_exception(self):
        client = ClientFactory()
        entity = EntityFactory(
            client=client,
            jurisdiction="PA",
            name="State Corp",
        )
        entity.ubo_exception_type = "state_owned"
        entity.save(update_fields=["ubo_exception_type"])

        result = calculate_ubo_tree(entity_id=entity.id)
        root_node = [n for n in result["nodes"] if n["name"] == "State Corp"]
        assert root_node[0]["exception_type"] == "state_owned"

    def test_entity_with_multilateral_exception(self):
        client = ClientFactory()
        entity = EntityFactory(
            client=client,
            jurisdiction="BVI",
            name="Multilateral Org",
        )
        entity.ubo_exception_type = "multilateral"
        entity.save(update_fields=["ubo_exception_type"])

        result = calculate_ubo_tree(entity_id=entity.id)
        root_node = [n for n in result["nodes"] if n["name"] == "Multilateral Org"]
        assert root_node[0]["exception_type"] == "multilateral"


# ---------------------------------------------------------------------------
# Soft validation for >100% ownership sum
# ---------------------------------------------------------------------------


class TestOwnershipSumValidation:
    def test_ownership_exceeding_100_produces_warning(self, root_entity, person_a, person_b):
        """When issued shares exceed authorized, a warning should be generated."""
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=60)
        _create_issuance(sc, person=person_b, num_shares=50)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        assert len(result["warnings"]) > 0
        assert "exceeds 100%" in result["warnings"][0]

    def test_ownership_at_100_no_warning(self, root_entity, person_a, person_b):
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=50)
        _create_issuance(sc, person=person_b, num_shares=50)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        ownership_warnings = [w for w in result["warnings"] if "exceeds 100%" in w]
        assert len(ownership_warnings) == 0

    def test_ownership_below_100_no_warning(self, root_entity, person_a):
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=30)

        result = calculate_ubo_tree(entity_id=root_entity.id)
        ownership_warnings = [w for w in result["warnings"] if "exceeds 100%" in w]
        assert len(ownership_warnings) == 0


# ---------------------------------------------------------------------------
# Ownership snapshot persistence
# ---------------------------------------------------------------------------


class TestOwnershipSnapshot:
    def test_save_ownership_tree(self, root_entity, person_a):
        user = UserFactory()
        sc = _create_share_class(root_entity, authorized_shares=100)
        _create_issuance(sc, person=person_a, num_shares=50)

        tree = calculate_ubo_tree(entity_id=root_entity.id)
        snapshot = save_ownership_tree(
            entity_id=root_entity.id,
            nodes=tree["nodes"],
            edges=tree["edges"],
            saved_by=user,
        )
        assert snapshot.entity_id == root_entity.id
        assert snapshot.saved_by == user
        assert len(snapshot.reportable_ubos) > 0
