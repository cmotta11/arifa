import { useTranslation } from "react-i18next";
import {
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import type { RiskAssessment } from "@/types";

export const RISK_COLORS: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

export const RISK_BAR_COLORS: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
};

function getRiskColor(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.7) return "bg-red-500";
  if (pct >= 0.4) return "bg-yellow-500";
  return "bg-green-500";
}

export function ScoreGauge({ assessment }: { assessment: RiskAssessment }) {
  const { t } = useTranslation();
  const scoreColor =
    assessment.risk_level === "high"
      ? "text-red-600"
      : assessment.risk_level === "medium"
        ? "text-yellow-600"
        : "text-green-600";

  return (
    <div className="flex items-center gap-4">
      <span className={`text-4xl font-bold ${scoreColor}`}>
        {assessment.total_score}
      </span>
      <span className="text-lg text-gray-400">/ 100</span>
      <Badge color={RISK_COLORS[assessment.risk_level] ?? "gray"}>
        {t(`riskLevels.${assessment.risk_level}`)}
        {assessment.is_auto_triggered && " (AUTO)"}
      </Badge>
    </div>
  );
}

export function TriggeredRulesBox({ rules }: { rules: RiskAssessment["triggered_rules"] }) {
  const { t } = useTranslation();
  if (!rules || rules.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-700">
        <ExclamationTriangleIcon className="h-4 w-4" />
        {t("riskMatrix.triggeredRules")}
      </div>
      {rules.map((rule, i) => (
        <div key={i} className="ml-6 text-sm text-red-600">
          <span className="font-medium uppercase">{rule.condition}</span>: {rule.detail}{" "}
          <span className="text-red-500">
            ({t("riskMatrix.forced")} {rule.forced_level.toUpperCase()})
          </span>
        </div>
      ))}
    </div>
  );
}

export function BreakdownTable({ breakdown }: { breakdown: RiskAssessment["breakdown_json"] }) {
  const { t } = useTranslation();
  const entries = Object.entries(breakdown);

  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        {t("riskMatrix.factorBreakdown")}
      </h3>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                {t("riskMatrix.factor")}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                {t("riskMatrix.score")}
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                {t("riskMatrix.max")}
              </th>
              <th className="w-32 px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                {t("riskMatrix.bar")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {entries.map(([code, data]) => {
              const d = data as { score: number; max_score: number; detail?: Record<string, unknown> };
              const pct = d.max_score > 0 ? (d.score / d.max_score) * 100 : 0;
              return (
                <tr key={code}>
                  <td className="whitespace-nowrap px-4 py-2 text-sm font-medium capitalize text-gray-900">
                    {code.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{d.score}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{d.max_score}</td>
                  <td className="px-4 py-2">
                    <div className="h-2.5 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-2.5 rounded-full ${getRiskColor(d.score, d.max_score)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RiskHistoryTimeline({
  history,
  onExportPDF,
  exporting,
}: {
  history: RiskAssessment[];
  onExportPDF: (id: string) => void;
  exporting: boolean;
}) {
  const { t } = useTranslation();

  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-500">{t("riskMatrix.noHistory")}</p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">
        {t("riskMatrix.riskHistory")}
      </h3>
      <div className="space-y-2">
        {history.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${RISK_BAR_COLORS[a.risk_level] ?? "bg-gray-400"}`}
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {t("riskMatrix.score")}: {a.total_score}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {new Date(a.assessed_at).toLocaleString()}
                </span>
              </div>
              <Badge color={RISK_COLORS[a.risk_level] ?? "gray"} className="ml-2">
                {t(`riskLevels.${a.risk_level}`)}
              </Badge>
              {a.is_auto_triggered && (
                <Badge color="red">AUTO</Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => onExportPDF(a.id)}
              disabled={exporting}
              className="text-gray-400 hover:text-primary"
              title={t("riskMatrix.exportPDF")}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
