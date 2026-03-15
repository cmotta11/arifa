import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/data-display/data-table";
import { useRPAJobs, type RPAJobListItem } from "../api/rpa-api";

const statusColorMap: Record<RPAJobListItem["status"], "gray" | "blue" | "yellow" | "green" | "red"> = {
  pending: "gray",
  running: "blue",
  paused: "yellow",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

function ProgressBar({ total, completed }: { total: number; completed: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500">
        {completed}/{total}
      </span>
    </div>
  );
}

export default function RPAJobsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const jobsQuery = useRPAJobs(params);

  const statusOptions = [
    { value: "", label: t("rpa.allStatuses") },
    { value: "pending", label: t("rpa.statusPending") },
    { value: "running", label: t("rpa.statusRunning") },
    { value: "paused", label: t("rpa.statusPaused") },
    { value: "completed", label: t("rpa.statusCompleted") },
    { value: "failed", label: t("rpa.statusFailed") },
    { value: "cancelled", label: t("rpa.statusCancelled") },
  ];

  const columns: Column<RPAJobListItem>[] = [
    {
      key: "definition_name",
      header: t("rpa.definition"),
      render: (row) => (
        <span className="font-medium text-gray-900">{row.definition_name}</span>
      ),
    },
    {
      key: "status",
      header: t("rpa.status"),
      render: (row) => (
        <Badge color={statusColorMap[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "progress",
      header: t("rpa.progress"),
      render: (row) => (
        <ProgressBar total={row.progress.total} completed={row.progress.completed} />
      ),
    },
    {
      key: "entity_name",
      header: t("rpa.entity"),
      render: (row) => (
        <span className="text-sm text-gray-600">{row.entity_name || "-"}</span>
      ),
    },
    {
      key: "ticket_title",
      header: t("rpa.ticket"),
      render: (row) => (
        <span className="text-sm text-gray-600 truncate max-w-[150px] block">
          {row.ticket_title || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: t("rpa.createdAt"),
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
  ];

  if (jobsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">{t("rpa.title")}</h1>
        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DataTable
        data={jobsQuery.data ?? []}
        columns={columns}
        onRowClick={(row) => navigate(`/admin/rpa-jobs/${row.id}`)}
        emptyMessage={t("rpa.noJobs")}
      />
    </div>
  );
}
