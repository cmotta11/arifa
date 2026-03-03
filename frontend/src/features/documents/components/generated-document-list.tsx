import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { EmptyState } from "@/components/data-display/empty-state";
import {
  useGeneratedDocuments,
  useConvertToPDF,
} from "@/features/documents/api/documents-api";
import type { GeneratedDocument } from "@/types";

// ─── Component ─────────────────────────────────────────────────────────────

export function GeneratedDocumentList() {
  const { t } = useTranslation();

  // ── Filter state ───────────────────────────────────────────────────────
  const [ticketFilter, setTicketFilter] = useState("");
  const [appliedTicketFilter, setAppliedTicketFilter] = useState<
    string | undefined
  >();

  // ── Track documents currently being converted ──────────────────────────
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  // ── Queries & mutations ────────────────────────────────────────────────
  const { data: documents = [], isLoading } =
    useGeneratedDocuments(appliedTicketFilter);
  const convertToPDF = useConvertToPDF();

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSearch = () => {
    setAppliedTicketFilter(ticketFilter.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleConvert = (docId: string) => {
    setConvertingIds((prev) => new Set(prev).add(docId));
    convertToPDF.mutate(docId, {
      onSettled: () => {
        // Keep the "queued" state visible; it will refresh on next query invalidation
      },
    });
  };

  const handleDownload = (docId: string) => {
    window.open(`/api/v1/documents/generated/${docId}/download/`, "_blank");
  };

  // ── Table columns ──────────────────────────────────────────────────────

  const columns = [
    {
      key: "template_name",
      header: t("documents.generated.columns.template"),
      render: (row: GeneratedDocument) => (
        <span className="font-medium text-gray-900">
          {row.template_name || t("documents.generated.unknownTemplate")}
        </span>
      ),
    },
    {
      key: "format",
      header: t("documents.generated.columns.format"),
      render: (row: GeneratedDocument) => (
        <Badge
          className={
            row.format === "pdf"
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700"
          }
        >
          {row.format.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "generated_by_email",
      header: t("documents.generated.columns.generatedBy"),
      render: (row: GeneratedDocument) => (
        <span className="text-gray-700">{row.generated_by_email}</span>
      ),
    },
    {
      key: "created_at",
      header: t("documents.generated.columns.createdAt"),
      render: (row: GeneratedDocument) => (
        <span className="text-gray-500">
          {new Date(row.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("documents.generated.columns.actions"),
      render: (row: GeneratedDocument) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(row.id);
            }}
          >
            {t("documents.generated.download")}
          </Button>

          {row.format === "docx" && (
            <>
              {convertingIds.has(row.id) ? (
                <div className="flex items-center gap-1">
                  <Spinner size="sm" />
                  <span className="text-xs text-gray-500">
                    {t("documents.generated.conversionQueued")}
                  </span>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConvert(row.id);
                  }}
                >
                  {t("documents.generated.convertPDF")}
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("documents.generated.title")}</CardTitle>
      </CardHeader>

      {/* Filter row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 max-w-md">
          <Input
            value={ticketFilter}
            onChange={(e) => setTicketFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("documents.generated.filterTicketPlaceholder")}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={handleSearch}>
          {t("documents.generated.search")}
        </Button>
        {appliedTicketFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTicketFilter("");
              setAppliedTicketFilter(undefined);
            }}
          >
            {t("documents.generated.clearFilter")}
          </Button>
        )}
      </div>

      {/* Table */}
      {!isLoading && documents.length === 0 ? (
        <EmptyState
          title={t("documents.generated.empty")}
          description={t("documents.generated.emptyDescription")}
        />
      ) : (
        <DataTable<GeneratedDocument & Record<string, unknown>>
          columns={columns}
          data={documents as (GeneratedDocument & Record<string, unknown>)[]}
          loading={isLoading}
          emptyMessage={t("documents.generated.empty")}
          keyExtractor={(row) => row.id}
        />
      )}
    </Card>
  );
}
