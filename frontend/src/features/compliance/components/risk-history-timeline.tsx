import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { RiskAssessment } from "@/types";
import { useKYCRiskHistory } from "../api/compliance-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const riskBadgeColor: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

const riskDotColor: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RiskHistoryTimelineProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskHistoryTimeline({ kycId }: RiskHistoryTimelineProps) {
  const { t } = useTranslation("compliance");
  const historyQuery = useKYCRiskHistory(kycId);

  if (historyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (historyQuery.isError) {
    return (
      <Card>
        <div className="py-6 text-center text-sm text-gray-500">
          {t("riskHistory.errorLoading")}
        </div>
      </Card>
    );
  }

  const assessments = historyQuery.data ?? [];

  if (assessments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("riskHistory.title")}</CardTitle>
        </CardHeader>
        <p className="py-6 text-center text-sm text-gray-500">
          {t("riskHistory.empty")}
        </p>
      </Card>
    );
  }

  // Sort most recent first
  const sorted = [...assessments].sort(
    (a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("riskHistory.title")}</CardTitle>
      </CardHeader>

      <div className="flow-root">
        <ul className="-mb-4">
          {sorted.map((assessment, index) => {
            const isLast = index === sorted.length - 1;
            const prevAssessment = index < sorted.length - 1 ? sorted[index + 1] : null;
            const scoreDelta = prevAssessment
              ? assessment.total_score - prevAssessment.total_score
              : null;

            return (
              <TimelineEntry
                key={assessment.id}
                assessment={assessment}
                scoreDelta={scoreDelta}
                isLast={isLast}
                isCurrent={index === 0}
              />
            );
          })}
        </ul>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timeline Entry
// ---------------------------------------------------------------------------

interface TimelineEntryProps {
  assessment: RiskAssessment;
  scoreDelta: number | null;
  isLast: boolean;
  isCurrent: boolean;
}

function TimelineEntry({ assessment, scoreDelta, isLast, isCurrent }: TimelineEntryProps) {
  const { t } = useTranslation("compliance");

  return (
    <li className="relative pb-6">
      {/* Connector line */}
      {!isLast && (
        <span
          className="absolute left-3.5 top-8 -ml-px h-full w-0.5 bg-gray-200"
          aria-hidden="true"
        />
      )}

      <div className="relative flex items-start gap-4">
        {/* Timeline dot */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center">
          <span
            className={`h-3.5 w-3.5 rounded-full ring-4 ring-white ${
              riskDotColor[assessment.risk_level] ?? "bg-gray-400"
            }`}
          />
        </div>

        {/* Content Card */}
        <div
          className={`
            min-w-0 flex-1 rounded-lg border p-4
            ${isCurrent ? "border-arifa-navy/20 bg-arifa-navy/5" : "border-gray-200 bg-white"}
          `}
        >
          {/* Top row: score + badge + delta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              {assessment.total_score}
            </span>
            <span className="text-sm text-gray-400">/ 100</span>
            <Badge color={riskBadgeColor[assessment.risk_level] ?? "gray"}>
              {t(`riskLevel.${assessment.risk_level}`)}
            </Badge>

            {scoreDelta !== null && scoreDelta !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-sm font-medium ${
                  scoreDelta > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {scoreDelta > 0 ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  </svg>
                )}
                {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
              </span>
            )}

            {isCurrent && (
              <Badge color="blue">{t("riskHistory.current")}</Badge>
            )}
          </div>

          {/* Details row */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <span>
              {t("riskHistory.trigger")}:{" "}
              <span className="font-medium text-gray-700">
                {t(`riskTrigger.${assessment.trigger}`, {
                  defaultValue: assessment.trigger,
                })}
              </span>
            </span>
            <time>{formatDate(assessment.assessed_at)}</time>
          </div>

          {/* Breakdown mini-summary */}
          {Object.keys(assessment.breakdown_json).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(assessment.breakdown_json).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {t(`riskFactors.${key}`, { defaultValue: key.replace(/_/g, " ") })}:{" "}
                  <span className="ml-1 font-medium">{String(value)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
