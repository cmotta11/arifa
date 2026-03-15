import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/data-display/stat-card";
import { useRiskStats, useRiskMatrixConfigs } from "../api/risk-matrix-api";
import { useComplianceQueue } from "../api/compliance-api";
import { api } from "@/lib/api-client";
import { downloadCSV } from "@/lib/export";
import { useQuery } from "@tanstack/react-query";
import type { RiskAssessment, PaginatedResponse } from "@/types";

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function useRecentRiskAssessments() {
  return useQuery({
    queryKey: ["riskDashboard", "recent"],
    queryFn: () =>
      api.get<PaginatedResponse<RiskAssessment>>("/compliance/risk-assessments/", {
        per_page: "20",
        ordering: "-assessed_at",
        is_current: "true",
      }),
  });
}

function useHighRiskEntities() {
  return useQuery({
    queryKey: ["riskDashboard", "highRisk"],
    queryFn: () =>
      api.get<PaginatedResponse<RiskAssessment>>("/compliance/risk-assessments/", {
        per_page: "50",
        risk_level: "high",
        is_current: "true",
      }),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_COLOR: Record<string, "green" | "yellow" | "red" | "gray"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiskDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const riskStatsQuery = useRiskStats();
  const highRiskQuery = useHighRiskEntities();
  const recentQuery = useRecentRiskAssessments();

  const stats = riskStatsQuery.data;
  const highRiskEntities = highRiskQuery.data?.results ?? [];
  const recentAssessments = recentQuery.data?.results ?? [];

  const totalAssessed =
    (stats?.high_risk_count ?? 0) +
    (stats?.medium_risk_count ?? 0) +
    (stats?.low_risk_count ?? 0);

  const handleExportCSV = () => {
    const rows = recentAssessments.map((a) => {
      // Build a factor summary from the breakdown
      const factorSummary = Object.entries(a.breakdown_json ?? {})
        .map(([key, val]) => `${key}: ${val.score}/${val.max_score}`)
        .join("; ");
      return {
        Entity: a.entity_name ?? a.person_name ?? "-",
        "Risk Level": a.risk_level,
        "Risk Score": a.total_score,
        Trigger: a.trigger,
        "Assessed At": a.assessed_at
          ? new Date(a.assessed_at).toLocaleDateString()
          : "-",
        "Factor Breakdown": factorSummary,
      };
    });
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(rows, `risk-dashboard-${date}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("riskDashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("riskDashboard.description")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExportCSV}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {t("common.exportCSV")}
        </Button>
      </div>

      {/* Stats */}
      {riskStatsQuery.isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("riskDashboard.stats.totalAssessed")}
            value={totalAssessed}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <StatCard
            label={t("riskDashboard.stats.highRisk")}
            value={stats?.high_risk_count ?? 0}
            icon={
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <StatCard
            label={t("riskDashboard.stats.mediumRisk")}
            value={stats?.medium_risk_count ?? 0}
            icon={
              <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label={t("riskDashboard.stats.lowRisk")}
            value={stats?.low_risk_count ?? 0}
            icon={
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Risk Distribution Bar */}
      {stats && totalAssessed > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">
            {t("riskDashboard.distribution")}
          </h2>
          <div className="flex h-6 w-full overflow-hidden rounded-full">
            {stats.high_risk_count > 0 && (
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(stats.high_risk_count / totalAssessed) * 100}%` }}
                title={`${t("compliance.riskDashboard.high")}: ${stats.high_risk_count}`}
              />
            )}
            {stats.medium_risk_count > 0 && (
              <div
                className="bg-yellow-400 transition-all"
                style={{ width: `${(stats.medium_risk_count / totalAssessed) * 100}%` }}
                title={`${t("compliance.riskDashboard.medium")}: ${stats.medium_risk_count}`}
              />
            )}
            {stats.low_risk_count > 0 && (
              <div
                className="bg-green-500 transition-all"
                style={{ width: `${(stats.low_risk_count / totalAssessed) * 100}%` }}
                title={`${t("compliance.riskDashboard.low")}: ${stats.low_risk_count}`}
              />
            )}
          </div>
          <div className="mt-3 flex gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              {t("compliance.riskDashboard.high")} ({stats.high_risk_count})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
              {t("compliance.riskDashboard.medium")} ({stats.medium_risk_count})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
              {t("compliance.riskDashboard.low")} ({stats.low_risk_count})
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* High Risk Entities Table */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {t("riskDashboard.highRiskEntities")}
            </h2>
          </div>
          {highRiskQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : highRiskEntities.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {t("riskDashboard.noChanges")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {highRiskEntities.slice(0, 10).map((assessment) => (
                <li
                  key={assessment.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {assessment.entity_name ?? assessment.person_name ?? "-"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t("compliance.riskDashboard.score")}: {assessment.total_score}
                    </p>
                  </div>
                  <Badge color="red">{t("risk.high")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Risk Changes */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {t("riskDashboard.recentChanges")}
            </h2>
          </div>
          {recentQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : recentAssessments.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              {t("riskDashboard.noChanges")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentAssessments.slice(0, 10).map((assessment) => (
                <li key={assessment.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {assessment.entity_name ?? assessment.person_name ?? "-"}
                    </p>
                    <Badge color={RISK_COLOR[assessment.risk_level] ?? "gray"}>
                      {t(`riskLevels.${assessment.risk_level}`)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>{t(`compliance.risk.trigger.${assessment.trigger}`)}</span>
                    <span>&middot;</span>
                    <span>
                      {new Date(assessment.assessed_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
