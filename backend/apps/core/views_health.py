from django.db import connection
from django.http import JsonResponse


def health_check(request):
    """Unauthenticated health check for Render.com monitoring."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok"})
    except Exception as exc:
        return JsonResponse(
            {"status": "error", "detail": str(exc)},
            status=503,
        )
