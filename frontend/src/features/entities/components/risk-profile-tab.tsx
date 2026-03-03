import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";
import { DataTable } from "@/components/data-display/data-table";
import { CollapsibleSection } from "./collapsible-section";
import { RiskBadge } from "./risk-badge";
import {
  useEntityActivities,
  useActivityCatalog,
  useCreateEntityActivity,
  useDeleteEntityActivity,
  useEntitySourcesOfFunds,
  useSourceOfFundsCatalog,
  useCreateSourceOfFunds,
  useDeleteSourceOfFunds,
} from "../api/entities-api";
import { useJurisdictionRisks } from "@/features/admin/api/admin-api";
import type { EntityActivity, SourceOfFunds, RiskLevel } from "@/types";

interface RiskProfileTabProps {
  entityId: string;
}

// ---------------------------------------------------------------------------
// Activities Section
// ---------------------------------------------------------------------------

// Map JurisdictionRisk.risk_weight (1-10) to RiskLevel
function riskWeightToLevel(weight: number): RiskLevel {
  if (weight >= 8) return "ultra_high";
  if (weight >= 6) return "high";
  if (weight >= 4) return "medium";
  return "low";
}

function ActivitiesSection({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    activity_id: "",
    country_ids: [] as string[],
    description: "",
  });

  const activitiesQuery = useEntityActivities(entityId, expanded);
  const catalogQuery = useActivityCatalog();
  const createMutation = useCreateEntityActivity();
  const deleteMutation = useDeleteEntityActivity();
  const { data: jurisdictions } = useJurisdictionRisks();

  const activities = activitiesQuery.data?.results ?? [];
  const catalog = catalogQuery.data?.results ?? [];

  const jurisdictionOptions = useMemo(
    () =>
      (jurisdictions ?? []).map((j) => ({
        value: j.id,
        label: `${j.country_name} (${j.country_code})`,
      })),
    [jurisdictions],
  );

  // Compute country risk from selected jurisdictions
  const computedCountryRisk: RiskLevel = useMemo(() => {
    if (!form.country_ids.length || !jurisdictions) return "low";
    const selected = jurisdictions.filter((j) => form.country_ids.includes(j.id));
    const maxWeight = Math.max(...selected.map((j) => j.risk_weight), 1);
    return riskWeightToLevel(maxWeight);
  }, [form.country_ids, jurisdictions]);

  // Derive activity risk from the selected catalog entry
  const selectedActivity = useMemo(
    () => catalog.find((a) => a.id === form.activity_id) ?? null,
    [catalog, form.activity_id],
  );
  const activityRiskLevel: RiskLevel = selectedActivity?.default_risk_level ?? "low";

  const resetForm = () => {
    setShowModal(false);
    setForm({ activity_id: "", country_ids: [], description: "" });
  };

  const handleCreate = () => {
    createMutation.mutate(
      {
        entity_id: entityId,
        activity_id: form.activity_id,
        country_ids: form.country_ids,
        risk_level: activityRiskLevel,
        description: form.description,
      },
      { onSuccess: resetForm },
    );
  };

  const columns = [
    {
      key: "activity",
      header: t("entities.activities.activity"),
      render: (row: EntityActivity) => <span className="font-medium">{row.activity.name}</span>,
    },
    {
      key: "countries",
      header: t("entities.activities.countries"),
      render: (row: EntityActivity) =>
        row.countries.length > 0
          ? row.countries.map((c) => c.country_name).join(", ")
          : "—",
    },
    {
      key: "country_risk",
      header: t("entities.activities.countryRisk"),
      render: (row: EntityActivity) => <RiskBadge level={row.country_risk_level} />,
    },
    {
      key: "risk_level",
      header: t("entities.activities.riskLevel"),
      render: (row: EntityActivity) => <RiskBadge level={row.risk_level} />,
    },
    {
      key: "description",
      header: t("entities.activities.description"),
      render: (row: EntityActivity) => (
        <span className="max-w-xs truncate text-gray-500">{row.description || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row: EntityActivity) => (
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
    <CollapsibleSection
      title={t("entities.activities.title")}
      onToggle={setExpanded}
      action={
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            setShowModal(true);
          }}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("entities.activities.add")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={activities as (EntityActivity & Record<string, unknown>)[]}
        loading={activitiesQuery.isLoading}
        emptyMessage={t("common.noResults")}
        keyExtractor={(row) => row.id as string}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.activities.add")}</h3>
            <div className="space-y-4">
              <Select
                label={t("entities.activities.activity")}
                value={form.activity_id}
                onChange={(e) => setForm((f) => ({ ...f, activity_id: e.target.value }))}
                options={[
                  { value: "", label: t("entities.activities.selectActivity") },
                  ...catalog.map((a) => ({
                    value: a.id,
                    label: a.name,
                  })),
                ]}
              />

              {/* Auto-derived activity risk */}
              {selectedActivity && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{t("entities.activities.riskLevel")}:</span>
                  <RiskBadge level={activityRiskLevel} />
                </div>
              )}

              <SearchableMultiSelect
                label={t("entities.activities.countries")}
                value={form.country_ids}
                onChange={(vals) => setForm((f) => ({ ...f, country_ids: vals }))}
                options={jurisdictionOptions}
                placeholder={t("entities.activities.selectCountries")}
              />

              {/* Auto-computed country risk */}
              {form.country_ids.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{t("entities.activities.countryRisk")}:</span>
                  <RiskBadge level={computedCountryRisk} />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("entities.activities.description")}
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!form.activity_id || form.country_ids.length === 0}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Source of Funds Section
// ---------------------------------------------------------------------------

function SourceOfFundsSection({ entityId }: { entityId: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    source_id: "",
    country_ids: [] as string[],
    description: "",
  });

  const sofQuery = useEntitySourcesOfFunds(entityId, expanded);
  const catalogQuery = useSourceOfFundsCatalog();
  const createMutation = useCreateSourceOfFunds();
  const deleteMutation = useDeleteSourceOfFunds();
  const { data: jurisdictions } = useJurisdictionRisks();

  const sources = sofQuery.data?.results ?? [];
  const catalog = catalogQuery.data?.results ?? [];

  const jurisdictionOptions = useMemo(
    () =>
      (jurisdictions ?? []).map((j) => ({
        value: j.id,
        label: `${j.country_name} (${j.country_code})`,
      })),
    [jurisdictions],
  );

  // Compute country risk from selected jurisdictions
  const computedCountryRisk: RiskLevel = useMemo(() => {
    if (!form.country_ids.length || !jurisdictions) return "low";
    const selected = jurisdictions.filter((j) => form.country_ids.includes(j.id));
    const maxWeight = Math.max(...selected.map((j) => j.risk_weight), 1);
    return riskWeightToLevel(maxWeight);
  }, [form.country_ids, jurisdictions]);

  // Derive source risk from the selected catalog entry
  const selectedSource = useMemo(
    () => catalog.find((s) => s.id === form.source_id) ?? null,
    [catalog, form.source_id],
  );
  const sourceRiskLevel: RiskLevel = selectedSource?.default_risk_level ?? "low";

  const resetForm = () => {
    setShowModal(false);
    setForm({ source_id: "", country_ids: [], description: "" });
  };

  const handleCreate = () => {
    createMutation.mutate(
      {
        entity_id: entityId,
        source_id: form.source_id,
        country_ids: form.country_ids,
        risk_level: sourceRiskLevel,
        description: form.description,
      },
      { onSuccess: resetForm },
    );
  };

  const columns = [
    {
      key: "source",
      header: t("entities.sourcesOfFunds.source"),
      render: (row: SourceOfFunds) => <span className="font-medium">{row.source.name}</span>,
    },
    {
      key: "countries",
      header: t("entities.sourcesOfFunds.countries"),
      render: (row: SourceOfFunds) =>
        row.countries.length > 0
          ? row.countries.map((c) => c.country_name).join(", ")
          : "—",
    },
    {
      key: "country_risk",
      header: t("entities.sourcesOfFunds.countryRisk"),
      render: (row: SourceOfFunds) => <RiskBadge level={row.country_risk_level} />,
    },
    {
      key: "risk_level",
      header: t("entities.sourcesOfFunds.riskLevel"),
      render: (row: SourceOfFunds) => <RiskBadge level={row.risk_level} />,
    },
    {
      key: "description",
      header: t("entities.sourcesOfFunds.description"),
      render: (row: SourceOfFunds) => (
        <span className="max-w-xs truncate text-gray-500">{row.description || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row: SourceOfFunds) => (
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
    <CollapsibleSection
      title={t("entities.sourcesOfFunds.title")}
      onToggle={setExpanded}
      action={
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            setShowModal(true);
          }}
        >
          <PlusIcon className="mr-1 h-4 w-4" />
          {t("entities.sourcesOfFunds.add")}
        </Button>
      }
    >
      <DataTable
        columns={columns}
        data={sources as (SourceOfFunds & Record<string, unknown>)[]}
        loading={sofQuery.isLoading}
        emptyMessage={t("common.noResults")}
        keyExtractor={(row) => row.id as string}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{t("entities.sourcesOfFunds.add")}</h3>
            <div className="space-y-4">
              <Select
                label={t("entities.sourcesOfFunds.source")}
                value={form.source_id}
                onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
                options={[
                  { value: "", label: t("entities.sourcesOfFunds.selectSource") },
                  ...catalog.map((s) => ({
                    value: s.id,
                    label: s.name,
                  })),
                ]}
              />

              {/* Auto-derived source risk */}
              {selectedSource && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{t("entities.sourcesOfFunds.riskLevel")}:</span>
                  <RiskBadge level={sourceRiskLevel} />
                </div>
              )}

              <SearchableMultiSelect
                label={t("entities.sourcesOfFunds.countries")}
                value={form.country_ids}
                onChange={(vals) => setForm((f) => ({ ...f, country_ids: vals }))}
                options={jurisdictionOptions}
                placeholder={t("entities.sourcesOfFunds.selectCountries")}
              />

              {/* Auto-computed country risk */}
              {form.country_ids.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{t("entities.sourcesOfFunds.countryRisk")}:</span>
                  <RiskBadge level={computedCountryRisk} />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("entities.sourcesOfFunds.description")}
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={resetForm}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                loading={createMutation.isPending}
                disabled={!form.source_id || form.country_ids.length === 0}
              >
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RiskProfileTab({ entityId }: RiskProfileTabProps) {
  return (
    <div className="space-y-4">
      <ActivitiesSection entityId={entityId} />
      <SourceOfFundsSection entityId={entityId} />
    </div>
  );
}
