import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-display/data-table";
import { EmptyState } from "@/components/data-display/empty-state";
import { Modal } from "@/components/overlay/modal";
import { FormField } from "@/components/forms/form-field";
import { FileDropzone } from "@/components/forms/file-dropzone";
import {
  useTemplates,
  useCreateTemplate,
  useToggleTemplate,
} from "@/features/documents/api/documents-api";
import type { TemplateFilters } from "@/features/documents/api/documents-api";
import type { DocumentTemplate } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────

const ENTITY_TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "Corporation", label: "Corporation" },
  { value: "Trust", label: "Trust" },
  { value: "Foundation", label: "Foundation" },
];

const JURISDICTION_OPTIONS = [
  { value: "", label: "All" },
  { value: "Panama", label: "Panama" },
  { value: "BVI", label: "BVI" },
  { value: "Belize", label: "Belize" },
];

const ACTIVE_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function TemplateManagement() {
  const { t } = useTranslation();

  // ── Filter state ───────────────────────────────────────────────────────
  const [filters, setFilters] = useState<TemplateFilters>({});

  // ── Modal state ────────────────────────────────────────────────────────
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEntityType, setUploadEntityType] = useState("");
  const [uploadJurisdiction, setUploadJurisdiction] = useState("");

  // ── Queries & mutations ────────────────────────────────────────────────
  const { data: templates = [], isLoading } = useTemplates(filters);
  const createTemplate = useCreateTemplate();
  const toggleTemplate = useToggleTemplate();

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleFilterChange = (key: keyof TemplateFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const handleOpenUpload = () => {
    setUploadName("");
    setUploadFile(null);
    setUploadEntityType("");
    setUploadJurisdiction("");
    setIsUploadOpen(true);
  };

  const handleUpload = () => {
    if (!uploadName || !uploadFile) return;

    createTemplate.mutate(
      {
        name: uploadName,
        file: uploadFile,
        entity_type: uploadEntityType,
        jurisdiction: uploadJurisdiction,
      },
      {
        onSuccess: () => {
          setIsUploadOpen(false);
        },
      },
    );
  };

  const handleToggle = (id: string) => {
    toggleTemplate.mutate(id);
  };

  // ── Table columns ──────────────────────────────────────────────────────

  const columns = [
    {
      key: "name",
      header: t("documents.templates.columns.name"),
      render: (row: DocumentTemplate) => (
        <span className="font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: "entity_type",
      header: t("documents.templates.columns.entityType"),
      render: (row: DocumentTemplate) => (
        <span>{row.entity_type || t("documents.templates.allTypes")}</span>
      ),
    },
    {
      key: "jurisdiction",
      header: t("documents.templates.columns.jurisdiction"),
      render: (row: DocumentTemplate) => (
        <span>{row.jurisdiction || t("documents.templates.allJurisdictions")}</span>
      ),
    },
    {
      key: "is_active",
      header: t("documents.templates.columns.status"),
      render: (row: DocumentTemplate) =>
        row.is_active ? (
          <Badge className="bg-green-50 text-green-700">
            {t("documents.templates.active")}
          </Badge>
        ) : (
          <Badge className="bg-gray-100 text-gray-500">
            {t("documents.templates.inactive")}
          </Badge>
        ),
    },
    {
      key: "created_at",
      header: t("documents.templates.columns.created"),
      render: (row: DocumentTemplate) => (
        <span className="text-gray-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("documents.templates.columns.actions"),
      render: (row: DocumentTemplate) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(row.id);
          }}
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          style={{
            backgroundColor: row.is_active ? "#047857" : "#d1d5db",
          }}
          role="switch"
          aria-checked={row.is_active}
          aria-label={
            row.is_active
              ? t("documents.templates.deactivate")
              : t("documents.templates.activate")
          }
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              row.is_active ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("documents.templates.title")}</CardTitle>
          <Button size="sm" onClick={handleOpenUpload}>
            {t("documents.templates.upload")}
          </Button>
        </CardHeader>

        {/* Filter row */}
        <div className="flex items-center gap-4 mb-4">
          <Select
            options={ENTITY_TYPE_OPTIONS}
            value={filters.entity_type || ""}
            onChange={(e) => handleFilterChange("entity_type", e.target.value)}
            placeholder={t("documents.templates.filterEntityType")}
          />
          <Select
            options={JURISDICTION_OPTIONS}
            value={filters.jurisdiction || ""}
            onChange={(e) => handleFilterChange("jurisdiction", e.target.value)}
            placeholder={t("documents.templates.filterJurisdiction")}
          />
          <Select
            options={ACTIVE_STATUS_OPTIONS}
            value={filters.is_active || ""}
            onChange={(e) => handleFilterChange("is_active", e.target.value)}
            placeholder={t("documents.templates.filterStatus")}
          />
        </div>

        {/* Table */}
        {!isLoading && templates.length === 0 ? (
          <EmptyState
            title={t("documents.templates.empty")}
            description={t("documents.templates.emptyDescription")}
            action={{
              label: t("documents.templates.upload"),
              onClick: handleOpenUpload,
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={templates}
            loading={isLoading}
            emptyMessage={t("documents.templates.empty")}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Upload Template Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title={t("documents.templates.uploadTitle")}
      >
        <div className="space-y-4">
          <FormField
            label={t("documents.templates.form.name")}
            required
            htmlFor="template-name"
          >
            <Input
              id="template-name"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder={t("documents.templates.form.namePlaceholder")}
            />
          </FormField>

          <FormField
            label={t("documents.templates.form.file")}
            required
            htmlFor="template-file"
          >
            <FileDropzone
              onDrop={(files) => setUploadFile(files[0] || null)}
              accept={{
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                  [".docx"],
              }}
              maxSize={10 * 1024 * 1024}
              label={t("documents.templates.form.dropzoneLabel")}
            />
            {uploadFile && (
              <p className="mt-2 text-sm text-gray-600">
                {t("documents.templates.form.selectedFile")}: {uploadFile.name}
              </p>
            )}
          </FormField>

          <FormField
            label={t("documents.templates.form.entityType")}
            htmlFor="template-entity-type"
          >
            <Select
              id="template-entity-type"
              options={ENTITY_TYPE_OPTIONS}
              value={uploadEntityType}
              onChange={(e) => setUploadEntityType(e.target.value)}
              placeholder={t("documents.templates.form.entityTypePlaceholder")}
            />
          </FormField>

          <FormField
            label={t("documents.templates.form.jurisdiction")}
            htmlFor="template-jurisdiction"
          >
            <Select
              id="template-jurisdiction"
              options={JURISDICTION_OPTIONS}
              value={uploadJurisdiction}
              onChange={(e) => setUploadJurisdiction(e.target.value)}
              placeholder={t("documents.templates.form.jurisdictionPlaceholder")}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsUploadOpen(false)}
              disabled={createTemplate.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleUpload}
              loading={createTemplate.isPending}
              disabled={!uploadName || !uploadFile}
            >
              {t("documents.templates.form.submit")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
