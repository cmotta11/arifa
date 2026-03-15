import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { ROUTES } from "@/config/routes";
import {
  useRiskMatrixConfigs,
  useCreateRiskMatrixConfig,
  useDuplicateRiskMatrixConfig,
  useActivateRiskMatrixConfig,
} from "../api/risk-matrix-api";
import type { RiskMatrixConfig } from "@/types";

export default function RiskMatrixConfigPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const configsQuery = useRiskMatrixConfigs();
  const createMutation = useCreateRiskMatrixConfig();
  const duplicateMutation = useDuplicateRiskMatrixConfig();
  const activateMutation = useActivateRiskMatrixConfig();

  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    jurisdiction: "",
    entity_type: "",
    high_risk_threshold: "70",
    medium_risk_threshold: "40",
  });

  const configs = configsQuery.data?.results ?? [];

  const handleCreate = () => {
    createMutation.mutate(
      {
        name: formData.name,
        jurisdiction: formData.jurisdiction || undefined,
        entity_type: formData.entity_type || undefined,
        high_risk_threshold: Number(formData.high_risk_threshold),
        medium_risk_threshold: Number(formData.medium_risk_threshold),
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          setFormData({
            name: "",
            jurisdiction: "",
            entity_type: "",
            high_risk_threshold: "70",
            medium_risk_threshold: "40",
          });
        },
      },
    );
  };

  const columns = [
    {
      key: "name",
      header: t("riskMatrix.config.name"),
      render: (row: RiskMatrixConfig) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      key: "scope",
      header: t("riskMatrix.config.scope"),
      render: (row: RiskMatrixConfig) => (
        <span className="text-sm text-gray-500">
          {row.jurisdiction || t("riskMatrix.config.global")}
          {row.entity_type && ` / ${row.entity_type}`}
        </span>
      ),
    },
    {
      key: "version",
      header: t("riskMatrix.config.version"),
      render: (row: RiskMatrixConfig) => (
        <span className="text-sm">v{row.version}</span>
      ),
    },
    {
      key: "thresholds",
      header: t("riskMatrix.config.thresholds"),
      render: (row: RiskMatrixConfig) => (
        <span className="text-sm text-gray-500">
          H: {row.high_risk_threshold} / M: {row.medium_risk_threshold}
        </span>
      ),
    },
    {
      key: "factors",
      header: t("riskMatrix.config.factors"),
      render: (row: RiskMatrixConfig) => (
        <span className="text-sm">{row.factors?.length ?? 0}</span>
      ),
    },
    {
      key: "status",
      header: t("tickets.status"),
      render: (row: RiskMatrixConfig) => (
        <Badge color={row.is_active ? "green" : "gray"}>
          {row.is_active
            ? t("riskMatrix.config.active")
            : t("riskMatrix.config.inactive")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row: RiskMatrixConfig) => (
        <div className="flex gap-2">
          {!row.is_active && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                activateMutation.mutate(row.id);
              }}
              className="text-xs text-green-600 hover:underline"
            >
              {t("riskMatrix.config.activate")}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              duplicateMutation.mutate(row.id);
            }}
            className="text-xs text-primary hover:underline"
          >
            {t("riskMatrix.config.duplicate")}
          </button>
        </div>
      ),
    },
  ];

  if (configsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("riskMatrix.config.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("riskMatrix.config.description")}
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {configs.length} {t("riskMatrix.config.totalConfigs")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            {configs.filter((c) => c.is_active).length} {t("riskMatrix.config.active")}
          </span>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("riskMatrix.config.create")}
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={configs}
          loading={configsQuery.isLoading}
          emptyMessage={t("riskMatrix.config.noConfigs")}
          keyExtractor={(row) => row.id as string}
          onRowClick={(row) =>
            navigate(ROUTES.RISK_MATRIX_DETAIL.replace(":id", row.id as string))
          }
        />
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title={t("riskMatrix.config.create")}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("riskMatrix.config.name")}
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={formData.name}
              onChange={(e) =>
                setFormData((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("riskMatrix.config.jurisdiction")}
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("riskMatrix.config.global")}
              value={formData.jurisdiction}
              onChange={(e) =>
                setFormData((f) => ({ ...f, jurisdiction: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("riskMatrix.config.entityType")}
            </label>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("common.all")}
              value={formData.entity_type}
              onChange={(e) =>
                setFormData((f) => ({ ...f, entity_type: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("riskMatrix.config.highThreshold")}
              </label>
              <input
                type="number"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={formData.high_risk_threshold}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    high_risk_threshold: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("riskMatrix.config.mediumThreshold")}
              </label>
              <input
                type="number"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={formData.medium_risk_threshold}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    medium_risk_threshold: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowCreate(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            loading={createMutation.isPending}
            disabled={!formData.name}
          >
            {t("common.create")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
