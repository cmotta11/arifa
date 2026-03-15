import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { usePortalServices } from "../api/portal-api";
import type { PortalServiceRequest } from "../api/portal-api";

const serviceStatusColor: Record<string, "gray" | "blue" | "yellow" | "green"> = {
  draft: "gray",
  submitted: "blue",
  in_progress: "yellow",
  completed: "green",
};

export default function PortalServiceTrackingPage() {
  const { t } = useTranslation();
  const servicesQuery = usePortalServices();

  const services = servicesQuery.data?.results ?? [];

  const columns = [
    {
      key: "service_type",
      header: t("portal.services.serviceType"),
      render: (row: PortalServiceRequest) => (
        <span className="font-medium text-gray-900">{row.service_type}</span>
      ),
    },
    {
      key: "status",
      header: t("portal.services.status"),
      render: (row: PortalServiceRequest) => (
        <Badge color={serviceStatusColor[row.status] ?? "gray"}>
          {t(`portal.services.statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: "current_stage",
      header: t("portal.services.currentStage"),
      render: (row: PortalServiceRequest) => (
        <span className="text-gray-700">{row.current_stage ?? "-"}</span>
      ),
    },
    {
      key: "created_at",
      header: t("portal.services.created"),
      render: (row: PortalServiceRequest) =>
        new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "updated_at",
      header: t("portal.services.updated"),
      render: (row: PortalServiceRequest) =>
        new Date(row.updated_at).toLocaleDateString(),
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("portal.services.title")}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("portal.services.description")}
      </p>

      <div className="mt-6">
        {servicesQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {servicesQuery.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("common.error")}
          </div>
        )}

        {servicesQuery.data && (
          <DataTable
            columns={columns}
            data={services}
            emptyMessage={t("portal.services.empty")}
          />
        )}
      </div>
    </div>
  );
}
