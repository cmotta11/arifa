import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { FormField } from "@/components/forms/form-field";
import { EmptyState } from "@/components/data-display/empty-state";
import {
  useTemplates,
  useGenerateDocument,
  useConvertToPDF,
} from "@/features/documents/api/documents-api";
import type { GeneratedDocument } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ContextRow {
  key: string;
  value: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DocumentGenerator() {
  const { t } = useTranslation();

  // ── Form state ─────────────────────────────────────────────────────────
  const [ticketId, setTicketId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [contextRows, setContextRows] = useState<ContextRow[]>([]);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(
    null,
  );

  // ── Queries & mutations ────────────────────────────────────────────────
  const { data: templates = [], isLoading: templatesLoading } = useTemplates({
    is_active: "true",
  });
  const generateDocument = useGenerateDocument();
  const convertToPDF = useConvertToPDF();

  // ── Context data handlers ──────────────────────────────────────────────

  const handleAddContextRow = () => {
    setContextRows((prev) => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveContextRow = (index: number) => {
    setContextRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContextChange = (
    index: number,
    field: "key" | "value",
    value: string,
  ) => {
    setContextRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  // ── Generate handler ───────────────────────────────────────────────────

  const handleGenerate = () => {
    if (!ticketId || !templateId) return;

    const contextData: Record<string, string> = {};
    for (const row of contextRows) {
      if (row.key.trim()) {
        contextData[row.key.trim()] = row.value;
      }
    }

    generateDocument.mutate(
      {
        ticket_id: ticketId,
        template_id: templateId,
        context_data:
          Object.keys(contextData).length > 0 ? contextData : undefined,
      },
      {
        onSuccess: (data) => {
          setGeneratedDoc(data);
        },
      },
    );
  };

  const handleConvertToPDF = () => {
    if (!generatedDoc) return;
    convertToPDF.mutate(generatedDoc.id);
  };

  const handleReset = () => {
    setTicketId("");
    setTemplateId("");
    setContextRows([]);
    setGeneratedDoc(null);
    generateDocument.reset();
  };

  // ── Template select options ────────────────────────────────────────────

  const templateOptions = templates.map((tpl) => ({
    value: tpl.id,
    label: `${tpl.name}${tpl.entity_type ? ` (${tpl.entity_type})` : ""}${tpl.jurisdiction ? ` - ${tpl.jurisdiction}` : ""}`,
  }));

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Generation form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("documents.generate.title")}</CardTitle>
        </CardHeader>

        {generatedDoc ? (
          /* ── Post-generation result ───────────────────────────────── */
          <div className="space-y-4">
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-800">
                {t("documents.generate.success")}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-gray-500">
                  {t("documents.generate.result.template")}
                </dt>
                <dd className="text-gray-900">{generatedDoc.template_name}</dd>

                <dt className="font-medium text-gray-500">
                  {t("documents.generate.result.format")}
                </dt>
                <dd>
                  <Badge
                    className={
                      generatedDoc.format === "pdf"
                        ? "bg-red-50 text-red-700"
                        : "bg-blue-50 text-blue-700"
                    }
                  >
                    {generatedDoc.format.toUpperCase()}
                  </Badge>
                </dd>

                <dt className="font-medium text-gray-500">
                  {t("documents.generate.result.createdAt")}
                </dt>
                <dd className="text-gray-900">
                  {new Date(generatedDoc.created_at).toLocaleString()}
                </dd>
              </dl>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.open(
                    `/api/v1/documents/generated/${generatedDoc.id}/download/`,
                    "_blank",
                  );
                }}
              >
                {t("documents.generate.result.download")}
              </Button>

              {generatedDoc.format === "docx" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleConvertToPDF}
                  loading={convertToPDF.isPending}
                >
                  {t("documents.generate.result.convertPDF")}
                </Button>
              )}

              {convertToPDF.isSuccess && (
                <Badge className="bg-green-50 text-green-700">
                  {t("documents.generate.result.conversionQueued")}
                </Badge>
              )}

              <Button variant="ghost" size="sm" onClick={handleReset}>
                {t("documents.generate.result.generateAnother")}
              </Button>
            </div>
          </div>
        ) : (
          /* ── Generation form ──────────────────────────────────────── */
          <div className="space-y-4">
            <FormField
              label={t("documents.generate.form.ticketId")}
              required
              htmlFor="gen-ticket-id"
            >
              <Input
                id="gen-ticket-id"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                placeholder={t("documents.generate.form.ticketIdPlaceholder")}
              />
            </FormField>

            <FormField
              label={t("documents.generate.form.template")}
              required
              htmlFor="gen-template"
            >
              {templatesLoading ? (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" />
                  <span className="text-sm text-gray-500">
                    {t("documents.generate.form.loadingTemplates")}
                  </span>
                </div>
              ) : templates.length === 0 ? (
                <EmptyState
                  title={t("documents.generate.form.noTemplates")}
                  description={t(
                    "documents.generate.form.noTemplatesDescription",
                  )}
                />
              ) : (
                <Select
                  id="gen-template"
                  options={templateOptions}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  placeholder={t(
                    "documents.generate.form.templatePlaceholder",
                  )}
                />
              )}
            </FormField>

            {/* Context data key/value pairs */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {t("documents.generate.form.contextData")}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddContextRow}
                >
                  {t("documents.generate.form.addField")}
                </Button>
              </div>

              {contextRows.length === 0 ? (
                <p className="text-sm text-gray-400">
                  {t("documents.generate.form.noContextData")}
                </p>
              ) : (
                <div className="space-y-2">
                  {contextRows.map((row, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={row.key}
                        onChange={(e) =>
                          handleContextChange(index, "key", e.target.value)
                        }
                        placeholder={t(
                          "documents.generate.form.contextKeyPlaceholder",
                        )}
                        className="flex-1"
                      />
                      <Input
                        value={row.value}
                        onChange={(e) =>
                          handleContextChange(index, "value", e.target.value)
                        }
                        placeholder={t(
                          "documents.generate.form.contextValuePlaceholder",
                        )}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveContextRow(index)}
                        className="shrink-0 text-red-500 hover:text-red-700"
                      >
                        &times;
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error message */}
            {generateDocument.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">
                  {t("documents.generate.form.error")}
                </p>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleGenerate}
                loading={generateDocument.isPending}
                disabled={!ticketId || !templateId}
              >
                {t("documents.generate.form.submit")}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
