import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { useEntityAuditLog, type AuditLogEntry } from "../api/entities-api";

const SOURCE_COLORS: Record<string, "blue" | "gray" | "green" | "yellow"> = {
  internal: "blue",
  guest_submission: "gray",
  approval: "green",
  send_back: "yellow",
};

const MODEL_NAME_OPTIONS = [
  { value: "", label: "All" },
  { value: "entity", label: "Entity" },
  { value: "entity_officer", label: "Officers" },
  { value: "share_class", label: "Share Classes" },
  { value: "share_issuance", label: "Share Issuances" },
  { value: "entity_activity", label: "Activities" },
  { value: "source_of_funds", label: "Sources of Funds" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All" },
  { value: "internal", label: "Internal Edit" },
  { value: "guest_submission", label: "Guest Submission" },
  { value: "approval", label: "Approval" },
  { value: "send_back", label: "Send Back" },
];

interface AuditTabProps {
  entityId: string;
}

export function AuditTab({ entityId }: AuditTabProps) {
  const { t } = useTranslation();
  const [modelFilter, setModelFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const filters: { model_name?: string; source?: string } = {};
  if (modelFilter) filters.model_name = modelFilter;
  if (sourceFilter) filters.source = sourceFilter;

  const { data, isLoading } = useEntityAuditLog(entityId, filters);
  const entries = data?.results ?? [];

  const columns = [
    {
      key: "created_at",
      header: t("entities.audit.timestamp"),
      render: (row: AuditLogEntry & Record<string, unknown>) =>
        new Date(row.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "changed_by",
      header: t("entities.audit.user"),
      render: (row: AuditLogEntry & Record<string, unknown>) =>
        row.changed_by
          ? `${row.changed_by.first_name} ${row.changed_by.last_name}`
          : "—",
    },
    {
      key: "source",
      header: t("entities.audit.source"),
      render: (row: AuditLogEntry & Record<string, unknown>) => (
        <Badge color={SOURCE_COLORS[row.source] ?? "gray"}>
          {t(`entities.audit.sources.${row.source}`)}
        </Badge>
      ),
    },
    {
      key: "model_name",
      header: t("entities.audit.recordType"),
      render: (row: AuditLogEntry & Record<string, unknown>) => (
        <span className="capitalize">{(row.model_name as string).replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "field_name",
      header: t("entities.audit.field"),
      render: (row: AuditLogEntry & Record<string, unknown>) => (
        <code className="text-xs">{row.field_name}</code>
      ),
    },
    {
      key: "change",
      header: t("entities.audit.change"),
      render: (row: AuditLogEntry & Record<string, unknown>) => (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-400 line-through">{formatValue(row.old_value)}</span>
          <span className="text-gray-300">→</span>
          <span className="font-medium text-gray-900">{formatValue(row.new_value)}</span>
        </div>
      ),
    },
    {
      key: "comment",
      header: t("entities.audit.comment"),
      render: (row: AuditLogEntry & Record<string, unknown>) =>
        row.comment ? (
          <span className="text-xs text-gray-500">{row.comment}</span>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-48">
          <Select
            label={t("entities.audit.recordType")}
            options={MODEL_NAME_OPTIONS}
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label={t("entities.audit.source")}
            options={SOURCE_OPTIONS}
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">{t("entities.audit.noEntries")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <DataTable
            columns={columns}
            data={entries as (AuditLogEntry & Record<string, unknown>)[]}
            loading={isLoading}
            emptyMessage={t("entities.audit.noEntries")}
            keyExtractor={(row) => row.id as string}
          />
        </div>
      )}
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val || "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ") || "—";
  return JSON.stringify(val);
}
