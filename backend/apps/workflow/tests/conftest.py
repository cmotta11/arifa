import pytest

from apps.authentication.constants import COMPLIANCE_OFFICER, COORDINATOR, GESTORA

from .factories import (
    ClientFactory,
    TicketFactory,
    UserFactory,
    WorkflowStateFactory,
    WorkflowTransitionFactory,
)


@pytest.fixture
def coordinator():
    return UserFactory(role=COORDINATOR)


@pytest.fixture
def compliance_officer():
    return UserFactory(role=COMPLIANCE_OFFICER)


@pytest.fixture
def gestora():
    return UserFactory(role=GESTORA)


@pytest.fixture
def client_record():
    return ClientFactory()


@pytest.fixture
def initial_state():
    return WorkflowStateFactory(
        name="Recibido", order_index=1, is_initial=True, is_final=False
    )


@pytest.fixture
def review_state():
    return WorkflowStateFactory(
        name="Revisión Compliance", order_index=2, is_initial=False, is_final=False
    )


@pytest.fixture
def in_progress_state():
    return WorkflowStateFactory(
        name="En Proceso", order_index=3, is_initial=False, is_final=False
    )


@pytest.fixture
def completed_state():
    return WorkflowStateFactory(
        name="Completado", order_index=5, is_initial=False, is_final=True
    )


@pytest.fixture
def rejected_state():
    return WorkflowStateFactory(
        name="Rechazado", order_index=6, is_initial=False, is_final=True
    )


@pytest.fixture
def forward_transition(initial_state, review_state):
    return WorkflowTransitionFactory(
        from_state=initial_state,
        to_state=review_state,
        name="Enviar a Compliance",
        allowed_roles=[COORDINATOR],
    )


@pytest.fixture
def compliance_transition(review_state, in_progress_state):
    return WorkflowTransitionFactory(
        from_state=review_state,
        to_state=in_progress_state,
        name="Aprobar Compliance",
        allowed_roles=[COMPLIANCE_OFFICER],
    )


@pytest.fixture
def reject_transition(initial_state, rejected_state):
    return WorkflowTransitionFactory(
        from_state=initial_state,
        to_state=rejected_state,
        name="Rechazar desde Recibido",
        allowed_roles=[COORDINATOR, COMPLIANCE_OFFICER],
    )


@pytest.fixture
def ticket(initial_state, client_record, coordinator):
    return TicketFactory(
        current_state=initial_state,
        client=client_record,
        created_by=coordinator,
    )
