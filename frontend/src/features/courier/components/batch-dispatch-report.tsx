import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import type { Ticket } from "@/types";
import { fetchArchiveEntries } from "../api/courier-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMetaField(ticket: Ticket, field: string): string {
  return String(ticket.metadata?.[field] ?? "");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type StatusColor = "gray" | "blue" | "yellow" | "green";

function statusColor(stateName: string): StatusColor {
  const lower = stateName.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, StatusColor> = {
    pending_archive: "gray",
    dispatched: "blue",
    delivered: "yellow",
    filed: "green",
  };
  return map[lower] ?? "gray";
}

function toCSV(rows: Ticket[], t: (key: string) => string): string {
  const headers = [
    t("courier.batch.entity"),
    t("courier.batch.ticket"),
    t("courier.batch.trackingNumber"),
    t("courier.batch.dispatchDate"),
    t("courier.batch.courierService"),
    t("courier.batch.status"),
  ];

  const csvRows = rows.map((ticket) => {
    const entityName = ticket.entity?.name ?? "--";
    const tracking = getMetaField(ticket, "tracking_number");
    const dispatchDate = getMetaField(ticket, "dispatch_date");
    const courier = getMetaField(ticket, "courier_service");
    const status = ticket.current_state.name;
    return [entityName, ticket.title, tracking, dispatchDate, courier, status]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(",");
  });

  return [headers.join(","), ...csvRows].join("\n");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchDispatchReport() {
  const { t } = useTranslation();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const archiveQuery = useQuery({
    queryKey: ["courier", "archive", "all"],
    queryFn: () => fetchArchiveEntries({ per_page: 500 }),
  });

  // Filter tickets by dispatch date range (from metadata)
  const filteredData = useMemo(() => {
    if (!archiveQuery.data) return [];
    return archiveQuery.data.filter((ticket) => {
      const dispatchDate = getMetaField(ticket, "dispatch_date");
      if (!dispatchDate) {
        // Include tickets without a dispatch date if they fall in an open range
        return !dateFrom && !dateTo;
      }
      if (dateFrom && dispatchDate < dateFrom) return false;
      if (dateTo && dispatchDate > dateTo) return false;
      return true;
    });
  }, [archiveQuery.data, dateFrom, dateTo]);

  const handleExportCSV = () => {
    const csv = toCSV(filteredData, t);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dispatch-report-${dateFrom}-to-${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      key: "entity",
      header: t("courier.batch.entity"),
      render: (row: Ticket) => (
        <span className="font-medium text-gray-900">
          {row.entity?.name ?? "--"}
        </span>
      ),
    },
    {
      key: "title",
      header: t("courier.batch.ticket"),
      render: (row: Ticket) => (
        <span className="text-sm text-gray-700">{row.title}</span>
      ),
    },
    {
      key: "tracking_number",
      header: t("courier.batch.trackingNumber"),
      render: (row: Ticket) => (
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
          {getMetaField(row, "tracking_number") || "--"}
        </code>
      ),
    },
    {
      key: "dispatch_date",
      header: t("courier.batch.dispatchDate"),
      render: (row: Ticket) =>
        formatDate(getMetaField(row, "dispatch_date") || null),
    },
    {
      key: "courier_service",
      header: t("courier.batch.courierService"),
      render: (row: Ticket) => getMetaField(row, "courier_service") || "--",
    },
    {
      key: "status",
      header: t("courier.batch.status"),
      render: (row: Ticket) => (
        <Badge color={statusColor(row.current_state.name)}>
          {row.current_state.name}
        </Badge>
      ),
    },
  ];

  if (archiveQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <DatePicker
            label={t("courier.batch.dateFrom")}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="w-48">
          <DatePicker
            label={t("courier.batch.dateTo")}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          disabled={filteredData.length === 0}
        >
          {t("common.exportCSV")}
        </Button>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-500">
        {t("courier.batch.showing", { count: filteredData.length })}
      </p>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        emptyMessage={t("courier.batch.noEntries")}
        keyExtractor={(row) => row.id}
      />
    </div>
  );
}
