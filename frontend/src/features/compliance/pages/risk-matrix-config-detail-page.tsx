import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import {
  useRiskMatrixConfig,
  useUpdateRiskMatrixConfig,
  useActivateRiskMatrixConfig,
} from "../api/risk-matrix-api";
import type { RiskFactorConfig, AutomaticTriggerRule } from "@/types";

export default function RiskMatrixConfigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const configQuery = useRiskMatrixConfig(id!);
  const updateMutation = useUpdateRiskMatrixConfig();
  const activateMutation = useActivateRiskMatrixConfig();

  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    high_risk_threshold: "",
    medium_risk_threshold: "",
    notes: "",
  });

  const config = configQuery.data;

  if (configQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-6">
        <p className="text-gray-500">{t("common.noResults")}</p>
      </div>
    );
  }

  const handleEdit = () => {
    setFormData({
      name: config.name,
      high_risk_threshold: String(config.high_risk_threshold),
      medium_risk_threshold: String(config.medium_risk_threshold),
      notes: config.notes || "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: id!,
        data: {
          name: formData.name,
          high_risk_threshold: Number(formData.high_risk_threshold),
          medium_risk_threshold: Number(formData.medium_risk_threshold),
          notes: formData.notes,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  const factors = config.factors ?? [];
  const entityFactors = factors.filter((f) => f.category === "entity");
  const personFactors = factors.filter((f) => f.category === "person");
  const triggerRules = config.trigger_rules ?? [];

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(ROUTES.RISK_MATRIX)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{config.name}</h1>
            <Badge color={config.is_active ? "green" : "gray"}>
              {config.is_active
                ? t("riskMatrix.config.active")
                : t("riskMatrix.config.inactive")}
            </Badge>
            <span className="text-sm text-gray-500">v{config.version}</span>
          </div>
          <div className="flex gap-2">
            {!config.is_active && (
              <Button
                variant="secondary"
                onClick={() => activateMutation.mutate(id!)}
                loading={activateMutation.isPending}
              >
                {t("riskMatrix.config.activate")}
              </Button>
            )}
            {editing ? (
              <>
                <Button variant="secondary" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} loading={updateMutation.isPending}>
                  {t("common.save")}
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={handleEdit}>
                {t("common.edit")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto">
        {/* Config Details */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("riskMatrix.config.details")}
          </h2>
          {editing ? (
            <div className="grid grid-cols-2 gap-4">
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
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("riskMatrix.config.notes")}
                </label>
                <textarea
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    {t("riskMatrix.config.scope")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {config.jurisdiction || t("riskMatrix.config.global")}
                    {config.entity_type && ` / ${config.entity_type}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    {t("riskMatrix.config.factors")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {factors.length} ({entityFactors.length}E / {personFactors.length}P)
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    {t("riskMatrix.config.triggerRules")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {triggerRules.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    {t("riskMatrix.config.version")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    v{config.version}
                  </p>
                </div>
              </div>

              {/* Threshold Visual Bar */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                  {t("riskMatrix.config.thresholds")}
                </p>
                <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="absolute inset-y-0 left-0 bg-green-200"
                    style={{ width: `${config.medium_risk_threshold}%` }}
                  />
                  <div
                    className="absolute inset-y-0 bg-yellow-200"
                    style={{
                      left: `${config.medium_risk_threshold}%`,
                      width: `${config.high_risk_threshold - config.medium_risk_threshold}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-red-200"
                    style={{ width: `${100 - config.high_risk_threshold}%` }}
                  />
                  {/* Threshold markers */}
                  <div
                    className="absolute inset-y-0 w-px bg-gray-600"
                    style={{ left: `${config.medium_risk_threshold}%` }}
                  />
                  <div
                    className="absolute inset-y-0 w-px bg-gray-600"
                    style={{ left: `${config.high_risk_threshold}%` }}
                  />
                  {/* Labels */}
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-green-800"
                    style={{ left: `${config.medium_risk_threshold / 2}%`, transform: "translate(-50%, -50%)" }}
                  >
                    Low
                  </span>
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-yellow-800"
                    style={{
                      left: `${config.medium_risk_threshold + (config.high_risk_threshold - config.medium_risk_threshold) / 2}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    Medium
                  </span>
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-red-800"
                    style={{
                      left: `${config.high_risk_threshold + (100 - config.high_risk_threshold) / 2}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    High
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                  <span>0</span>
                  <span>{config.medium_risk_threshold}</span>
                  <span>{config.high_risk_threshold}</span>
                  <span>100</span>
                </div>
              </div>

              {config.notes && (
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    {t("riskMatrix.config.notes")}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{config.notes}</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Entity Factors */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("riskMatrix.config.entityFactors")}
          </h2>
          <FactorTable factors={entityFactors} />
        </Card>

        {/* Person Factors */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("riskMatrix.config.personFactors")}
          </h2>
          <FactorTable factors={personFactors} />
        </Card>

        {/* Trigger Rules */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("riskMatrix.config.triggerRules")}
          </h2>
          <TriggerRulesTable rules={triggerRules} />
        </Card>
      </div>
    </div>
  );
}

function FactorTable({ factors }: { factors: RiskFactorConfig[] }) {
  const { t } = useTranslation();

  if (factors.length === 0) {
    return <p className="text-sm text-gray-500">{t("common.noResults")}</p>;
  }

  const totalWeight = factors.reduce((sum, f) => sum + f.max_score, 0);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.factor")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.config.maxScore")}
            </th>
            <th className="w-40 px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.config.weight")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.config.factorDescription")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {factors.map((f) => {
            const pct = totalWeight > 0 ? (f.max_score / totalWeight) * 100 : 0;
            return (
              <tr key={f.id}>
                <td className="whitespace-nowrap px-4 py-2 text-sm font-medium capitalize text-gray-900">
                  {f.code.replace(/_/g, " ")}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">{f.max_score}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">
                  {f.description || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50">
            <td className="px-4 py-2 text-sm font-semibold text-gray-900">
              {t("riskMatrix.config.total")}
            </td>
            <td className="px-4 py-2 text-sm font-semibold">{totalWeight}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function TriggerRulesTable({ rules }: { rules: AutomaticTriggerRule[] }) {
  const { t } = useTranslation();

  if (rules.length === 0) {
    return <p className="text-sm text-gray-500">{t("common.noResults")}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.config.condition")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.config.forcedLevel")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("tickets.status")}
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              {t("riskMatrix.config.factorDescription")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {rules.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium capitalize text-gray-900">
                {r.condition.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-2">
                <Badge
                  color={
                    r.forced_risk_level === "high"
                      ? "red"
                      : r.forced_risk_level === "medium"
                        ? "yellow"
                        : "green"
                  }
                >
                  {r.forced_risk_level.toUpperCase()}
                </Badge>
              </td>
              <td className="px-4 py-2">
                <Badge color={r.is_active ? "green" : "gray"}>
                  {r.is_active
                    ? t("riskMatrix.config.active")
                    : t("riskMatrix.config.inactive")}
                </Badge>
              </td>
              <td className="px-4 py-2 text-sm text-gray-500">
                {r.description || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
