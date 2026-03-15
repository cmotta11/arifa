import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";
import { useAISuggestions, type SuggestionItem } from "@/features/ai/api/ai-api";

interface AIFieldSuggestionsProps {
  entityType: string;
  jurisdiction: string;
  formSection: string;
  onApply: (field: string, value: string) => void;
  className?: string;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (confidence >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-gray-600 bg-gray-50 border-gray-200";
}

function confidenceBadge(confidence: number): string {
  if (confidence >= 80) return "bg-green-100 text-green-700";
  if (confidence >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
}

export function AIFieldSuggestions({
  entityType,
  jurisdiction,
  formSection,
  onApply,
  className = "",
}: AIFieldSuggestionsProps) {
  const { t } = useTranslation();
  const mutation = useAISuggestions();

  useEffect(() => {
    if (entityType && jurisdiction && formSection) {
      mutation.mutate({
        entity_type: entityType,
        jurisdiction,
        form_section: formSection,
      });
    }
    // Only re-fetch when the params change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, jurisdiction, formSection]);

  if (mutation.isPending) {
    return (
      <div className={`flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 ${className}`}>
        <Spinner size="sm" />
        <span className="text-xs text-gray-500">{t("ai.processing")}</span>
      </div>
    );
  }

  if (!mutation.data?.suggestions?.length) {
    return null;
  }

  return (
    <div className={`rounded-md border border-primary/20 bg-primary/5 p-3 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <SparklesIcon className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-primary">
          {t("ai.suggestions.title")}
        </span>
      </div>

      <div className="space-y-1.5">
        {mutation.data.suggestions.map((suggestion: SuggestionItem) => (
          <div
            key={`${suggestion.field}-${suggestion.value}`}
            className={`flex items-center justify-between rounded border px-2.5 py-1.5 ${confidenceColor(suggestion.confidence)}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{suggestion.field}:</span>
              <span className="text-xs">{suggestion.value}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${confidenceBadge(suggestion.confidence)}`}
              >
                {suggestion.confidence}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => onApply(suggestion.field, suggestion.value)}
              className="ml-2 text-xs font-medium text-primary hover:underline"
            >
              {t("ai.suggestions.apply")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
