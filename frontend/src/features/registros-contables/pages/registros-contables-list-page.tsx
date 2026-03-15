import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AccountingRecordTable } from "../components/accounting-record-table";
import { BulkSendButton } from "../components/bulk-send-button";
import {
  useAccountingRecords,
  useAccountingRecordSummary,
} from "../api/registros-contables-api";

const CURRENT_YEAR = new Date().getFullYear();
const STATUS_FILTERS = ["all", "pending", "draft", "submitted", "approved", "rejected"];

export default function RegistrosContablesListPage() {
  const { t } = useTranslation();
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR - 1);
  const [statusFilter, setStatusFilter] = useState("all");

  const params: Record<string, string> = {
    fiscal_year: String(fiscalYear),
  };
  if (statusFilter !== "all") {
    params.status = statusFilter;
  }

  const { data: recordsData, isLoading } = useAccountingRecords(params);
  const { data: summary } = useAccountingRecordSummary(fiscalYear);

  const records = recordsData?.results ?? [];

  const statCards = [
    { key: "total", value: summary?.total ?? 0, color: "bg-gray-100 text-gray-700" },
    { key: "pending", value: summary?.pending ?? 0, color: "bg-gray-100 text-gray-500" },
    { key: "draft", value: summary?.draft ?? 0, color: "bg-yellow-50 text-yellow-700" },
    { key: "submitted", value: summary?.submitted ?? 0, color: "bg-blue-50 text-blue-700" },
    { key: "approved", value: summary?.approved ?? 0, color: "bg-green-50 text-green-700" },
    { key: "rejected", value: summary?.rejected ?? 0, color: "bg-red-50 text-red-700" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("registrosContables.title")}
        </h1>
        <div className="flex items-center gap-4">
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {[CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3].map((y) => (
              <option key={y} value={y}>
                {t("registrosContables.fiscalYear")} {y}
              </option>
            ))}
          </select>
          <BulkSendButton fiscalYear={fiscalYear} />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <div
            key={s.key}
            className={`rounded-lg p-4 ${s.color}`}
          >
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium uppercase">
              {t(`registrosContables.status.${s.key}`)}
            </p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {STATUS_FILTERS.map((sf) => (
          <button
            key={sf}
            type="button"
            onClick={() => setStatusFilter(sf)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === sf
                ? "border-b-2 border-primary text-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`registrosContables.status.${sf}`)}
          </button>
        ))}
      </div>

      {/* Records table */}
      <AccountingRecordTable records={records} isLoading={isLoading} />
    </div>
  );
}
