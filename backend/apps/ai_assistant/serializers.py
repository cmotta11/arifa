from rest_framework import serializers


# ===========================================================================
# Chat
# ===========================================================================


class AIChatContextSerializer(serializers.Serializer):
    page = serializers.CharField(required=False, allow_blank=True, default="")
    formSection = serializers.CharField(required=False, allow_blank=True, default="")
    entityType = serializers.CharField(required=False, allow_blank=True, default="")
    jurisdiction = serializers.CharField(required=False, allow_blank=True, default="")
    language = serializers.CharField(required=False, allow_blank=True, default="en")


class AIChatInputSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=2000)
    context = AIChatContextSerializer(required=False, default=dict)


class AIChatOutputSerializer(serializers.Serializer):
    response = serializers.CharField()
    suggestions = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )


# ===========================================================================
# Field Suggestions
# ===========================================================================


class AISuggestInputSerializer(serializers.Serializer):
    entity_type = serializers.CharField(max_length=100)
    jurisdiction = serializers.CharField(max_length=100)
    form_section = serializers.CharField(max_length=100)


class AISuggestionItemSerializer(serializers.Serializer):
    field = serializers.CharField()
    value = serializers.CharField()
    confidence = serializers.IntegerField(min_value=0, max_value=100)


class AISuggestOutputSerializer(serializers.Serializer):
    suggestions = AISuggestionItemSerializer(many=True)


# ===========================================================================
# Explain Risk
# ===========================================================================


class AIExplainRiskInputSerializer(serializers.Serializer):
    entity_id = serializers.UUIDField()
    risk_assessment_id = serializers.UUIDField()


class AIRiskFactorSerializer(serializers.Serializer):
    name = serializers.CharField()
    impact = serializers.CharField()
    score = serializers.FloatField()


class AIExplainRiskOutputSerializer(serializers.Serializer):
    explanation = serializers.CharField()
    factors = AIRiskFactorSerializer(many=True)


# ===========================================================================
# Review Document
# ===========================================================================


class AIReviewDocInputSerializer(serializers.Serializer):
    document_id = serializers.UUIDField()


class AIDocIssueSerializer(serializers.Serializer):
    field = serializers.CharField()
    issue = serializers.CharField()
    severity = serializers.CharField()


class AIReviewDocOutputSerializer(serializers.Serializer):
    summary = serializers.CharField()
    issues = AIDocIssueSerializer(many=True)
    completeness = serializers.IntegerField(min_value=0, max_value=100)
