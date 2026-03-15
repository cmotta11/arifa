import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable } from "@/components/data-display/data-table";
import { api } from "@/lib/api-client";
import { downloadCSV } from "@/lib/export";
import { useQuery } from "@tanstack/react-query";
import { useRiskStats } from "../api/risk-matrix-api";
import type { PaginatedResponse } from "@/types";
import { ROUTES } from "@/config/routes";
import { ComplianceCalendar } from "../components/compliance-calendar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceOverviewEntity {
  id: string;
  name: string;
  jurisdiction: string;
  client_name: string;
  status: string;
  kyc_status: string | null;
  es_status: string | null;
  ar_status: string | null;
  risk_level: string | null;
  risk_score: number | null;
}

interface OverviewStats {
  total_entities: number;
  pending_kyc: number;
  pending_es: number;
  pending_ar: number;
  high_risk_entities: number;
  overdue_items: number;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

function useComplianceOverviewStats() {
  return useQuery({
    queryKey: ["complianceOverview", "stats"],
    queryFn: () => api.get<OverviewStats>("/compliance/overview-stats/"),
  });
}

function useComplianceOverviewEntities(filters: Record<string, string>) {
  return useQuery({
    queryKey: ["complianceOverview", "entities", filters],
    queryFn: () =>
      api.get<PaginatedResponse<ComplianceOverviewEntity>>(
        "/compliance/overview-entities/",
        { per_page: "100", ...filters }
      ),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RISK_BADGE: Record<string, "green" | "yellow" | "red" | "gray"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

const STATUS_BADGE: Record<string, "green" | "yellow" | "blue" | "red" | "gray"> = {
  approved: "green",
  completed: "green",
  submitted: "blue",
  in_review: "yellow",
  pending: "gray",
  in_progress: "yellow",
  rejected: "red",
  draft: "gray",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ComplianceOverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Record<string, string>>({});

  const statsQuery = useComplianceOverviewStats();
  const riskStatsQuery = useRiskStats();
  const entitiesQuery = useComplianceOverviewEntities(filters);

  const stats = statsQuery.data;
  const entities = entitiesQuery.data?.results ?? [];

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === "" || value === "all") {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleExportCSV = () => {
    const rows = entities.map((e) => ({
      Entity: e.name,
      Jurisdiction: e.jurisdiction,
      Client: e.client_name,
      "KYC Status": e.kyc_status ?? "-",
      "ES Status": e.es_status ?? "-",
      "AR Status": e.ar_status ?? "-",
      "Risk Level": e.risk_level ?? "-",
      "Risk Score": e.risk_score ?? "-",
    }));
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(rows, `compliance-overview-${date}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("compliance.overview.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("compliance.overview.description")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExportCSV}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {t("common.exportCSV")}
        </Button>
      </div>

      {/* KPI Cards */}
      {statsQuery.isLoading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label={t("compliance.overview.totalEntities")}
            value={stats?.total_entities ?? 0}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
          <StatCard
            label={t("compliance.overview.pendingKyc")}
            value={stats?.pending_kyc ?? 0}
            icon={
              <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            }
          />
          <StatCard
            label={t("compliance.overview.pendingEs")}
            value={stats?.pending_es ?? 0}
            icon={
              <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
          />
          <StatCard
            label={t("compliance.overview.pendingAr")}
            value={stats?.pending_ar ?? 0}
            icon={
              <svg className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
          />
          <StatCard
            label={t("compliance.overview.highRisk")}
            value={stats?.high_risk_entities ?? riskStatsQuery.data?.high_risk_count ?? 0}
            icon={
              <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
          <StatCard
            label={t("compliance.overview.overdue")}
            value={stats?.overdue_items ?? 0}
            icon={
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <Select
          label=""
          value={filters.risk_level ?? "all"}
          onChange={(e) => handleFilterChange("risk_level", e.target.value)}
          options={[
            { label: t("compliance.overview.allRiskLevels"), value: "all" },
            { label: t("compliance.overview.highRiskFilter"), value: "high" },
            { label: t("compliance.overview.mediumRiskFilter"), value: "medium" },
            { label: t("compliance.overview.lowRiskFilter"), value: "low" },
          ]}
        />
        <Select
          label=""
          value={filters.jurisdiction ?? "all"}
          onChange={(e) => handleFilterChange("jurisdiction", e.target.value)}
          options={[
            { label: t("compliance.overview.allJurisdictions"), value: "all" },
            { label: "BVI", value: "bvi" },
            { label: t("compliance.overview.panama"), value: "panama" },
            { label: t("compliance.overview.belize"), value: "belize" },
          ]}
        />
        <Select
          label=""
          value={filters.kyc_status ?? "all"}
          onChange={(e) => handleFilterChange("kyc_status", e.target.value)}
          options={[
            { label: t("compliance.overview.allKycStatus"), value: "all" },
            { label: t("compliance.overview.draft"), value: "draft" },
            { label: t("compliance.overview.submitted"), value: "submitted" },
            { label: t("compliance.overview.underReview"), value: "under_review" },
            { label: t("compliance.overview.approved"), value: "approved" },
            { label: t("compliance.overview.rejected"), value: "rejected" },
          ]}
        />
      </div>

      {/* Compliance Calendar */}
      <ComplianceCalendar />

      {/* Entity Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <DataTable<Record<string, unknown>>
          columns={[
            {
              key: "name",
              header: t("compliance.overview.entity"),
              render: (row) => (
                <span className="font-medium text-gray-900">
                  {String(row.name)}
                </span>
              ),
            },
            {
              key: "jurisdiction",
              header: t("compliance.overview.jurisdiction"),
              render: (row) => (
                <span className="uppercase text-gray-500">
                  {String(row.jurisdiction)}
                </span>
              ),
            },
            {
              key: "client_name",
              header: t("compliance.overview.client"),
            },
            {
              key: "kyc_status",
              header: t("compliance.overview.kyc"),
              render: (row) =>
                row.kyc_status ? (
                  <Badge color={STATUS_BADGE[String(row.kyc_status)] ?? "gray"}>
                    {String(row.kyc_status)}
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                ),
            },
            {
              key: "es_status",
              header: t("compliance.overview.es"),
              render: (row) =>
                row.es_status ? (
                  <Badge color={STATUS_BADGE[String(row.es_status)] ?? "gray"}>
                    {String(row.es_status)}
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                ),
            },
            {
              key: "ar_status",
              header: t("compliance.overview.ar"),
              render: (row) =>
                row.ar_status ? (
                  <Badge color={STATUS_BADGE[String(row.ar_status)] ?? "gray"}>
                    {String(row.ar_status)}
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                ),
            },
            {
              key: "risk_level",
              header: t("compliance.overview.risk"),
              render: (row) =>
                row.risk_level ? (
                  <Badge color={RISK_BADGE[String(row.risk_level)] ?? "gray"}>
                    {String(row.risk_level)}
                    {row.risk_score != null && ` (${row.risk_score})`}
                  </Badge>
                ) : (
                  <span className="text-xs text-gray-400">-</span>
                ),
            },
          ]}
          data={entities}
          loading={entitiesQuery.isLoading}
          emptyMessage={t("compliance.overview.noEntities")}
          onRowClick={(row) => navigate(`/entities/${row.id}`)}
          keyExtractor={(row) => String(row.id)}
        />
      </div>
    </div>
  );
}
