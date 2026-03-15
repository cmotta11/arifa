import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Input } from "@/components/ui/input";
import {
  usePortalServices,
  usePortalEntities,
  usePortalServiceCatalog,
  useCreatePortalServiceRequest,
  type PortalServiceRequest,
} from "../api/portal-api";

const serviceStatusColor: Record<string, "gray" | "blue" | "yellow" | "green"> = {
  draft: "gray",
  submitted: "blue",
  in_progress: "yellow",
  completed: "green",
};

export default function PortalServiceTrackingPage() {
  const { t } = useTranslation();
  const servicesQuery = usePortalServices();
  const [showCreateModal, setShowCreateModal] = useState(false);

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
          {t(`portal.services.statuses.${row.status}`, row.status)}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("portal.services.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("portal.services.description")}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          {t("portal.services.requestService")}
        </Button>
      </div>

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

      <CreateServiceRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}

function CreateServiceRequestModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const entitiesQuery = usePortalEntities();
  const catalogQuery = usePortalServiceCatalog();
  const createMut = useCreatePortalServiceRequest();

  const [selectedEntity, setSelectedEntity] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [notes, setNotes] = useState("");

  const entityOptions = (entitiesQuery.data?.results ?? []).map((e) => ({
    value: e.id,
    label: `${e.name} (${e.jurisdiction.toUpperCase()})`,
  }));

  const catalogOptions = (catalogQuery.data?.results ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} — ${s.base_price} ${s.currency}`,
  }));

  const handleSubmit = async () => {
    if (!selectedService) return;
    try {
      await createMut.mutateAsync({
        entity_id: selectedEntity || null,
        notes,
        service_ids: [selectedService],
      });
      setSelectedEntity("");
      setSelectedService("");
      setNotes("");
      onClose();
    } catch {
      // error handled by mutation state
    }
  };

  const handleClose = () => {
    if (!createMut.isPending) {
      setSelectedEntity("");
      setSelectedService("");
      setNotes("");
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("portal.services.requestService")}
      size="md"
    >
      <div className="space-y-4">
        <SearchableSelect
          label={t("portal.services.selectService")}
          options={catalogOptions}
          value={selectedService}
          onChange={setSelectedService}
          placeholder={t("portal.services.searchService")}
        />

        <SearchableSelect
          label={t("portal.services.selectEntity")}
          options={entityOptions}
          value={selectedEntity}
          onChange={setSelectedEntity}
          placeholder={t("portal.services.searchEntity")}
        />

        <Input
          label={t("portal.services.notes")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("portal.services.notesPlaceholder")}
        />

        {createMut.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {t("common.error")}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMut.isPending}
            disabled={!selectedService}
          >
            {t("portal.services.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
