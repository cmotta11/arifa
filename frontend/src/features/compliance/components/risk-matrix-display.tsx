import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useKYCRisk, useCalculateRisk } from "../api/compliance-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskFactor {
  key: string;
  label: string;
  max: number;
}

const RISK_FACTORS: RiskFactor[] = [
  { key: "jurisdiction_risk", label: "riskFactors.jurisdiction", max: 30 },
  { key: "pep_status", label: "riskFactors.pep", max: 25 },
  { key: "structure_complexity", label: "riskFactors.structure", max: 20 },
  { key: "worldcheck_findings", label: "riskFactors.worldcheck", max: 25 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const riskBadgeColor: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

function getGaugeColor(score: number): string {
  if (score < 40) return "#16a34a"; // green-600
  if (score < 70) return "#ca8a04"; // yellow-600
  return "#dc2626"; // red-600
}

function getBarColorClass(score: number, max: number): string {
  const pct = max > 0 ? score / max : 0;
  if (pct < 0.4) return "bg-green-500";
  if (pct < 0.7) return "bg-yellow-500";
  return "bg-red-500";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RiskMatrixDisplayProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskMatrixDisplay({ kycId }: RiskMatrixDisplayProps) {
  const { t } = useTranslation("compliance");
  const riskQuery = useKYCRisk(kycId);
  const calculateMutation = useCalculateRisk();

  if (riskQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (riskQuery.isError) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-gray-500">{t("risk.noAssessment")}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            loading={calculateMutation.isPending}
            onClick={() => calculateMutation.mutate(kycId)}
          >
            {t("risk.calculate")}
          </Button>
        </div>
      </Card>
    );
  }

  const risk = riskQuery.data;
  if (!risk) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-gray-500">{t("risk.noAssessment")}</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            loading={calculateMutation.isPending}
            onClick={() => calculateMutation.mutate(kycId)}
          >
            {t("risk.calculate")}
          </Button>
        </div>
      </Card>
    );
  }

  const score = risk.total_score;
  const gaugeColor = getGaugeColor(score);
  // SVG gauge: score out of 100, semicircle arc
  const circumference = Math.PI * 90; // r=45, semicircle
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("risk.title")}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge color={riskBadgeColor[risk.risk_level] ?? "gray"}>
            {t(`riskLevel.${risk.risk_level}`)}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            loading={calculateMutation.isPending}
            onClick={() => calculateMutation.mutate(kycId)}
          >
            {t("risk.recalculate")}
          </Button>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Gauge Chart */}
        <div className="flex flex-col items-center justify-center">
          <svg
            viewBox="0 0 120 70"
            className="w-full max-w-[200px]"
            aria-label={t("risk.scoreLabel", { score })}
          >
            {/* Background arc */}
            <path
              d="M 15 60 A 45 45 0 0 1 105 60"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d="M 15 60 A 45 45 0 0 1 105 60"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
            {/* Score text */}
            <text
              x="60"
              y="55"
              textAnchor="middle"
              className="text-2xl font-bold"
              fill={gaugeColor}
              fontSize="18"
            >
              {score}
            </text>
            <text
              x="60"
              y="66"
              textAnchor="middle"
              className="text-xs"
              fill="#6b7280"
              fontSize="7"
            >
              / 100
            </text>
          </svg>
          <p className="mt-2 text-center text-sm text-gray-500">
            {t("risk.overallScore")}
          </p>
        </div>

        {/* Breakdown Bars */}
        <div className="space-y-4">
          {RISK_FACTORS.map((factor) => {
            const factorScore =
              typeof risk.breakdown_json[factor.key] === "number"
                ? (risk.breakdown_json[factor.key] as number)
                : 0;
            const pct = factor.max > 0 ? (factorScore / factor.max) * 100 : 0;

            return (
              <div key={factor.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {t(factor.label)}
                  </span>
                  <span className="text-gray-500">
                    {factorScore} / {factor.max}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${getBarColorClass(factorScore, factor.max)}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Assessment Meta */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-gray-500">{t("risk.assessedAt")}</dt>
            <dd className="font-medium text-gray-900">
              {new Date(risk.assessed_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("risk.trigger")}</dt>
            <dd className="font-medium text-gray-900">
              {t(`riskTrigger.${risk.trigger}`, { defaultValue: risk.trigger })}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("risk.isCurrent")}</dt>
            <dd>
              <Badge color={risk.is_current ? "green" : "gray"}>
                {risk.is_current ? t("risk.current") : t("risk.historical")}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
