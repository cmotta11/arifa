import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/overlay/modal";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import {
  useJurisdictionConfigs,
  useJurisdictionRisks,
  useCreateJurisdictionConfig,
  useUpdateJurisdictionConfig,
  useDeleteJurisdictionConfig,
  type JurisdictionConfig,
} from "../api/admin-api";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const configSchema = z.object({
  jurisdiction_id: z.string().min(1, "Required"),
  inc_workflow: z.string().default(""),
  requires_notary: z.boolean().default(false),
  requires_registry: z.boolean().default(false),
  requires_nit_ruc: z.boolean().default(false),
  requires_rbuf: z.boolean().default(false),
  supports_digital_notary: z.boolean().default(false),
  ubo_threshold_percent: z.coerce.number().min(0).max(100).default(25),
  kyc_renewal_months: z.coerce.number().min(1).max(120).default(12),
  es_required: z.boolean().default(false),
  ar_required: z.boolean().default(false),
  exempted_available: z.boolean().default(false),
});

type ConfigForm = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JurisdictionConfigEditor() {
  const { t } = useTranslation();

  const configsQuery = useJurisdictionConfigs();
  const risksQuery = useJurisdictionRisks();
  const createConfig = useCreateJurisdictionConfig();
  const updateConfig = useUpdateJurisdictionConfig();
  const deleteConfig = useDeleteJurisdictionConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JurisdictionConfig | null>(null);
  const [deleting, setDeleting] = useState<JurisdictionConfig | null>(null);

  const form = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      jurisdiction_id: "",
      inc_workflow: "",
      requires_notary: false,
      requires_registry: false,
      requires_nit_ruc: false,
      requires_rbuf: false,
      supports_digital_notary: false,
      ubo_threshold_percent: 25,
      kyc_renewal_months: 12,
      es_required: false,
      ar_required: false,
      exempted_available: false,
    },
  });

  // Jurisdictions that already have configs (exclude from create dropdown)
  const configuredJurisdictionIds = new Set(
    (configsQuery.data ?? []).map((c) => c.jurisdiction),
  );

  const availableJurisdictions = (risksQuery.data ?? []).filter(
    (jr) => !configuredJurisdictionIds.has(jr.id) || editing?.jurisdiction === jr.id,
  );

  const openCreate = () => {
    form.reset({
      jurisdiction_id: "",
      inc_workflow: "",
      requires_notary: false,
      requires_registry: false,
      requires_nit_ruc: false,
      requires_rbuf: false,
      supports_digital_notary: false,
      ubo_threshold_percent: 25,
      kyc_renewal_months: 12,
      es_required: false,
      ar_required: false,
      exempted_available: false,
    });
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (config: JurisdictionConfig) => {
    form.reset({
      jurisdiction_id: config.jurisdiction,
      inc_workflow: config.inc_workflow,
      requires_notary: config.requires_notary,
      requires_registry: config.requires_registry,
      requires_nit_ruc: config.requires_nit_ruc,
      requires_rbuf: config.requires_rbuf,
      supports_digital_notary: config.supports_digital_notary,
      ubo_threshold_percent: config.ubo_threshold_percent,
      kyc_renewal_months: config.kyc_renewal_months,
      es_required: config.es_required,
      ar_required: config.ar_required,
      exempted_available: config.exempted_available,
    });
    setEditing(config);
    setModalOpen(true);
  };

  const handleSubmit = (data: ConfigForm) => {
    if (editing) {
      updateConfig.mutate(
        { id: editing.id, ...data },
        { onSuccess: () => { setModalOpen(false); setEditing(null); } },
      );
    } else {
      createConfig.mutate(data, {
        onSuccess: () => { setModalOpen(false); form.reset(); },
      });
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteConfig.mutate(deleting.id, {
      onSuccess: () => setDeleting(null),
    });
  };

  const configs = configsQuery.data ?? [];

  if (configsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t("admin.jurisdictionConfig.title", "Jurisdiction Configurations")}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t("admin.jurisdictionConfig.description", "Configure compliance requirements, workflow settings, and UBO thresholds per jurisdiction.")}
          </p>
        </div>
        <Button onClick={openCreate}>
          {t("admin.jurisdictionConfig.add", "Add Configuration")}
        </Button>
      </div>

      {/* Cards */}
      {configs.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">
            {t("admin.jurisdictionConfig.empty", "No jurisdiction configurations yet. Add one to get started.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {configs.map((config) => (
            <div
              key={config.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">
                    {config.jurisdiction_name}
                  </h4>
                  <span className="font-mono text-xs text-gray-500">
                    {config.jurisdiction_code}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(config)}>
                    {t("common.edit")}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleting(config)}>
                    {t("common.delete")}
                  </Button>
                </div>
              </div>

              {/* Workflow */}
              {config.inc_workflow && (
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">{t("admin.jurisdictionConfig.workflow", "Workflow")}:</span>{" "}
                  {config.inc_workflow}
                </p>
              )}

              {/* Requirements badges */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {config.requires_notary && (
                  <Badge color="blue">{t("admin.jurisdictionConfig.notary", "Notary")}</Badge>
                )}
                {config.requires_registry && (
                  <Badge color="blue">{t("admin.jurisdictionConfig.registry", "Registry")}</Badge>
                )}
                {config.requires_nit_ruc && (
                  <Badge color="blue">NIT/RUC</Badge>
                )}
                {config.requires_rbuf && (
                  <Badge color="blue">RBUF</Badge>
                )}
                {config.supports_digital_notary && (
                  <Badge color="green">{t("admin.jurisdictionConfig.digitalNotary", "Digital Notary")}</Badge>
                )}
                {config.es_required && (
                  <Badge color="yellow">{t("admin.jurisdictionConfig.esRequired", "ES Required")}</Badge>
                )}
                {config.ar_required && (
                  <Badge color="yellow">{t("admin.jurisdictionConfig.arRequired", "AR Required")}</Badge>
                )}
                {config.exempted_available && (
                  <Badge color="gray">{t("admin.jurisdictionConfig.exempted", "Exempted")}</Badge>
                )}
              </div>

              {/* Thresholds */}
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">UBO:</span> {config.ubo_threshold_percent}%
                </div>
                <div>
                  <span className="font-medium">KYC Renewal:</span> {config.kyc_renewal_months}mo
                </div>
              </div>

              {/* Entity types */}
              {config.entity_types.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  {config.entity_types.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        title={
          editing
            ? t("admin.jurisdictionConfig.edit", "Edit Configuration")
            : t("admin.jurisdictionConfig.add", "Add Configuration")
        }
        size="lg"
      >
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Jurisdiction Select */}
          <FormField
            label={t("admin.jurisdictionConfig.jurisdiction", "Jurisdiction")}
            error={form.formState.errors.jurisdiction_id?.message}
            required
          >
            <Select
              {...form.register("jurisdiction_id")}
              error={form.formState.errors.jurisdiction_id?.message}
            >
              <option value="">{t("common.select", "Select...")}</option>
              {availableJurisdictions.map((jr) => (
                <option key={jr.id} value={jr.id}>
                  {jr.country_name} ({jr.country_code})
                </option>
              ))}
            </Select>
          </FormField>

          {/* Workflow */}
          <FormField
            label={t("admin.jurisdictionConfig.workflow", "Workflow")}
            error={form.formState.errors.inc_workflow?.message}
          >
            <Input
              placeholder="INC_PANAMA"
              {...form.register("inc_workflow")}
              error={form.formState.errors.inc_workflow?.message}
            />
          </FormField>

          {/* Thresholds */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t("admin.jurisdictionConfig.uboThreshold", "UBO Threshold %")}
              error={form.formState.errors.ubo_threshold_percent?.message}
            >
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                {...form.register("ubo_threshold_percent")}
                error={form.formState.errors.ubo_threshold_percent?.message}
              />
            </FormField>
            <FormField
              label={t("admin.jurisdictionConfig.kycRenewal", "KYC Renewal (months)")}
              error={form.formState.errors.kyc_renewal_months?.message}
            >
              <Input
                type="number"
                min={1}
                max={120}
                {...form.register("kyc_renewal_months")}
                error={form.formState.errors.kyc_renewal_months?.message}
              />
            </FormField>
          </div>

          {/* Boolean flags */}
          <div className="rounded-lg border border-gray-200 p-4">
            <h4 className="mb-3 text-sm font-medium text-gray-700">
              {t("admin.jurisdictionConfig.requirements", "Requirements")}
            </h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Checkbox
                label={t("admin.jurisdictionConfig.notary", "Notary")}
                {...form.register("requires_notary")}
              />
              <Checkbox
                label={t("admin.jurisdictionConfig.registry", "Registry")}
                {...form.register("requires_registry")}
              />
              <Checkbox
                label="NIT/RUC"
                {...form.register("requires_nit_ruc")}
              />
              <Checkbox
                label="RBUF"
                {...form.register("requires_rbuf")}
              />
              <Checkbox
                label={t("admin.jurisdictionConfig.digitalNotary", "Digital Notary")}
                {...form.register("supports_digital_notary")}
              />
              <Checkbox
                label={t("admin.jurisdictionConfig.esRequired", "ES Required")}
                {...form.register("es_required")}
              />
              <Checkbox
                label={t("admin.jurisdictionConfig.arRequired", "AR Required")}
                {...form.register("ar_required")}
              />
              <Checkbox
                label={t("admin.jurisdictionConfig.exempted", "Exempted")}
                {...form.register("exempted_available")}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => { setModalOpen(false); setEditing(null); }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={createConfig.isPending || updateConfig.isPending}
            >
              {editing ? t("common.save") : t("admin.jurisdictionConfig.add", "Add Configuration")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleting}
        title={t("admin.jurisdictionConfig.deleteTitle", "Delete Configuration")}
        message={t(
          "admin.jurisdictionConfig.deleteConfirm",
          { name: deleting?.jurisdiction_name ?? "" },
        )}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteConfig.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
