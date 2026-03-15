from rest_framework.throttling import UserRateThrottle


class AIRateThrottle(UserRateThrottle):
    """Custom throttle: 30 requests per hour per authenticated user."""

    rate = "30/hour"
    scope = "ai_assistant"
