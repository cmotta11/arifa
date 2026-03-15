import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { Tabs } from "@/components/navigation/tabs";
import { Modal } from "@/components/overlay/modal";
import type { Ticket } from "@/types";
import {
  fetchArchiveEntries,
  updateArchiveEntry,
} from "../api/courier-api";
import { CourierTracking } from "../components/courier-tracking";
import { BatchDispatchReport } from "../components/batch-dispatch-report";

type CourierStatus = "pending_archive" | "dispatched" | "delivered" | "filed";

const statusColorMap: Record<CourierStatus, "gray" | "blue" | "yellow" | "green"> = {
  pending_archive: "gray",
  dispatched: "blue",
  delivered: "yellow",
  filed: "green",
};

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

function normalizeStatus(name: string): CourierStatus {
  return (name || "pending_archive").toLowerCase().replace(/\s+/g, "_") as CourierStatus;
}

export default function CourierArchivePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("archive");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const [editTracking, setEditTracking] = useState("");
  const [editDispatchDate, setEditDispatchDate] = useState("");
  const [editCourierService, setEditCourierService] = useState("");

  const tabs = [
    { key: "archive", label: t("courier.tabs.archive") },
    { key: "dispatchReport", label: t("courier.tabs.dispatchReport") },
  ];

  const archiveQuery = useQuery({
    queryKey: ["courier", "archive"],
    queryFn: () => fetchArchiveEntries(),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; metadata: Record<string, unknown> }) =>
      updateArchiveEntry(data.id, { metadata: data.metadata }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courier", "archive"] });
      setSelectedTicket(null);
    },
  });

  const openTrackingModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setEditTracking(getMetaField(ticket, "tracking_number"));
    setEditDispatchDate(getMetaField(ticket, "dispatch_date"));
    setEditCourierService(getMetaField(ticket, "courier_service"));
  };

  const handleSaveTracking = () => {
    if (!selectedTicket) return;
    updateMutation.mutate({
      id: selectedTicket.id,
      metadata: {
        ...selectedTicket.metadata,
        tracking_number: editTracking,
        dispatch_date: editDispatchDate,
        courier_service: editCourierService,
      },
    });
  };

  const columns = useMemo(
    () => [
      {
        key: "entity",
        header: t("courier.columns.entity"),
        render: (row: Ticket) => (
          <span className="font-medium text-gray-900">
            {row.entity?.name ?? row.title}
          </span>
        ),
      },
      {
        key: "status",
        header: t("courier.columns.status"),
        render: (row: Ticket) => {
          const status = normalizeStatus(row.current_state.name);
          return (
            <Badge color={statusColorMap[status] ?? "gray"}>
              {t(`courier.statuses.${status}`, { defaultValue: row.current_state.name })}
            </Badge>
          );
        },
      },
      {
        key: "tracking",
        header: t("courier.columns.tracking"),
        render: (row: Ticket) => {
          const val = getMetaField(row, "tracking_number");
          return val ? (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono">
              {val}
            </code>
          ) : (
            <span className="text-gray-400">--</span>
          );
        },
      },
      {
        key: "courier",
        header: t("courier.columns.courier"),
        render: (row: Ticket) => getMetaField(row, "courier_service") || "--",
      },
      {
        key: "dispatchDate",
        header: t("courier.columns.dispatchDate"),
        render: (row: Ticket) =>
          formatDate(getMetaField(row, "dispatch_date") || null),
      },
      {
        key: "actions",
        header: t("courier.columns.actions"),
        render: (row: Ticket) => (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openTrackingModal(row);
            }}
          >
            {t("common.edit")}
          </Button>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        {t("courier.title")}
      </h1>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "archive" && (
          <>
            {archiveQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <DataTable
                  columns={columns}
                  data={archiveQuery.data ?? []}
                  emptyMessage={t("courier.empty")}
                  keyExtractor={(row) => row.id}
                />
              </div>
            )}
          </>
        )}

        {activeTab === "dispatchReport" && <BatchDispatchReport />}
      </div>

      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.entity?.name ?? selectedTicket?.title ?? ""}
        size="md"
      >
        <div className="space-y-4">
          <CourierTracking
            trackingNumber={editTracking}
            dispatchDate={editDispatchDate}
            courierService={editCourierService}
            status={selectedTicket?.current_state.name ?? "pending_archive"}
            onTrackingNumberChange={setEditTracking}
            onDispatchDateChange={setEditDispatchDate}
            onCourierServiceChange={setEditCourierService}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setSelectedTicket(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveTracking}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
