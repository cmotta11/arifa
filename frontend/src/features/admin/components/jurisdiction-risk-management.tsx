import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { FormField } from "@/components/forms/form-field";
import {
  useJurisdictionRisks,
  useCreateJurisdictionRisk,
  useUpdateJurisdictionRisk,
  useDeleteJurisdictionRisk,
  type JurisdictionRisk,
} from "../api/admin-api";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const jurisdictionRiskSchema = z.object({
  country_code: z
    .string()
    .min(2)
    .max(3)
    .transform((v) => v.toUpperCase()),
  country_name: z.string().min(1),
  risk_weight: z.coerce.number().min(1).max(10),
});

type JurisdictionRiskForm = z.infer<typeof jurisdictionRiskSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRiskColor(weight: number): string {
  if (weight <= 3) return "bg-green-500";
  if (weight <= 6) return "bg-yellow-500";
  return "bg-red-500";
}

function getRiskLevelLabel(weight: number): {
  label: string;
  className: string;
} {
  if (weight <= 3) {
    return {
      label: "Low",
      className: "bg-green-100 text-green-700",
    };
  }
  if (weight <= 6) {
    return {
      label: "Medium",
      className: "bg-yellow-100 text-yellow-700",
    };
  }
  return {
    label: "High",
    className: "bg-red-100 text-red-700",
  };
}

function RiskBar({ weight }: { weight: number }) {
  const color = getRiskColor(weight);
  const widthPercent = (weight / 10) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700">{weight}/10</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort modes
// ---------------------------------------------------------------------------

type SortMode = "risk_desc" | "name_asc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JurisdictionRiskManagement() {
  const { t } = useTranslation();

  // Queries & mutations
  const risksQuery = useJurisdictionRisks();
  const createRisk = useCreateJurisdictionRisk();
  const updateRisk = useUpdateJurisdictionRisk();
  const deleteRisk = useDeleteJurisdictionRisk();

  // Local state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("risk_desc");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<JurisdictionRisk | null>(null);
  const [deletingRisk, setDeletingRisk] = useState<JurisdictionRisk | null>(null);

  // Form
  const form = useForm<JurisdictionRiskForm>({
    resolver: zodResolver(jurisdictionRiskSchema),
    defaultValues: { country_code: "", country_name: "", risk_weight: 1 },
  });

  // Filtered + sorted data
  const filteredData = useMemo(() => {
    let data = risksQuery.data ?? [];

    // Filter by search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(
        (r) =>
          r.country_name.toLowerCase().includes(lower) ||
          r.country_code.toLowerCase().includes(lower),
      );
    }

    // Sort
    if (sortMode === "risk_desc") {
      data = [...data].sort((a, b) => b.risk_weight - a.risk_weight);
    } else {
      data = [...data].sort((a, b) =>
        a.country_name.localeCompare(b.country_name),
      );
    }

    return data;
  }, [risksQuery.data, searchTerm, sortMode]);

  // Handlers
  const openCreate = () => {
    form.reset({ country_code: "", country_name: "", risk_weight: 1 });
    setEditingRisk(null);
    setCreateModalOpen(true);
  };

  const openEdit = (risk: JurisdictionRisk) => {
    form.reset({
      country_code: risk.country_code,
      country_name: risk.country_name,
      risk_weight: risk.risk_weight,
    });
    setEditingRisk(risk);
    setCreateModalOpen(true);
  };

  const handleSubmit = (data: JurisdictionRiskForm) => {
    if (editingRisk) {
      updateRisk.mutate(
        { id: editingRisk.id, ...data },
        {
          onSuccess: () => {
            setCreateModalOpen(false);
            setEditingRisk(null);
          },
        },
      );
    } else {
      createRisk.mutate(data, {
        onSuccess: () => {
          setCreateModalOpen(false);
          form.reset();
        },
      });
    }
  };

  const handleDelete = () => {
    if (!deletingRisk) return;
    deleteRisk.mutate(deletingRisk.id, {
      onSuccess: () => setDeletingRisk(null),
    });
  };

  // Table columns
  const columns = [
    {
      key: "country_code",
      header: t("admin.jurisdiction.countryCode"),
      render: (row: Record<string, unknown>) => (
        <span className="font-mono text-sm font-semibold text-gray-900">
          {String(row.country_code ?? "")}
        </span>
      ),
    },
    {
      key: "country_name",
      header: t("admin.jurisdiction.countryName"),
      render: (row: Record<string, unknown>) => (
        <span className="font-medium text-gray-900">
          {String(row.country_name ?? "")}
        </span>
      ),
    },
    {
      key: "risk_weight",
      header: t("admin.jurisdiction.riskWeight"),
      render: (row: Record<string, unknown>) => (
        <RiskBar weight={row.risk_weight as number} />
      ),
    },
    {
      key: "risk_level",
      header: t("admin.jurisdiction.riskLevel"),
      render: (row: Record<string, unknown>) => {
        const weight = row.risk_weight as number;
        const { label, className } = getRiskLevelLabel(weight);
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: t("admin.jurisdiction.actions"),
      render: (row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row as unknown as JurisdictionRisk);
            }}
          >
            {t("common.edit")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingRisk(row as unknown as JurisdictionRisk);
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-64">
          <Input
            placeholder={t("admin.jurisdiction.searchCountry")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={sortMode === "risk_desc" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSortMode("risk_desc")}
          >
            {t("admin.jurisdiction.sortByRisk")}
          </Button>
          <Button
            variant={sortMode === "name_asc" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setSortMode("name_asc")}
          >
            {t("admin.jurisdiction.sortByName")}
          </Button>
        </div>
        <div className="ml-auto">
          <Button onClick={openCreate}>
            {t("admin.jurisdiction.addCountry")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={filteredData as unknown as Record<string, unknown>[]}
          loading={risksQuery.isLoading}
          emptyMessage={t("admin.jurisdiction.noCountries")}
          keyExtractor={(row) => String(row.id)}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingRisk(null);
        }}
        title={
          editingRisk
            ? t("admin.jurisdiction.editCountry")
            : t("admin.jurisdiction.addCountry")
        }
      >
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-4">
            <FormField
              label={t("admin.jurisdiction.countryCode")}
              error={form.formState.errors.country_code?.message}
              required
            >
              <Input
                maxLength={3}
                placeholder="BVI"
                {...form.register("country_code")}
                error={form.formState.errors.country_code?.message}
                className="uppercase"
              />
            </FormField>
            <div className="col-span-2">
              <FormField
                label={t("admin.jurisdiction.countryName")}
                error={form.formState.errors.country_name?.message}
                required
              >
                <Input
                  placeholder="British Virgin Islands"
                  {...form.register("country_name")}
                  error={form.formState.errors.country_name?.message}
                />
              </FormField>
            </div>
          </div>
          <FormField
            label={t("admin.jurisdiction.riskWeight")}
            error={form.formState.errors.risk_weight?.message}
            required
          >
            <div className="space-y-2">
              <Input
                type="number"
                min={1}
                max={10}
                {...form.register("risk_weight")}
                error={form.formState.errors.risk_weight?.message}
              />
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  1-3 {t("admin.jurisdiction.low")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                  4-6 {t("admin.jurisdiction.medium")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  7-10 {t("admin.jurisdiction.high")}
                </span>
              </div>
            </div>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingRisk(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={createRisk.isPending || updateRisk.isPending}
            >
              {editingRisk
                ? t("common.save")
                : t("admin.jurisdiction.addCountry")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingRisk}
        title={t("admin.jurisdiction.deleteCountry")}
        message={t("admin.jurisdiction.deleteConfirm", {
          name: deletingRisk?.country_name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteRisk.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeletingRisk(null)}
      />
    </div>
  );
}
