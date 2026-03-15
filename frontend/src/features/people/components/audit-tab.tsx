import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { usePersonAuditLog, type PersonAuditLogEntry } from "../api/people-api";

const SOURCE_COLORS: Record<string, "blue" | "gray" | "green" | "yellow"> = {
  internal: "blue",
  guest_submission: "gray",
  approval: "green",
  send_back: "yellow",
};

const SOURCE_KEYS = [
  { value: "", labelKey: "common.all" },
  { value: "internal", labelKey: "entities.audit.sources.internal" },
  { value: "guest_submission", labelKey: "entities.audit.sources.guest_submission" },
  { value: "approval", labelKey: "entities.audit.sources.approval" },
  { value: "send_back", labelKey: "entities.audit.sources.send_back" },
] as const;

interface PersonAuditTabProps {
  personId: string;
}

export function PersonAuditTab({ personId }: PersonAuditTabProps) {
  const { t } = useTranslation();
  const [sourceFilter, setSourceFilter] = useState("");

  const filters: { source?: string } = {};
  if (sourceFilter) filters.source = sourceFilter;

  const { data, isLoading } = usePersonAuditLog(personId, filters);
  const entries = data?.results ?? [];

  const columns = [
    {
      key: "created_at",
      header: t("people.audit.timestamp"),
      render: (row: PersonAuditLogEntry & Record<string, unknown>) =>
        new Date(row.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "changed_by",
      header: t("people.audit.user"),
      render: (row: PersonAuditLogEntry & Record<string, unknown>) =>
        row.changed_by
          ? `${row.changed_by.first_name} ${row.changed_by.last_name}`
          : "—",
    },
    {
      key: "source",
      header: t("people.audit.source"),
      render: (row: PersonAuditLogEntry & Record<string, unknown>) => (
        <Badge color={SOURCE_COLORS[row.source] ?? "gray"}>
          {t(`entities.audit.sources.${row.source}`)}
        </Badge>
      ),
    },
    {
      key: "field_name",
      header: t("people.audit.field"),
      render: (row: PersonAuditLogEntry & Record<string, unknown>) =>
        row.action === "create" ? (
          <Badge color="green">{t("common.created")}</Badge>
        ) : (
          <code className="text-xs">{row.field_name}</code>
        ),
    },
    {
      key: "change",
      header: t("people.audit.change"),
      render: (row: PersonAuditLogEntry & Record<string, unknown>) =>
        row.action === "create" ? (
          <span className="text-sm font-medium text-gray-900">{formatValue(row.new_value, t)}</span>
        ) : (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-400 line-through">{formatValue(row.old_value, t)}</span>
            <span className="text-gray-300">&rarr;</span>
            <span className="font-medium text-gray-900">{formatValue(row.new_value, t)}</span>
          </div>
        ),
    },
    {
      key: "comment",
      header: t("people.audit.comment"),
      render: (row: PersonAuditLogEntry & Record<string, unknown>) =>
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
            label={t("people.audit.source")}
            options={SOURCE_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
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
          <p className="text-sm text-gray-500">{t("people.audit.noEntries")}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <DataTable
            columns={columns}
            data={entries}
            loading={isLoading}
            emptyMessage={t("people.audit.noEntries")}
            keyExtractor={(row) => row.id as string}
          />
        </div>
      )}
    </div>
  );
}

function formatValue(val: unknown, t?: (key: string) => string): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val || "—";
  if (typeof val === "boolean") return val ? (t?.("common.yes") ?? "Yes") : (t?.("common.no") ?? "No");
  if (Array.isArray(val)) return val.join(", ") || "—";
  return JSON.stringify(val);
}
