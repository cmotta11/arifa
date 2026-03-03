import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/data-display/empty-state";
import { Modal } from "@/components/overlay/modal";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import {
  useKYCDocuments,
  useDeleteDocument,
} from "@/features/documents/api/documents-api";
import { ExtractionPreview } from "./extraction-preview";
import type { DocumentUpload } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DocumentListProps {
  kycId: string;
  className?: string;
}

type BadgeColor = "gray" | "blue" | "green" | "red";

// ─── Helpers ────────────────────────────────────────────────────────────────

const EXTRACTION_STATUS_CONFIG: Record<
  DocumentUpload["llm_extraction_status"],
  { color: BadgeColor; labelKey: string; showSpinner: boolean }
> = {
  pending: {
    color: "gray",
    labelKey: "documents.extraction.pending",
    showSpinner: false,
  },
  processing: {
    color: "blue",
    labelKey: "documents.extraction.processing",
    showSpinner: true,
  },
  completed: {
    color: "green",
    labelKey: "documents.extraction.completed",
    showSpinner: false,
  },
  failed: {
    color: "red",
    labelKey: "documents.extraction.failed",
    showSpinner: false,
  },
};

const DOCUMENT_TYPE_LABELS: Record<DocumentUpload["document_type"], string> = {
  passport: "documents.types.passport",
  cedula: "documents.types.cedula",
  utility_bill: "documents.types.utilityBill",
  corporate_registry: "documents.types.corporateRegistry",
  proof_of_address: "documents.types.proofOfAddress",
  source_of_wealth: "documents.types.sourceOfWealth",
  other: "documents.types.other",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DocumentList({ kycId, className = "" }: DocumentListProps) {
  const { t } = useTranslation();
  const { data: documents, isLoading, isError, refetch } = useKYCDocuments(kycId);
  const deleteMutation = useDeleteDocument();

  const [selectedDoc, setSelectedDoc] = useState<DocumentUpload | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleDelete = () => {
    if (!deleteTargetId) return;
    deleteMutation.mutate(
      { documentId: deleteTargetId, kycId },
      {
        onSuccess: () => {
          setDeleteTargetId(null);
        },
      },
    );
  };

  const handleViewExtraction = (doc: DocumentUpload) => {
    setSelectedDoc(doc);
  };

  const handleDownload = (doc: DocumentUpload) => {
    if (doc.sharepoint_web_url) {
      window.open(doc.sharepoint_web_url, "_blank", "noopener,noreferrer");
    }
  };

  // ─── Loading State ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────

  if (isError) {
    return (
      <EmptyState
        title={t("documents.list.loadError")}
        description={t("documents.list.loadErrorDescription")}
        action={{
          label: t("common.retry"),
          onClick: () => refetch(),
        }}
        className={className}
      />
    );
  }

  // ─── Empty State ──────────────────────────────────────────────────────

  if (!documents || documents.length === 0) {
    return (
      <EmptyState
        icon={
          <svg
            className="h-8 w-8"
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
        }
        title={t("documents.list.empty")}
        description={t("documents.list.emptyDescription")}
        className={className}
      />
    );
  }

  // ─── Document List ────────────────────────────────────────────────────

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {/* Table header */}
        <div className="hidden border-b border-gray-200 bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <span className="col-span-4 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("documents.list.filename")}
          </span>
          <span className="col-span-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("documents.list.type")}
          </span>
          <span className="col-span-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("documents.list.uploadDate")}
          </span>
          <span className="col-span-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("documents.list.size")}
          </span>
          <span className="col-span-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("documents.list.extraction")}
          </span>
          <span className="col-span-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            {t("documents.list.actions")}
          </span>
        </div>

        {/* Table rows */}
        <ul className="divide-y divide-gray-200">
          {documents.map((doc) => {
            const statusConfig =
              EXTRACTION_STATUS_CONFIG[doc.llm_extraction_status];

            return (
              <li
                key={doc.id}
                className="px-4 py-3 transition-colors hover:bg-gray-50"
              >
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                  {/* Filename */}
                  <div className="col-span-4 flex items-center gap-2 truncate">
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-gray-400"
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
                    <span
                      className="truncate text-sm font-medium text-gray-900"
                      title={doc.original_filename}
                    >
                      {doc.original_filename}
                    </span>
                  </div>

                  {/* Type badge */}
                  <div className="col-span-2">
                    <Badge color="blue">
                      {t(DOCUMENT_TYPE_LABELS[doc.document_type])}
                    </Badge>
                  </div>

                  {/* Upload date */}
                  <div className="col-span-2 text-sm text-gray-500">
                    {formatDate(doc.created_at)}
                  </div>

                  {/* File size */}
                  <div className="col-span-1 text-sm text-gray-500">
                    {formatFileSize(doc.file_size)}
                  </div>

                  {/* Extraction status */}
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (doc.llm_extraction_status === "completed") {
                          handleViewExtraction(doc);
                        }
                      }}
                      className={`inline-flex items-center gap-1 ${
                        doc.llm_extraction_status === "completed"
                          ? "cursor-pointer hover:opacity-80"
                          : "cursor-default"
                      }`}
                      disabled={doc.llm_extraction_status !== "completed"}
                    >
                      {statusConfig.showSpinner && (
                        <Spinner size="sm" className="mr-1" />
                      )}
                      <Badge color={statusConfig.color}>
                        {t(statusConfig.labelKey)}
                      </Badge>
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center gap-1">
                    {doc.sharepoint_web_url && (
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-arifa-navy"
                        title={t("documents.list.download")}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                          />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(doc.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      title={t("documents.list.delete")}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm font-medium text-gray-900">
                      {doc.original_filename}
                    </span>
                    <Badge color={statusConfig.color}>
                      {t(statusConfig.labelKey)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <Badge color="blue">
                      {t(DOCUMENT_TYPE_LABELS[doc.document_type])}
                    </Badge>
                    <span>{formatDate(doc.created_at)}</span>
                    <span>{formatFileSize(doc.file_size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.sharepoint_web_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                      >
                        {t("documents.list.download")}
                      </Button>
                    )}
                    {doc.llm_extraction_status === "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewExtraction(doc)}
                      >
                        {t("extraction.results")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTargetId(doc.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      {t("documents.list.delete")}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Extraction results modal */}
      <Modal
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title={t("extraction.results")}
        className="max-w-2xl"
      >
        {selectedDoc && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {selectedDoc.original_filename}
            </p>
            {selectedDoc.llm_extraction_json &&
            Object.keys(selectedDoc.llm_extraction_json).length > 0 ? (
              <ExtractionDataView
                data={selectedDoc.llm_extraction_json}
                documentType={selectedDoc.document_type}
              />
            ) : (
              <p className="py-4 text-center text-sm text-gray-400">
                {t("extraction.noData")}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDoc(null)}
              >
                {t("common.close")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        title={t("documents.delete.title")}
        message={t("documents.delete.message")}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
        confirmLabel={t("documents.delete.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── Extraction Data Viewer ─────────────────────────────────────────────────

function ExtractionDataView({
  data,
  documentType: _documentType,
}: {
  data: Record<string, unknown>;
  documentType: DocumentUpload["document_type"];
}) {
  const { t } = useTranslation();
  const isMockData = data.is_mock === true;

  return (
    <div>
      {isMockData && (
        <div className="mb-3 rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2">
          <span className="text-xs font-medium text-yellow-800">
            {t("extraction.mockDataIndicator")}
          </span>
        </div>
      )}
      <div className="space-y-2">
        {Object.entries(data)
          .filter(([key]) => key !== "is_mock")
          .map(([key, value]) => (
            <div
              key={key}
              className="flex items-start justify-between border-b border-gray-100 pb-2 last:border-0"
            >
              <span className="text-sm font-medium capitalize text-gray-500">
                {key.replace(/_/g, " ")}
              </span>
              <span className="ml-4 text-right text-sm text-gray-900">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
