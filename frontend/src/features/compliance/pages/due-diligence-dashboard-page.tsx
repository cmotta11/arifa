import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { StatCard } from "@/components/data-display/stat-card";
import {
  useKYCQueue,
  useKYCQueueStats,
  type KYCQueueFilters,
} from "../api/dd-api";
import type { KYCDetail } from "../api/compliance-api";
import { kycStatusColorMap } from "@/config/status-colors";
import { formatDate } from "@/lib/format";
import { downloadCSV } from "@/lib/export";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function getStatusOptions(t: (key: string, fallback?: string) => string) {
  return [
    { value: "all", label: t("compliance.dueDiligence.allStatuses", "All Statuses") },
    { value: "draft", label: t("compliance.dueDiligence.draft", "Draft") },
    { value: "submitted", label: t("compliance.dueDiligence.submitted", "Submitted") },
    { value: "under_review", label: t("compliance.dueDiligence.underReview", "Under Review") },
    { value: "approved", label: t("compliance.dueDiligence.approved", "Approved") },
    { value: "rejected", label: t("compliance.dueDiligence.rejected", "Rejected") },
  ];
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DueDiligenceDashboardPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters: KYCQueueFilters = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : statusFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      per_page: 100,
    }),
    [statusFilter, dateFrom, dateTo],
  );

  const queueQuery = useKYCQueue(filters);
  const statsQuery = useKYCQueueStats();

  const stats = statsQuery.data;

  // Build the table data, typed to satisfy DataTable
  const tableData: Record<string, unknown>[] = useMemo(() => {
    const items = queueQuery.data?.results ?? [];
    return items.map((kyc: KYCDetail) => ({
      id: kyc.id,
      short_id: kyc.id.slice(0, 8),
      entity_name: kyc.ticket_detail?.entity?.name ?? "-",
      client_name: kyc.ticket_detail?.client?.name ?? "-",
      status: kyc.status,
      submitted_at: kyc.submitted_at,
      reviewed_by: kyc.reviewed_by ?? "-",
      _raw: kyc,
    }));
  }, [queueQuery.data]);

  const columns = useMemo(
    () => [
      {
        key: "short_id",
        header: t("dueDiligence.columns.id", "ID"),
        render: (row: Record<string, unknown>) => (
          <span className="font-mono text-xs text-gray-600">
            {String(row.short_id)}
          </span>
        ),
      },
      {
        key: "entity_name",
        header: t("dueDiligence.columns.entity", "Entity"),
        render: (row: Record<string, unknown>) => (
          <span className="font-medium text-gray-900">
            {String(row.entity_name)}
          </span>
        ),
      },
      {
        key: "client_name",
        header: t("dueDiligence.columns.client", "Client"),
      },
      {
        key: "status",
        header: t("dueDiligence.columns.status", "Status"),
        render: (row: Record<string, unknown>) => {
          const status = String(row.status);
          return (
            <Badge color={kycStatusColorMap[status] ?? "gray"}>
              {t(`dueDiligence.status.${status}`, status)}
            </Badge>
          );
        },
      },
      {
        key: "submitted_at",
        header: t("dueDiligence.columns.submittedAt", "Submitted At"),
        render: (row: Record<string, unknown>) =>
          formatDate(row.submitted_at as string | null),
      },
      {
        key: "reviewed_by",
        header: t("dueDiligence.columns.reviewedBy", "Reviewed By"),
      },
      {
        key: "actions",
        header: t("dueDiligence.columns.actions", "Actions"),
        render: (row: Record<string, unknown>) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/kyc/${row.id}`);
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("common.view", "View")}
          </button>
        ),
      },
    ],
    [t, navigate],
  );

  const handleRowClick = (row: Record<string, unknown>) => {
    navigate(`/kyc/${row.id}`);
  };

  const handleExportCSV = () => {
    const rows = tableData.map((row) => ({
      ID: String(row.short_id),
      Entity: String(row.entity_name),
      Client: String(row.client_name),
      Status: String(row.status),
      "Submitted At": formatDate(row.submitted_at as string | null),
      "Reviewed By": String(row.reviewed_by),
    }));
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(rows, `due-diligence-${date}.csv`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("dueDiligence.title", "Due Diligence Dashboard")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              "dueDiligence.description",
              "Review and manage KYC submissions and due diligence checklists.",
            )}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExportCSV}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {t("common.exportCSV")}
        </Button>
      </div>

      {/* KPI Stat Cards */}
      {statsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label={t("dueDiligence.stats.total", "Total KYC")}
            value={stats.total}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            }
          />
          <StatCard
            label={t("dueDiligence.stats.pendingReview", "Pending Review")}
            value={stats.pending_review}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label={t("dueDiligence.stats.approved", "Approved")}
            value={stats.approved}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label={t("dueDiligence.stats.rejected", "Rejected")}
            value={stats.rejected}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label={t("dueDiligence.stats.overdue", "Overdue")}
            value={stats.overdue}
            icon={
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            }
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="w-48">
          <Select
            label={t("dueDiligence.filters.status", "Status")}
            options={getStatusOptions(t)}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            label={t("dueDiligence.filters.dateFrom", "From Date")}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Input
            label={t("dueDiligence.filters.dateTo", "To Date")}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* KYC Submissions Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={tableData}
          loading={queueQuery.isLoading}
          onRowClick={handleRowClick}
          emptyMessage={t("dueDiligence.emptyQueue", "No KYC submissions found")}
          keyExtractor={(row) => String(row.id)}
        />
      </div>
    </div>
  );
}
