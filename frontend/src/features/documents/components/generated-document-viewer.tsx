import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  useGeneratedDocument,
  useConvertToPDF,
} from "@/features/documents/api/documents-api";
import { useTaskPolling } from "@/hooks/use-task-polling";

// ─── Props ─────────────────────────────────────────────────────────────────

interface GeneratedDocumentViewerProps {
  documentId: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function GeneratedDocumentViewer({
  documentId,
}: GeneratedDocumentViewerProps) {
  const { t } = useTranslation();

  // ── Conversion task polling state ──────────────────────────────────────
  const [conversionTaskId, setConversionTaskId] = useState<string | null>(null);

  // ── Queries & mutations ────────────────────────────────────────────────
  const {
    data: document,
    isLoading,
    isError,
  } = useGeneratedDocument(documentId);
  const convertToPDF = useConvertToPDF();

  const { status: conversionStatus, isPolling } = useTaskPolling({
    taskId: conversionTaskId,
    enabled: !!conversionTaskId,
  });

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleDownload = () => {
    window.open(
      `/api/v1/documents/generated/${documentId}/download/`,
      "_blank",
    );
  };

  const handleConvert = () => {
    convertToPDF.mutate(documentId, {
      onSuccess: (data) => {
        setConversionTaskId(data.task_id);
      },
    });
  };

  // ── Loading / error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <Card>
        <p className="text-sm text-red-600">
          {t("documents.viewer.loadError")}
        </p>
      </Card>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Document metadata card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("documents.viewer.title")}</CardTitle>
          <Badge
            className={
              document.format === "pdf"
                ? "bg-red-50 text-red-700"
                : "bg-blue-50 text-blue-700"
            }
          >
            {document.format.toUpperCase()}
          </Badge>
        </CardHeader>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="font-medium text-gray-500">
              {t("documents.viewer.template")}
            </dt>
            <dd className="mt-0.5 text-gray-900">{document.template_name}</dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">
              {t("documents.viewer.ticket")}
            </dt>
            <dd className="mt-0.5 text-gray-900">{document.ticket}</dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">
              {t("documents.viewer.generatedBy")}
            </dt>
            <dd className="mt-0.5 text-gray-900">
              {document.generated_by_email}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-gray-500">
              {t("documents.viewer.createdAt")}
            </dt>
            <dd className="mt-0.5 text-gray-900">
              {new Date(document.created_at).toLocaleString()}
            </dd>
          </div>

          {document.sharepoint_file_id && (
            <div className="sm:col-span-2">
              <dt className="font-medium text-gray-500">
                {t("documents.viewer.sharepoint")}
              </dt>
              <dd className="mt-0.5">
                <span className="text-sm text-blue-600 underline">
                  {document.sharepoint_file_id}
                </span>
              </dd>
            </div>
          )}
        </dl>

        {/* Action buttons */}
        <div className="mt-6 flex items-center gap-3 border-t border-gray-200 pt-4">
          <Button variant="primary" size="sm" onClick={handleDownload}>
            {t("documents.viewer.download")}
          </Button>

          {document.format === "docx" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleConvert}
              loading={convertToPDF.isPending}
              disabled={isPolling}
            >
              {t("documents.viewer.convertPDF")}
            </Button>
          )}
        </div>
      </Card>

      {/* PDF Conversion Status */}
      {(conversionTaskId || convertToPDF.isPending) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("documents.viewer.conversionStatus")}</CardTitle>
          </CardHeader>

          <div className="flex items-center gap-3">
            {isPolling && <Spinner size="sm" />}

            {conversionStatus === null && convertToPDF.isPending && (
              <span className="text-sm text-gray-500">
                {t("documents.viewer.conversionQueuing")}
              </span>
            )}

            {conversionStatus === "pending" && (
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-50 text-yellow-700">
                  {t("documents.viewer.conversionPending")}
                </Badge>
                <span className="text-sm text-gray-500">
                  {t("documents.viewer.conversionPendingDescription")}
                </span>
              </div>
            )}

            {conversionStatus === "running" && (
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-50 text-blue-700">
                  {t("documents.viewer.conversionRunning")}
                </Badge>
                <span className="text-sm text-gray-500">
                  {t("documents.viewer.conversionRunningDescription")}
                </span>
              </div>
            )}

            {conversionStatus === "completed" && (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-50 text-green-700">
                  {t("documents.viewer.conversionCompleted")}
                </Badge>
                <span className="text-sm text-gray-500">
                  {t("documents.viewer.conversionCompletedDescription")}
                </span>
              </div>
            )}

            {conversionStatus === "failed" && (
              <div className="flex items-center gap-2">
                <Badge className="bg-red-50 text-red-700">
                  {t("documents.viewer.conversionFailed")}
                </Badge>
                <span className="text-sm text-gray-500">
                  {t("documents.viewer.conversionFailedDescription")}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
