from rest_framework.routers import DefaultRouter

from .views import RPAJobDefinitionViewSet, RPAJobViewSet

router = DefaultRouter()
router.register("definitions", RPAJobDefinitionViewSet, basename="rpa-definition")
router.register("jobs", RPAJobViewSet, basename="rpa-job")

urlpatterns = router.urls
