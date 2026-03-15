import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { ArrowLeftIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import {
  useRiskAssessment,
  useRiskAssessmentHistory,
  useExportRiskPDF,
} from "../api/risk-matrix-api";
import {
  RISK_COLORS,
  RISK_BAR_COLORS,
  ScoreGauge,
  TriggeredRulesBox,
} from "../components/risk-display";
import type { RiskAssessment } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRiskColor(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.7) return "bg-red-500";
  if (pct >= 0.4) return "bg-yellow-500";
  return "bg-green-500";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({ assessment, t }: { assessment: RiskAssessment; t: (key: string) => string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("riskAssessment.summary")}</CardTitle>
        {assessment.is_current ? (
          <Badge color="blue">{t("riskAssessment.current")}</Badge>
        ) : (
          <Badge color="gray">{t("riskAssessment.superseded")}</Badge>
        )}
      </CardHeader>

      <div className="space-y-4">
        {/* Score gauge */}
        <ScoreGauge assessment={assessment} />

        {/* Metadata grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              {t("riskAssessment.assessedAt")}
            </p>
            <p className="mt-1 text-sm text-gray-900">
              {formatDateTime(assessment.assessed_at)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              {t("riskAssessment.assessedBy")}
            </p>
            <p className="mt-1 text-sm text-gray-900">
              {assessment.assessed_by ?? t("riskAssessment.system")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              {t("riskAssessment.trigger")}
            </p>
            <p className="mt-1 text-sm capitalize text-gray-900">
              {t(`compliance.risk.trigger.${assessment.trigger}`, { defaultValue: assessment.trigger })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">
              {assessment.entity ? t("riskAssessment.entityLabel") : t("riskAssessment.personLabel")}
            </p>
            <p className="mt-1 text-sm text-gray-900">
              {assessment.entity_name ?? assessment.person_name ?? "-"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FactorBreakdownCard({ assessment, t }: { assessment: RiskAssessment; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const entries = Object.entries(assessment.breakdown_json);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("riskAssessment.factorBreakdown")}</CardTitle>
      </CardHeader>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">{t("riskAssessment.noFactors")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {t("riskAssessment.factorName")}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {t("riskAssessment.rawScore")}
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {t("riskAssessment.maxScore")}
                </th>
                <th className="w-40 px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {t("riskAssessment.contribution")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entries.map(([code, data]) => {
                const d = data as { score: number; max_score: number; detail?: Record<string, unknown> };
                const pct = d.max_score > 0 ? (d.score / d.max_score) * 100 : 0;
                return (
                  <tr key={code}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium capitalize text-gray-900">
                      {code.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {d.score}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {d.max_score}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-full rounded-full bg-gray-200">
                          <div
                            className={`h-2.5 rounded-full transition-all ${getRiskColor(d.score, d.max_score)}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="min-w-[2.5rem] text-right text-xs text-gray-500">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TriggeredRulesCard({ assessment, t }: { assessment: RiskAssessment; t: (key: string) => string }) {
  const rules = assessment.triggered_rules;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("riskAssessment.triggeredRules")}</CardTitle>
      </CardHeader>

      {!rules || rules.length === 0 ? (
        <p className="text-sm text-gray-500">{t("riskAssessment.noTriggeredRules")}</p>
      ) : (
        <TriggeredRulesBox rules={rules} />
      )}
    </Card>
  );
}

function VersionHistoryCard({
  entityId,
  personId,
  currentId,
  t,
}: {
  entityId: string | null;
  personId: string | null;
  currentId: string;
  t: (key: string) => string;
}) {
  const historyQuery = useRiskAssessmentHistory(entityId, personId);
  const exportPDF = useExportRiskPDF();

  const history = historyQuery.data?.results ?? [];

  // Sort most recent first
  const sorted = [...history].sort(
    (a, b) => new Date(b.assessed_at).getTime() - new Date(a.assessed_at).getTime(),
  );

  const handleExportPDF = (assessmentId: string) => {
    exportPDF.mutate(assessmentId, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `risk_assessment_${assessmentId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("riskAssessment.versionHistory")}</CardTitle>
      </CardHeader>

      {historyQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gray-500">{t("riskAssessment.noHistory")}</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((a) => {
            const isCurrent = a.id === currentId;
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                  isCurrent
                    ? "border-primary/20 bg-primary/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${RISK_BAR_COLORS[a.risk_level] ?? "bg-gray-400"}`}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {t("riskAssessment.score")}: {a.total_score}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {formatDateTime(a.assessed_at)}
                    </span>
                  </div>
                  <Badge color={RISK_COLORS[a.risk_level] ?? "gray"}>
                    {t(`riskLevels.${a.risk_level}`)}
                  </Badge>
                  {isCurrent && (
                    <Badge color="blue">{t("riskAssessment.current")}</Badge>
                  )}
                  {a.is_auto_triggered && (
                    <Badge color="red">AUTO</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isCurrent && (
                    <Link
                      to={ROUTES.RISK_ASSESSMENT_DETAIL.replace(":id", a.id)}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("common.view")}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => handleExportPDF(a.id)}
                    disabled={exportPDF.isPending}
                    className="text-gray-400 hover:text-primary"
                    title={t("riskAssessment.exportPdf")}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function RiskAssessmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const assessmentQuery = useRiskAssessment(id ?? "");
  const exportPDF = useExportRiskPDF();

  const assessment = assessmentQuery.data;

  const handleExportPDF = () => {
    if (!id) return;
    exportPDF.mutate(id, {
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `risk_assessment_${id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  // Loading state
  if (assessmentQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Error state
  if (assessmentQuery.isError) {
    return (
      <div className="p-6">
        <Link
          to={ROUTES.RISK_DASHBOARD}
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("riskAssessment.backToRiskDashboard")}
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {t("riskAssessment.error")}
        </div>
      </div>
    );
  }

  // Not found state
  if (!assessment) {
    return (
      <div className="p-6">
        <Link
          to={ROUTES.RISK_DASHBOARD}
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("riskAssessment.backToRiskDashboard")}
        </Link>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {t("riskAssessment.notFound")}
        </div>
      </div>
    );
  }

  const subjectName = assessment.entity_name ?? assessment.person_name ?? "-";

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to={ROUTES.RISK_DASHBOARD}
            className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t("riskAssessment.backToRiskDashboard")}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{subjectName}</h1>
            <Badge color={RISK_COLORS[assessment.risk_level] ?? "gray"}>
              {t(`riskLevels.${assessment.risk_level}`)}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportPDF}
          disabled={exportPDF.isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {t("riskAssessment.exportPdf")}
        </button>
      </div>

      {/* Summary */}
      <SummaryCard assessment={assessment} t={t} />

      {/* Factor Breakdown */}
      <FactorBreakdownCard assessment={assessment} t={t} />

      {/* Triggered Rules */}
      <TriggeredRulesCard assessment={assessment} t={t} />

      {/* Version History */}
      <VersionHistoryCard
        entityId={assessment.entity}
        personId={assessment.person}
        currentId={assessment.id}
        t={t}
      />
    </div>
  );
}
