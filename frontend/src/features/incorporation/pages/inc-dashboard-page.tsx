import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BuildingOfficeIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable } from "@/components/data-display/data-table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { TicketCreateModal } from "@/features/tickets/components/ticket-create-modal";
import type { Ticket } from "@/types";
import { getIncMetrics, getIncTickets } from "../api/incorporation-api";
import { StageDistributionChart } from "../components/stage-distribution-chart";
import { HighCapitalBadge } from "../components/high-capital-badge";

const JURISDICTION_OPTIONS = [
  { value: "", label: "All Jurisdictions" },
  { value: "panama", label: "Panama" },
  { value: "bvi", label: "BVI" },
  { value: "belize", label: "Belize" },
];

const priorityColorMap: Record<string, "gray" | "green" | "yellow" | "red"> = {
  low: "gray",
  medium: "green",
  high: "yellow",
  urgent: "red",
};

function getDaysInState(ticket: Ticket): number {
  const updatedAt = new Date(ticket.updated_at);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function IncDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [jurisdictionFilter, setJurisdictionFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const metricsQuery = useQuery({
    queryKey: ["inc-metrics"],
    queryFn: getIncMetrics,
  });

  const ticketsQuery = useQuery({
    queryKey: ["inc-tickets", jurisdictionFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (jurisdictionFilter) {
        params.jurisdiction_code = jurisdictionFilter;
      }
      return getIncTickets(params);
    },
  });

  const metrics = metricsQuery.data;
  const tickets = ticketsQuery.data ?? [];

  const filteredTickets = tickets;

  const columns = useMemo(
    () => [
      {
        key: "title",
        header: t("incorporation.columns.title"),
        render: (row: Ticket) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{row.title}</span>
            <HighCapitalBadge metadata={row.metadata} />
          </div>
        ),
      },
      {
        key: "client",
        header: t("incorporation.columns.client"),
        render: (row: Ticket) => row.client_name || row.client?.name || "-",
      },
      {
        key: "jurisdiction",
        header: t("incorporation.columns.jurisdiction"),
        render: (row: Ticket) => (
          <Badge color="blue">{row.jurisdiction_code?.toUpperCase() || "-"}</Badge>
        ),
      },
      {
        key: "stage",
        header: t("incorporation.columns.stage"),
        render: (row: Ticket) => (
          <Badge
            color={row.current_state.is_final ? "green" : "primary"}
          >
            {row.current_state.name}
          </Badge>
        ),
      },
      {
        key: "assigned_to",
        header: t("incorporation.columns.assignedTo"),
        render: (row: Ticket) =>
          row.assigned_to
            ? `${row.assigned_to.first_name} ${row.assigned_to.last_name}`
            : t("tickets.form.unassigned"),
      },
      {
        key: "days_in_stage",
        header: t("incorporation.columns.daysInStage"),
        render: (row: Ticket) => {
          const days = getDaysInState(row);
          return (
            <span className={days > 7 ? "font-medium text-error" : "text-gray-600"}>
              {days}d
            </span>
          );
        },
      },
      {
        key: "priority",
        header: t("incorporation.columns.priority"),
        render: (row: Ticket) => (
          <Badge color={priorityColorMap[row.priority] ?? "gray"}>
            {t(`priority.${row.priority}`)}
          </Badge>
        ),
      },
    ],
    [t],
  );

  const handleRowClick = (ticket: Ticket) => {
    navigate(`/tickets/${ticket.id}`);
  };

  if (metricsQuery.isLoading && !metricsQuery.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("incorporation.dashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("incorporation.dashboard.description")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            {t("incorporation.dashboard.newIncorporation")}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t("incorporation.stats.totalActive")}
          value={metrics?.total_active ?? 0}
          icon={<BuildingOfficeIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.stats.completedThisMonth")}
          value={metrics?.completed_this_month ?? 0}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.stats.pendingPayment")}
          value={metrics?.pending_payment ?? 0}
          icon={<CreditCardIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.stats.highCapital")}
          value={metrics?.high_capital_count ?? 0}
          icon={<ExclamationTriangleIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.stats.avgProcessingDays")}
          value={metrics?.avg_processing_days != null ? `${metrics.avg_processing_days.toFixed(1)}d` : "-"}
          icon={<ClockIcon className="h-5 w-5" />}
        />
      </div>

      {/* Stage Distribution + Filters */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t("incorporation.chart.title")}</CardTitle>
          </CardHeader>
          <StageDistributionChart data={metrics?.by_stage ?? {}} />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("incorporation.dashboard.recentIncorporations")}</CardTitle>
            <div className="flex items-center gap-3">
              <div className="w-48">
                <Select
                  options={JURISDICTION_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.value
                      ? t(`onboarding.jurisdictions.${o.value}`, o.label)
                      : t("incorporation.filters.allJurisdictions"),
                  }))}
                  value={jurisdictionFilter}
                  onChange={(e) => setJurisdictionFilter(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <DataTable
            columns={columns}
            data={filteredTickets}
            onRowClick={handleRowClick}
            loading={ticketsQuery.isLoading}
            emptyMessage={t("incorporation.dashboard.noTickets")}
            keyExtractor={(row) => row.id}
            stickyHeader
          />
        </Card>
      </div>

      {/* Create Ticket Modal */}
      <TicketCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          ticketsQuery.refetch();
          metricsQuery.refetch();
        }}
      />

    </div>
  );
}
