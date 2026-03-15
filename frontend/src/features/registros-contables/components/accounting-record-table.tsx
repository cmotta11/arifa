import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import { AccountingStatusBadge } from "./status-badge";
import type { AccountingRecord } from "../api/registros-contables-api";

interface AccountingRecordTableProps {
  records: AccountingRecord[];
  isLoading: boolean;
}

export function AccountingRecordTable({
  records,
  isLoading,
}: AccountingRecordTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">
        {t("common.noResults")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              {t("registrosContables.entity")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              {t("registrosContables.client")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              {t("registrosContables.formType")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              {t("registrosContables.status")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
              {t("registrosContables.submittedAt")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {records.map((rec) => (
            <tr
              key={rec.id}
              role="link"
              tabIndex={0}
              onClick={() =>
                navigate(ROUTES.REGISTROS_CONTABLES_DETAIL.replace(":id", rec.id))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(ROUTES.REGISTROS_CONTABLES_DETAIL.replace(":id", rec.id));
                }
              }}
              className="cursor-pointer hover:bg-gray-50 focus:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                {rec.entity_name}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {rec.client_name || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {rec.form_type_display || "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <AccountingStatusBadge status={rec.status} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                {rec.submitted_at
                  ? new Date(rec.submitted_at).toLocaleDateString()
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
