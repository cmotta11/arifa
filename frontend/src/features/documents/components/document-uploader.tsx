import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileDropzone } from "@/components/forms/file-dropzone";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useUploadDocument,
  useExtractDocument,
} from "@/features/documents/api/documents-api";
import type { DocumentUpload } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DocumentUploaderProps {
  kycId: string;
  parties?: Array<{ id: string; name: string }>;
  onUploadComplete?: (doc: DocumentUpload) => void;
  onExtractionStarted?: (taskId: string, file: File) => void;
  enableExtraction?: boolean;
  className?: string;
}

const DOCUMENT_TYPE_OPTIONS: Array<{
  value: DocumentUpload["document_type"];
  label: string;
}> = [
  { value: "passport", label: "documents.types.passport" },
  { value: "cedula", label: "documents.types.cedula" },
  { value: "utility_bill", label: "documents.types.utilityBill" },
  { value: "corporate_registry", label: "documents.types.corporateRegistry" },
  { value: "proof_of_address", label: "documents.types.proofOfAddress" },
  { value: "source_of_wealth", label: "documents.types.sourceOfWealth" },
  { value: "other", label: "documents.types.other" },
];

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Component ──────────────────────────────────────────────────────────────

export function DocumentUploader({
  kycId,
  parties = [],
  onUploadComplete,
  onExtractionStarted,
  enableExtraction = true,
  className = "",
}: DocumentUploaderProps) {
  const { t } = useTranslation();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] =
    useState<DocumentUpload["document_type"]>("passport");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [runExtraction, setRunExtraction] = useState(true);

  const uploadMutation = useUploadDocument();
  const extractMutation = useExtractDocument();

  const isUploading = uploadMutation.isPending || extractMutation.isPending;

  const handleFileDrop = (files: File[]) => {
    if (files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      const doc = await uploadMutation.mutateAsync({
        kycId,
        file: selectedFile,
        documentType,
        partyId: selectedPartyId || undefined,
      });

      onUploadComplete?.(doc);

      // Optionally trigger LLM extraction
      if (enableExtraction && runExtraction) {
        const result = await extractMutation.mutateAsync({
          file: selectedFile,
          documentType,
        });
        onExtractionStarted?.(result.task_id, selectedFile);
      }

      // Reset form after successful upload
      setSelectedFile(null);
      setSelectedPartyId("");
    } catch {
      // Error handling is managed by mutation state
    }
  };

  const translatedDocOptions = DOCUMENT_TYPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(opt.label),
  }));

  const partyOptions = parties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
    >
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        {t("documents.upload.title")}
      </h3>

      <div className="space-y-4">
        {/* File dropzone */}
        {!selectedFile ? (
          <FileDropzone
            onDrop={handleFileDrop}
            accept={ACCEPTED_FILE_TYPES}
            maxSize={MAX_FILE_SIZE}
            label={t("documents.upload.dropzoneLabel")}
          />
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <svg
                className="h-8 w-8 text-arifa-navy"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-500"
              aria-label={t("common.remove")}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Document type selector */}
        <FormField label={t("documents.upload.documentType")} required>
          <Select
            options={translatedDocOptions}
            value={documentType}
            onChange={(e) =>
              setDocumentType(
                e.target.value as DocumentUpload["document_type"],
              )
            }
          />
        </FormField>

        {/* Party association (optional) */}
        {parties.length > 0 && (
          <FormField label={t("documents.upload.associateParty")}>
            <Select
              options={[
                { value: "", label: t("documents.upload.noParty") },
                ...partyOptions,
              ]}
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
            />
          </FormField>
        )}

        {/* Extraction toggle */}
        {enableExtraction && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={runExtraction}
              onChange={(e) => setRunExtraction(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-arifa-navy focus:ring-arifa-navy"
            />
            {t("documents.upload.runExtraction")}
          </label>
        )}

        {/* Error messages */}
        {uploadMutation.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("documents.upload.uploadError")}
          </div>
        )}
        {extractMutation.isError && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
            {t("documents.upload.extractionError")}
          </div>
        )}

        {/* Upload status */}
        {uploadMutation.isSuccess && !extractMutation.isPending && (
          <div className="flex items-center gap-2">
            <Badge color="green">{t("documents.upload.uploadSuccess")}</Badge>
          </div>
        )}

        {/* Upload button */}
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          loading={isUploading}
          className="w-full"
        >
          {isUploading
            ? t("documents.upload.uploading")
            : t("documents.upload.uploadButton")}
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
