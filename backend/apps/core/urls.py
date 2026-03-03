from rest_framework.routers import DefaultRouter

from .views import (
    ActivityCatalogViewSet,
    ClientContactViewSet,
    ClientViewSet,
    EntityActivityViewSet,
    EntityOfficerViewSet,
    EntityViewSet,
    MatterViewSet,
    PersonViewSet,
    ShareClassViewSet,
    ShareIssuanceViewSet,
    SourceOfFundsCatalogViewSet,
    SourceOfFundsViewSet,
    SourceOfWealthViewSet,
)

router = DefaultRouter()
router.register("clients", ClientViewSet, basename="client")
router.register("client-contacts", ClientContactViewSet, basename="client-contact")
router.register("entities", EntityViewSet, basename="entity")
router.register("matters", MatterViewSet, basename="matter")
router.register("persons", PersonViewSet, basename="person")
router.register("entity-officers", EntityOfficerViewSet, basename="entity-officer")
router.register("share-classes", ShareClassViewSet, basename="share-class")
router.register("share-issuances", ShareIssuanceViewSet, basename="share-issuance")
router.register("activity-catalog", ActivityCatalogViewSet, basename="activity-catalog")
router.register("entity-activities", EntityActivityViewSet, basename="entity-activity")
router.register("source-of-funds-catalog", SourceOfFundsCatalogViewSet, basename="source-of-funds-catalog")
router.register("sources-of-funds", SourceOfFundsViewSet, basename="source-of-funds")
router.register("sources-of-wealth", SourceOfWealthViewSet, basename="source-of-wealth")

urlpatterns = router.urls
