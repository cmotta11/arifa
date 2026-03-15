import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { StatCard } from "@/components/data-display/stat-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  BanknotesIcon,
  ReceiptPercentIcon,
  ScaleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { downloadCSV } from "@/lib/export";
import { getFinancialSummary } from "../api/reports-api";
import { useAuth } from "@/lib/auth/auth-context";
import { ROUTES } from "@/config/routes";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const BAR_COLORS = {
  revenue: "#3B82F6",
  expenses: "#EF4444",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FinancialDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [period, setPeriod] = useState("this_year");
  const [jurisdiction, setJurisdiction] = useState("");

  const periodOptions = useMemo(
    () => [
      { value: "this_month", label: t("reports.common.thisMonth") },
      { value: "this_quarter", label: t("reports.common.thisQuarter") },
      { value: "this_year", label: t("reports.common.thisYear") },
    ],
    [t],
  );

  const jurisdictionOptions = useMemo(
    () => [
      { value: "", label: t("reports.common.allJurisdictions") },
      { value: "BVI", label: "BVI" },
      { value: "Panama", label: t("reports.common.panama") },
      { value: "Belize", label: t("reports.common.belize") },
    ],
    [t],
  );

  const query = useQuery({
    queryKey: ["reports", "financial", period, jurisdiction],
    queryFn: () =>
      getFinancialSummary({
        period,
        jurisdiction: jurisdiction || undefined,
      }),
  });

  const data = query.data;

  // Monthly chart max
  const monthlyMax = useMemo(() => {
    if (!data?.by_month.length) return 1;
    return Math.max(
      ...data.by_month.map((m) => Math.max(m.revenue, m.expenses)),
      1,
    );
  }, [data]);

  // Jurisdiction chart max
  const jurisdictionMax = useMemo(() => {
    if (!data?.by_jurisdiction.length) return 1;
    return Math.max(
      ...data.by_jurisdiction.map((j) => Math.max(j.revenue, j.expenses)),
      1,
    );
  }, [data]);

  const handleExportCSV = () => {
    if (!data) return;
    const rows = data.by_month.map((m) => ({
      Month: m.month,
      Revenue: m.revenue,
      Expenses: m.expenses,
      "Net Income": m.revenue - m.expenses,
    }));
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(rows, `financial-summary-${date}.csv`);
  };

  const handlePrint = () => {
    window.print();
  };

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
          .print-only-show { display: block !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("reports.financial.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("reports.financial.description")}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
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
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={periodOptions}
          />
        </div>
        <div className="w-48">
          <Select
            label=""
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            options={jurisdictionOptions}
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("reports.financial.totalRevenue")}
              value={formatCurrency(data.total_revenue)}
              icon={<BanknotesIcon className="h-5 w-5" />}
            />
            <StatCard
              label={t("reports.financial.totalExpenses")}
              value={formatCurrency(data.total_expenses)}
              icon={<ReceiptPercentIcon className="h-5 w-5" />}
            />
            <StatCard
              label={t("reports.financial.netIncome")}
              value={formatCurrency(data.net_income)}
              icon={<ScaleIcon className="h-5 w-5" />}
            />
            <StatCard
              label={t("reports.financial.pendingInvoices")}
              value={`${data.pending_invoices} (${formatCurrency(data.pending_amount)})`}
              icon={<DocumentTextIcon className="h-5 w-5" />}
            />
          </div>

          {/* Revenue vs Expenses by Month */}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.financial.revenueVsExpenses")}</CardTitle>
            </CardHeader>
            {data.by_month.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                {t("reports.financial.noData")}
              </p>
            ) : (
              <div className="space-y-4">
                {data.by_month.map((m) => (
                  <div key={m.month}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {m.month}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t("reports.financial.revenueLabel")}:{" "}
                        {formatCurrency(m.revenue)} |{" "}
                        {t("reports.financial.expensesLabel")}:{" "}
                        {formatCurrency(m.expenses)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-4 w-full overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{
                            width: `${Math.max((m.revenue / monthlyMax) * 100, 1)}%`,
                            backgroundColor: BAR_COLORS.revenue,
                          }}
                        />
                      </div>
                      <div className="h-4 w-full overflow-hidden rounded bg-gray-100">
                        <div
                          className="h-full rounded transition-all duration-500"
                          style={{
                            width: `${Math.max((m.expenses / monthlyMax) * 100, 1)}%`,
                            backgroundColor: BAR_COLORS.expenses,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {/* Legend */}
                <div className="flex items-center gap-4 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span
                      className="inline-block h-3 w-3 rounded"
                      style={{ backgroundColor: BAR_COLORS.revenue }}
                    />
                    {t("reports.financial.revenueLabel")}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span
                      className="inline-block h-3 w-3 rounded"
                      style={{ backgroundColor: BAR_COLORS.expenses }}
                    />
                    {t("reports.financial.expensesLabel")}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Revenue by Jurisdiction */}
          <Card>
            <CardHeader>
              <CardTitle>
                {t("reports.financial.revenueByJurisdiction")}
              </CardTitle>
            </CardHeader>
            {data.by_jurisdiction.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                {t("reports.financial.noData")}
              </p>
            ) : (
              <div className="space-y-3">
                {data.by_jurisdiction.map((j) => (
                  <div key={j.jurisdiction}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {j.jurisdiction}
                      </span>
                      <span className="text-gray-500">
                        {formatCurrency(j.revenue)}
                      </span>
                    </div>
                    <div className="h-5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="flex h-full items-center rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max((j.revenue / jurisdictionMax) * 100, 2)}%`,
                          backgroundColor: BAR_COLORS.revenue,
                        }}
                      >
                        {(j.revenue / jurisdictionMax) * 100 > 15 && (
                          <span className="ml-2 text-xs font-medium text-white">
                            {formatCurrency(j.revenue)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
