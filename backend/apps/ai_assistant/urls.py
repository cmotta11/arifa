from django.urls import path

from . import views

app_name = "ai_assistant"

urlpatterns = [
    path("chat/", views.AIChatView.as_view(), name="chat"),
    path("suggest/", views.AISuggestView.as_view(), name="suggest"),
    path("explain-risk/", views.AIExplainRiskView.as_view(), name="explain-risk"),
    path("review-doc/", views.AIReviewDocView.as_view(), name="review-doc"),
]
