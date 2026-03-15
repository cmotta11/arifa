import { useTranslation } from "react-i18next";
import { AIAssistantShell } from "@/components/ai/ai-assistant-shell";
import { useAIExplainRisk } from "@/features/ai/api/ai-api";

interface AIRiskExplanationProps {
  entityId: string;
  riskAssessmentId: string;
  className?: string;
}

function impactColor(impact: string): string {
  switch (impact.toLowerCase()) {
    case "high":
      return "bg-red-100 text-red-700";
    case "medium":
      return "bg-yellow-100 text-yellow-700";
    case "low":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function AIRiskExplanation({
  entityId,
  riskAssessmentId,
  className = "",
}: AIRiskExplanationProps) {
  const { t } = useTranslation();
  const mutation = useAIExplainRisk();

  const handleExplain = () => {
    mutation.mutate({ entityId, riskAssessmentId });
  };

  return (
    <div className={className}>
      <AIAssistantShell
        title={t("ai.risk.title")}
        loading={mutation.isPending}
        defaultOpen={false}
      >
        {mutation.data ? (
          <div className="space-y-4">
            {/* Natural language explanation */}
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {mutation.data.explanation}
            </p>

            {/* Factor breakdown */}
            {mutation.data.factors.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("riskMatrix.factorBreakdown")}
                </h4>
                <div className="space-y-1.5">
                  {mutation.data.factors.map((factor) => (
                    <div
                      key={factor.name}
                      className="flex items-center justify-between rounded-md bg-white px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {factor.name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${impactColor(factor.impact)}`}
                        >
                          {factor.impact}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {factor.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center">
            <button
              type="button"
              onClick={handleExplain}
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? t("ai.risk.loading") : t("ai.risk.explain")}
            </button>
          </div>
        )}
      </AIAssistantShell>
    </div>
  );
}
