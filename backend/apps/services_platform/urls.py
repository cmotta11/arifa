from rest_framework.routers import DefaultRouter

from .views import (
    ClientPortalServiceRequestViewSet,
    ExpenseRecordViewSet,
    IncorporationDataViewSet,
    NotaryDeedPoolViewSet,
    PortalServiceCatalogViewSet,
    QuotationViewSet,
    ServiceCatalogViewSet,
    ServiceRequestViewSet,
)

app_name = "services_platform"

router = DefaultRouter()
router.register(r"catalog", ServiceCatalogViewSet, basename="service-catalog")
router.register(r"requests", ServiceRequestViewSet, basename="service-request")
router.register(r"quotations", QuotationViewSet, basename="quotation")
router.register(r"incorporation-data", IncorporationDataViewSet, basename="incorporation-data")
router.register(r"deeds", NotaryDeedPoolViewSet, basename="notary-deed")
router.register(r"expenses", ExpenseRecordViewSet, basename="expense-record")
router.register(r"portal/requests", ClientPortalServiceRequestViewSet, basename="portal-service-request")
router.register(r"portal/catalog", PortalServiceCatalogViewSet, basename="portal-service-catalog")

urlpatterns = router.urls
