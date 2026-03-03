from rest_framework.routers import DefaultRouter

from .views import TicketViewSet, WorkflowStateViewSet, WorkflowTransitionViewSet

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="ticket")
router.register("states", WorkflowStateViewSet, basename="workflow-state")
router.register("transitions", WorkflowTransitionViewSet, basename="workflow-transition")

urlpatterns = router.urls
