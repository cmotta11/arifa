import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/overlay/modal";
import { DataTable } from "@/components/data-display/data-table";
import { useAuth } from "@/lib/auth/auth-context";
import {
  useESSubmissions,
  useCreateES,
  useBulkCreateES,
  type EconomicSubstanceSubmission,
} from "../api/es-api";

const CURRENT_YEAR = new Date().getFullYear();

const STATUS_FILTERS = ["all", "pending", "in_progress", "in_review", "completed"] as const;

const STATUS_COLORS: Record<string, "gray" | "yellow" | "blue" | "green"> = {
  pending: "gray",
  in_progress: "yellow",
  in_review: "blue",
  completed: "green",
};

export default function ESListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR - 1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEntity, setNewEntity] = useState("");
  const [newFiscalYear, setNewFiscalYear] = useState(CURRENT_YEAR - 1);

  // Build query params
  const params: Record<string, string> = {
    fiscal_year: String(fiscalYear),
  };
  if (statusFilter !== "all") {
    params.status = statusFilter;
  }

  const { data, isLoading } = useESSubmissions(params);
  const createMut = useCreateES();
  const bulkCreateMut = useBulkCreateES();

  const submissions = data?.results ?? [];

  const isDirector = user?.role === "director";

  // Entity options for the create modal — extracted from existing submissions
  // In a real scenario this would come from a separate entity list endpoint;
  // for now we provide a text input for the entity ID.

  const handleCreate = async () => {
    if (!newEntity.trim()) return;
    try {
      const created = await createMut.mutateAsync({
        entity: newEntity,
        fiscal_year: newFiscalYear,
      });
      setShowCreateModal(false);
      setNewEntity("");
      navigate(`/economic-substance/${created.id}`);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleBulkCreate = async () => {
    try {
      await bulkCreateMut.mutateAsync(fiscalYear);
    } catch {
      // Error handled by mutation state
    }
  };

  const columns = [
    {
      key: "entity_name",
      header: t("es.list.entity"),
      render: (row: EconomicSubstanceSubmission) => (
        <span className="font-medium text-gray-900">{row.entity_name}</span>
      ),
    },
    {
      key: "fiscal_year",
      header: t("es.list.fiscalYear"),
      render: (row: EconomicSubstanceSubmission) => (
        <span>{row.fiscal_year}</span>
      ),
    },
    {
      key: "status",
      header: t("es.list.status"),
      render: (row: EconomicSubstanceSubmission) => (
        <Badge color={STATUS_COLORS[row.status] ?? "gray"}>
          {t(`es.status.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: "current_step",
      header: t("es.list.currentStep"),
      render: (row: EconomicSubstanceSubmission) => (
        <span className="text-sm text-gray-500">
          {row.current_step ? t(`es.steps.${row.current_step}`, row.current_step) : "--"}
        </span>
      ),
    },
    {
      key: "submitted_at",
      header: t("es.list.submittedAt"),
      render: (row: EconomicSubstanceSubmission) =>
        row.submitted_at
          ? new Date(row.submitted_at).toLocaleDateString()
          : "--",
    },
    {
      key: "actions",
      header: "",
      render: (row: EconomicSubstanceSubmission) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/economic-substance/${row.id}`);
          }}
        >
          {t("common.view")}
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("es.title")}
        </h1>
        <div className="flex items-center gap-3">
          {/* Fiscal Year filter */}
          <Select
            value={String(fiscalYear)}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            options={[CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3].map((y) => ({
              value: String(y),
              label: `${t("es.list.fiscalYear")} ${y}`,
            }))}
          />

          {/* Bulk create — directors only */}
          {isDirector && (
            <Button
              variant="secondary"
              onClick={handleBulkCreate}
              loading={bulkCreateMut.isPending}
            >
              {t("es.list.bulkCreate")}
            </Button>
          )}

          {/* New Submission */}
          <Button onClick={() => setShowCreateModal(true)}>
            {t("es.list.newSubmission")}
          </Button>
        </div>
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
            {t(`es.status.${sf}`)}
          </button>
        ))}
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={submissions}
        loading={isLoading}
        emptyMessage={t("es.list.empty")}
        onRowClick={(row) =>
          navigate(`/economic-substance/${(row as unknown as EconomicSubstanceSubmission).id}`)
        }
        keyExtractor={(row) =>
          (row as unknown as EconomicSubstanceSubmission).id
        }
      />

      {/* Bulk create error */}
      {bulkCreateMut.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("es.list.bulkCreateError")}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t("es.list.createTitle")}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label={t("es.list.entityId")}
            value={newEntity}
            onChange={(e) => setNewEntity(e.target.value)}
            placeholder={t("es.list.entityIdPlaceholder")}
          />
          <Select
            label={t("es.list.fiscalYear")}
            value={String(newFiscalYear)}
            onChange={(e) => setNewFiscalYear(Number(e.target.value))}
            options={[CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3].map(
              (y) => ({
                value: String(y),
                label: String(y),
              }),
            )}
          />

          {createMut.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {t("common.error")}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMut.isPending}
              disabled={!newEntity.trim()}
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
