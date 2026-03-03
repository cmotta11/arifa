import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/data-display/data-table";
import { RiskBadge } from "@/features/entities/components/risk-badge";
import {
  usePersonSourcesOfWealth,
  useCreateSourceOfWealth,
  useDeleteSourceOfWealth,
} from "../api/people-api";
import type { SourceOfWealth, RiskLevel } from "@/types";

interface SourceOfWealthTabProps {
  personId: string;
}

export function SourceOfWealthTab({ personId }: SourceOfWealthTabProps) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: "", risk_level: "low" as RiskLevel });

  const sowQuery = usePersonSourcesOfWealth(personId);
  const createMutation = useCreateSourceOfWealth();
  const deleteMutation = useDeleteSourceOfWealth();

  const sources = sowQuery.data?.results ?? [];

  const handleCreate = () => {
    createMutation.mutate(
      { person_id: personId, description: form.description, risk_level: form.risk_level },
      {
        onSuccess: () => {
          setShowModal(false);
          setForm({ description: "", risk_level: "low" });
        },
      },
    );
  };

  const columns = [
    {
      key: "description",
      header: t("people.sourcesOfWealth.description"),
      render: (row: SourceOfWealth) => <span className="font-medium">{row.description}</span>,
    },
    {
      key: "risk_level",
      header: t("people.sourcesOfWealth.riskLevel"),
      render: (row: SourceOfWealth) => <RiskBadge level={row.risk_level} />,
    },
    {
      key: "actions",
      header: "",
      render: (row: SourceOfWealth) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            deleteMutation.mutate(row.id);
          }}
          className="text-gray-400 hover:text-red-500"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t("people.sourcesOfWealth.title")}</h3>
        <Button size="sm" onClick={() => setShowModal(true)}>
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("people.sourcesOfWealth.add")}
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <DataTable
          columns={columns}
          data={sources as (SourceOfWealth & Record<string, unknown>)[]}
          loading={sowQuery.isLoading}
          emptyMessage={t("common.noResults")}
          keyExtractor={(row) => row.id as string}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("people.sourcesOfWealth.add")}</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("people.sourcesOfWealth.description")}
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <Select
                label={t("people.sourcesOfWealth.riskLevel")}
                value={form.risk_level}
                onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value as RiskLevel }))}
                options={[
                  { value: "low", label: t("riskLevels.low") },
                  { value: "medium", label: t("riskLevels.medium") },
                  { value: "high", label: t("riskLevels.high") },
                  { value: "ultra_high", label: t("riskLevels.ultraHigh") },
                ]}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!form.description}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
