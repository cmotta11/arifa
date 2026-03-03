import { useTranslation } from "react-i18next";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DocumentUpload } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractionPreviewProps {
  taskId: string | null;
  documentType: DocumentUpload["document_type"];
  onApply?: (extractedData: Record<string, unknown>) => void;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}

interface ExtractionFieldConfig {
  key: string;
  label: string;
}

// ─── Field Configurations Per Document Type ─────────────────────────────────

const EXTRACTION_FIELDS: Record<string, ExtractionFieldConfig[]> = {
  passport: [
    { key: "full_name", label: "extraction.fields.fullName" },
    { key: "date_of_birth", label: "extraction.fields.dateOfBirth" },
    { key: "nationality", label: "extraction.fields.nationality" },
    { key: "passport_number", label: "extraction.fields.passportNumber" },
    { key: "expiry_date", label: "extraction.fields.expiryDate" },
    { key: "mrz_data", label: "extraction.fields.mrzData" },
  ],
  cedula: [
    { key: "full_name", label: "extraction.fields.fullName" },
    { key: "cedula_number", label: "extraction.fields.cedulaNumber" },
    { key: "date_of_birth", label: "extraction.fields.dateOfBirth" },
    { key: "nationality", label: "extraction.fields.nationality" },
  ],
  utility_bill: [
    { key: "name", label: "extraction.fields.name" },
    { key: "address", label: "extraction.fields.address" },
    { key: "utility_provider", label: "extraction.fields.utilityProvider" },
    { key: "date", label: "extraction.fields.date" },
  ],
  corporate_registry: [
    { key: "entity_name", label: "extraction.fields.entityName" },
    { key: "registration_number", label: "extraction.fields.registrationNumber" },
    { key: "jurisdiction", label: "extraction.fields.jurisdiction" },
    { key: "directors", label: "extraction.fields.directors" },
    { key: "shareholders", label: "extraction.fields.shareholders" },
  ],
  proof_of_address: [
    { key: "name", label: "extraction.fields.name" },
    { key: "address", label: "extraction.fields.address" },
    { key: "date", label: "extraction.fields.date" },
  ],
  source_of_wealth: [
    { key: "name", label: "extraction.fields.name" },
    { key: "source_description", label: "extraction.fields.sourceDescription" },
    { key: "amount", label: "extraction.fields.amount" },
  ],
  other: [
    { key: "raw_text", label: "extraction.fields.rawText" },
  ],
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ExtractionPreview({
  taskId,
  documentType,
  onApply,
  onDismiss,
  onRetry,
  className = "",
}: ExtractionPreviewProps) {
  const { t } = useTranslation();
  const { status, data, isPolling, error } = useTaskPolling({
    taskId,
    enabled: !!taskId,
    interval: 2000,
  });

  const extractedData = data as Record<string, unknown> | null;
  const isMockData = extractedData?.is_mock === true;

  // ─── Loading / Processing State ─────────────────────────────────────────

  if (!taskId) return null;

  if (isPolling || status === "pending" || status === "running") {
    return (
      <div
        className={`rounded-lg border border-blue-200 bg-blue-50 p-6 ${className}`}
      >
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-blue-700">
            {t("extraction.processing")}
          </p>
          <p className="text-xs text-blue-500">
            {t("extraction.processingDescription")}
          </p>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────

  if (status === "failed" || error) {
    return (
      <div
        className={`rounded-lg border border-red-200 bg-red-50 p-6 ${className}`}
      >
        <div className="flex flex-col items-center gap-3 py-4">
          <svg
            className="h-10 w-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <p className="text-sm font-medium text-red-700">
            {t("extraction.failed")}
          </p>
          <p className="text-xs text-red-500">
            {error || t("extraction.failedDescription")}
          </p>
          {onRetry && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t("extraction.retry")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── Completed State ────────────────────────────────────────────────────

  if (status === "completed" && extractedData) {
    const fields = EXTRACTION_FIELDS[documentType] || EXTRACTION_FIELDS.other;

    return (
      <div
        className={`rounded-lg border border-green-200 bg-white p-6 shadow-sm ${className}`}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              {t("extraction.results")}
            </h4>
            <Badge color="green">{t("extraction.completed")}</Badge>
          </div>
        </div>

        {/* Mock data indicator */}
        {isMockData && (
          <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              <span className="text-xs font-medium text-yellow-800">
                {t("extraction.mockDataIndicator")}
              </span>
            </div>
          </div>
        )}

        {/* Extracted fields */}
        <div className="space-y-3">
          {fields.map((field) => {
            const value = extractedData[field.key];
            if (value === undefined || value === null) return null;

            return (
              <div
                key={field.key}
                className="flex items-start justify-between border-b border-gray-100 pb-2 last:border-0"
              >
                <span className="text-sm font-medium text-gray-500">
                  {t(field.label)}
                </span>
                <span className="ml-4 text-right text-sm text-gray-900">
                  {renderFieldValue(value)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t("extraction.dismiss")}
            </Button>
          )}
          {onApply && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApply(extractedData)}
            >
              {t("extraction.applyToForm")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderFieldValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}
