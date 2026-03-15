import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable } from "@/components/data-display/data-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { UsersIcon, ClockIcon } from "@heroicons/react/24/outline";
import { downloadCSV } from "@/lib/export";
import { getUserActivityReport, type UserActivityUser } from "../api/reports-api";
import { useAuth } from "@/lib/auth/auth-context";
import { ROUTES } from "@/config/routes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_BADGE_COLOR: Record<string, "blue" | "green" | "yellow" | "red" | "gray"> = {
  director: "red",
  coordinator: "blue",
  compliance_officer: "green",
  gestora: "yellow",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserActivityPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [roleFilter, setRoleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const roleOptions = useMemo(
    () => [
      { value: "", label: t("reports.activity.allRoles") },
      { value: "director", label: t("roles.director") },
      { value: "coordinator", label: t("roles.coordinator") },
      { value: "compliance_officer", label: t("roles.compliance_officer") },
      { value: "gestora", label: t("roles.gestora") },
    ],
    [t],
  );

  const query = useQuery({
    queryKey: ["reports", "user-activity", dateFrom, dateTo],
    queryFn: () =>
      getUserActivityReport({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  const data = query.data;

  // Filter users by role client-side
  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    if (!roleFilter) return data.users;
    return data.users.filter((u) => u.role === roleFilter);
  }, [data, roleFilter]);

  // Average processing days across all users
  const avgProcessingDays = useMemo(() => {
    if (!filteredUsers.length) return null;
    const usersWithDays = filteredUsers.filter(
      (u) => u.avg_processing_days != null,
    );
    if (!usersWithDays.length) return null;
    const total = usersWithDays.reduce(
      (sum, u) => sum + (u.avg_processing_days ?? 0),
      0,
    );
    return (total / usersWithDays.length).toFixed(1);
  }, [filteredUsers]);

  const handleExportCSV = () => {
    const rows = filteredUsers.map((u) => ({
      Name: u.name,
      Role: u.role,
      "Tickets Completed": u.tickets_completed,
      "Avg Processing Days": u.avg_processing_days ?? "-",
      "Last Active": u.last_active
        ? new Date(u.last_active).toLocaleString()
        : "-",
    }));
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(rows, `user-activity-${date}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: t("reports.activity.name"),
        render: (row: UserActivityUser) => (
          <span className="font-medium text-gray-900">{row.name}</span>
        ),
      },
      {
        key: "role",
        header: t("reports.activity.role"),
        render: (row: UserActivityUser) => (
          <Badge color={ROLE_BADGE_COLOR[row.role] ?? "gray"}>
            {t(`roles.${row.role}`, row.role)}
          </Badge>
        ),
      },
      {
        key: "tickets_completed",
        header: t("reports.activity.ticketsCompleted"),
        render: (row: UserActivityUser) => (
          <span className="font-medium">{row.tickets_completed}</span>
        ),
      },
      {
        key: "avg_processing_days",
        header: t("reports.activity.avgProcessingDays"),
        render: (row: UserActivityUser) => (
          <span>
            {row.avg_processing_days != null
              ? `${row.avg_processing_days}d`
              : "-"}
          </span>
        ),
      },
      {
        key: "last_active",
        header: t("reports.activity.lastActive"),
        render: (row: UserActivityUser) => (
          <span className="text-gray-500">
            {row.last_active
              ? new Date(row.last_active).toLocaleDateString()
              : "-"}
          </span>
        ),
      },
    ],
    [t],
  );

  // Only staff roles may access reports; redirect clients as defense-in-depth
  if (user?.role === "client") {
    return <Navigate to={ROUTES.CLIENT_PORTAL} replace />;
  }

  if (query.isLoading && !query.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Print-only styles */}
      <style>{`
        @media print {
          nav, aside, .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("reports.activity.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("reports.activity.description")}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredUsers.length === 0}
          >
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            {t("reports.common.exportCSV")}
          </Button>
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <svg
              className="mr-1.5 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 12h.008v.008h-.008V12zm-1.5 0h.008v.008h-.008V12z"
              />
            </svg>
            {t("reports.common.print")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="w-48">
          <Select
            label=""
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            options={roleOptions}
          />
        </div>
        <div className="w-44">
          <Input
            label=""
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder={t("reports.activity.dateFrom")}
          />
        </div>
        <div className="w-44">
          <Input
            label=""
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder={t("reports.activity.dateTo")}
          />
        </div>
      </div>

      {/* Error State */}
      {query.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("common.error")}
        </div>
      )}

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <StatCard
            label={t("reports.activity.totalActiveUsers")}
            value={data.total_active_users}
            icon={<UsersIcon className="h-5 w-5" />}
          />
          <StatCard
            label={t("reports.activity.avgProcessingDaysOverall")}
            value={avgProcessingDays ? `${avgProcessingDays}d` : "-"}
            icon={<ClockIcon className="h-5 w-5" />}
          />
        </div>
      )}

      {/* User Table */}
      <Card className="overflow-hidden">
        <DataTable<UserActivityUser>
          columns={columns}
          data={filteredUsers}
          loading={query.isLoading}
          emptyMessage={t("reports.activity.noUsers")}
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  );
}
