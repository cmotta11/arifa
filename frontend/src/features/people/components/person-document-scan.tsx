import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FileDropzone } from "@/components/forms/file-dropzone";
import { ExtractionPreview } from "@/features/documents/components/extraction-preview";
import { useExtractDocument } from "@/features/documents/api/documents-api";
import type { DocumentUpload } from "@/types";
import type { JurisdictionRisk } from "@/features/admin/api/admin-api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PersonFormData {
  full_name?: string;
  date_of_birth?: string;
  nationality_id?: string;
  country_of_residence_id?: string;
  identification_number?: string;
  identification_type?: string;
}

interface PersonDocumentScanProps {
  jurisdictions: JurisdictionRisk[] | undefined;
  onApply: (data: PersonFormData) => void;
  className?: string;
}

type ScanDocType = Extract<
  DocumentUpload["document_type"],
  "passport" | "cedula"
>;

const SCAN_DOC_TYPES: Array<{ value: ScanDocType; label: string }> = [
  { value: "passport", label: "documents.types.passport" },
  { value: "cedula", label: "documents.types.cedula" },
];

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ──────────────────────────────────────────────────────────────

export function PersonDocumentScan({
  jurisdictions,
  onApply,
  className = "",
}: PersonDocumentScanProps) {
  const { t } = useTranslation();

  const [expanded, setExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<ScanDocType>("passport");
  const [taskId, setTaskId] = useState<string | null>(null);

  const extractMutation = useExtractDocument();

  const reset = () => {
    setFile(null);
    setTaskId(null);
    setExpanded(false);
  };

  const handleFileDrop = (files: File[]) => {
    if (files.length > 0) setFile(files[0]);
  };

  const handleExtract = async () => {
    if (!file) return;
    try {
      const result = await extractMutation.mutateAsync({
        file,
        documentType: docType,
      });
      setTaskId(result.task_id);
    } catch {
      // Error state handled by extractMutation
    }
  };

  const resolveNationalityId = useCallback(
    (text: unknown): string | undefined => {
      if (!text || typeof text !== "string" || !jurisdictions) return undefined;
      const upper = text.trim().toUpperCase();
      const lower = text.trim().toLowerCase();
      // Try exact code match
      const byCode = jurisdictions.find(
        (j) => j.country_code.toUpperCase() === upper,
      );
      if (byCode) return byCode.id;
      // Try 3-char code
      const byCode3 = jurisdictions.find(
        (j) => j.country_code.toUpperCase() === upper.slice(0, 3),
      );
      if (byCode3) return byCode3.id;
      // Try name match (contains)
      const byName = jurisdictions.find(
        (j) => j.country_name.toLowerCase() === lower,
      );
      if (byName) return byName.id;
      // Try partial name match
      const byPartial = jurisdictions.find(
        (j) =>
          j.country_name.toLowerCase().includes(lower) ||
          lower.includes(j.country_name.toLowerCase()),
      );
      if (byPartial) return byPartial.id;
      return undefined;
    },
    [jurisdictions],
  );

  const handleApplyExtraction = useCallback(
    (extractedData: Record<string, unknown>) => {
      const mapped: PersonFormData = {};

      if (extractedData.full_name) {
        mapped.full_name = String(extractedData.full_name);
      }
      if (extractedData.date_of_birth) {
        mapped.date_of_birth = String(extractedData.date_of_birth);
      }

      // Map nationality text → JurisdictionRisk ID
      const natId = resolveNationalityId(extractedData.nationality);
      if (natId) {
        mapped.nationality_id = natId;
      }

      // Map issuing_country → country_of_residence as a reasonable default
      const corId = resolveNationalityId(extractedData.issuing_country);
      if (corId) {
        mapped.country_of_residence_id = corId;
      }

      // Map ID number based on document type
      if (docType === "passport" && extractedData.passport_number) {
        mapped.identification_number = String(extractedData.passport_number);
        mapped.identification_type = "passport";
      } else if (docType === "cedula" && extractedData.cedula_number) {
        mapped.identification_number = String(extractedData.cedula_number);
        mapped.identification_type = "cedula";
      }

      onApply(mapped);
      reset();
    },
    [docType, onApply, resolveNationalityId],
  );

  if (!expanded) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setExpanded(true)}
        className={className}
      >
        <DocumentTextIcon className="mr-1 h-4 w-4" />
        {t("people.form.scanDocument")}
      </Button>
    );
  }

  return (
    <div
      className={`rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          {t("people.form.scanDocument")}
        </h4>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          {t("common.cancel")}
        </button>
      </div>

      {!taskId ? (
        <>
          <Select
            label={t("documents.upload.documentType")}
            options={SCAN_DOC_TYPES.map((o) => ({
              value: o.value,
              label: t(o.label),
            }))}
            value={docType}
            onChange={(e) => setDocType(e.target.value as ScanDocType)}
          />

          {!file ? (
            <FileDropzone
              onDrop={handleFileDrop}
              accept={ACCEPTED_FILE_TYPES}
              maxSize={MAX_FILE_SIZE}
              label={t("people.form.scanDropzone")}
            />
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="truncate text-sm text-gray-700">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="ml-2 text-xs text-gray-400 hover:text-gray-600"
              >
                {t("common.remove")}
              </button>
            </div>
          )}

          {extractMutation.isError && (
            <p className="text-xs text-red-600">
              {t("documents.upload.extractionError")}
            </p>
          )}

          <Button
            size="sm"
            onClick={handleExtract}
            disabled={!file || extractMutation.isPending}
            loading={extractMutation.isPending}
          >
            {t("people.form.extractData")}
          </Button>
        </>
      ) : (
        <ExtractionPreview
          taskId={taskId}
          documentType={docType}
          onApply={handleApplyExtraction}
          onDismiss={reset}
          onRetry={() => {
            setTaskId(null);
          }}
        />
      )}
    </div>
  );
}
