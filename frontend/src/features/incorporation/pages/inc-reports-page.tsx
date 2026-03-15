import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/data-display/stat-card";
import { DataTable } from "@/components/data-display/data-table";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/navigation/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  BuildingOfficeIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { downloadCSV } from "@/lib/export";
import {
  getIncMetrics,
  getCommissionReport,
  getExpenseReport,
  type CommissionRecord,
  type ExpenseRecord,
} from "../api/incorporation-api";
import { StageDistributionChart } from "../components/stage-distribution-chart";

const EXPENSE_CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "registry", label: "Registry Fees" },
  { value: "notary", label: "Notary Fees" },
  { value: "legal", label: "Legal Fees" },
  { value: "government", label: "Government Fees" },
  { value: "other", label: "Other" },
];

export default function IncReportsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("");

  const tabs = useMemo(
    () => [
      { key: "overview", label: t("incorporation.reports.tabs.overview") },
      { key: "commissions", label: t("incorporation.reports.tabs.commissions") },
      { key: "expenses", label: t("incorporation.reports.tabs.expenses") },
    ],
    [t],
  );

  const metricsQuery = useQuery({
    queryKey: ["inc-metrics"],
    queryFn: getIncMetrics,
  });

  const commissionsQuery = useQuery({
    queryKey: ["inc-commissions"],
    queryFn: () => getCommissionReport(),
    enabled: activeTab === "commissions",
  });

  const expensesQuery = useQuery({
    queryKey: ["inc-expenses", expenseCategoryFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (expenseCategoryFilter) params.category = expenseCategoryFilter;
      return getExpenseReport(params);
    },
    enabled: activeTab === "expenses",
  });

  const metrics = metricsQuery.data;
  const commissions = commissionsQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  // Commission columns
  const commissionColumns = useMemo(
    () => [
      {
        key: "entity_name",
        header: t("incorporation.reports.commissions.entity"),
        render: (row: CommissionRecord) => (
          <span className="font-medium text-gray-900">{row.entity_name}</span>
        ),
      },
      {
        key: "registry_date",
        header: t("incorporation.reports.commissions.registryDate"),
        render: (row: CommissionRecord) =>
          row.registry_date
            ? new Date(row.registry_date).toLocaleDateString()
            : "-",
      },
      {
        key: "commission_amount",
        header: t("incorporation.reports.commissions.commissionAmount"),
        render: (row: CommissionRecord) => (
          <span className="font-medium">
            ${parseFloat(row.commission_amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "status",
        header: t("incorporation.reports.commissions.status"),
        render: (row: CommissionRecord) => (
          <Badge color={row.status === "paid" ? "green" : "yellow"}>
            {row.status}
          </Badge>
        ),
      },
    ],
    [t],
  );

  // Expense columns
  const expenseColumns = useMemo(
    () => [
      {
        key: "entity_name",
        header: t("incorporation.reports.expenses.entity"),
        render: (row: ExpenseRecord) => (
          <span className="font-medium text-gray-900">{row.entity_name}</span>
        ),
      },
      {
        key: "category",
        header: t("incorporation.reports.expenses.category"),
        render: (row: ExpenseRecord) => (
          <Badge color="blue">
            {t(`incorporation.reports.expenses.categories.${row.category}`, row.category)}
          </Badge>
        ),
      },
      {
        key: "amount",
        header: t("incorporation.reports.expenses.amount"),
        render: (row: ExpenseRecord) => (
          <span className="font-medium">
            ${parseFloat(row.amount).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "status",
        header: t("incorporation.reports.expenses.status"),
        render: (row: ExpenseRecord) => (
          <Badge color={row.status === "paid" ? "green" : "yellow"}>
            {row.status}
          </Badge>
        ),
      },
    ],
    [t],
  );

  // Totals
  const commissionTotal = commissions.reduce(
    (sum, r) => sum + parseFloat(r.commission_amount || "0"),
    0,
  );
  const expenseTotal = expenses.reduce(
    (sum, r) => sum + parseFloat(r.amount || "0"),
    0,
  );

  const handleExportCommissions = () => {
    downloadCSV(
      commissions.map((r) => ({
        Entity: r.entity_name,
        "Registry Date": r.registry_date,
        "Commission Amount": r.commission_amount,
        Status: r.status,
      })),
      "inc-commissions-report.csv",
    );
  };

  const handleExportExpenses = () => {
    downloadCSV(
      expenses.map((r) => ({
        Entity: r.entity_name,
        Category: r.category,
        Amount: r.amount,
        Status: r.status,
      })),
      "inc-expenses-report.csv",
    );
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
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {t("incorporation.reports.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("incorporation.reports.description")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              label={t("incorporation.stats.avgProcessingDays")}
              value={
                metrics?.avg_processing_days != null
                  ? `${metrics.avg_processing_days.toFixed(1)}d`
                  : "-"
              }
              icon={<ClockIcon className="h-5 w-5" />}
            />
          </div>

          {/* Stage Distribution Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{t("incorporation.chart.title")}</CardTitle>
            </CardHeader>
            <StageDistributionChart data={metrics?.by_stage ?? {}} />
          </Card>
        </div>
      )}

      {/* Commission Report Tab */}
      {activeTab === "commissions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("incorporation.reports.tabs.commissions")}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCommissions}
              disabled={commissions.length === 0}
            >
              {t("common.exportCSV")}
            </Button>
          </div>

          <Card>
            <DataTable
              columns={commissionColumns}
              data={commissions}
              loading={commissionsQuery.isLoading}
              emptyMessage={t("incorporation.reports.commissions.noData")}
              keyExtractor={(_: unknown, i: number) => String(i)}
            />

            {commissions.length > 0 && (
              <div className="border-t border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-gray-700">
                    {t("incorporation.reports.commissions.total")}
                  </span>
                  <span className="text-gray-900">
                    ${commissionTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Expense Report Tab */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("incorporation.reports.tabs.expenses")}
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-48">
                <Select
                  options={EXPENSE_CATEGORY_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.value
                      ? t(`incorporation.reports.expenses.categories.${o.value}`, o.label)
                      : t("incorporation.reports.expenses.allCategories"),
                  }))}
                  value={expenseCategoryFilter}
                  onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportExpenses}
                disabled={expenses.length === 0}
              >
                {t("common.exportCSV")}
              </Button>
            </div>
          </div>

          <Card>
            <DataTable
              columns={expenseColumns}
              data={expenses}
              loading={expensesQuery.isLoading}
              emptyMessage={t("incorporation.reports.expenses.noData")}
              keyExtractor={(_: unknown, i: number) => String(i)}
            />

            {expenses.length > 0 && (
              <div className="border-t border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="text-gray-700">
                    {t("incorporation.reports.expenses.total")}
                  </span>
                  <span className="text-gray-900">
                    ${expenseTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
