import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs } from "@/components/navigation/tabs";
import { DocumentUploader } from "@/features/documents/components/document-uploader";
import { DocumentList } from "@/features/documents/components/document-list";
import { ExtractionPreview } from "@/features/documents/components/extraction-preview";
import { TemplateManagement } from "@/features/documents/components/template-management";
import { DocumentGenerator } from "@/features/documents/components/document-generator";
import { GeneratedDocumentList } from "@/features/documents/components/generated-document-list";
import { useKYCList } from "@/features/kyc/api/kyc-api";
import type { DocumentUpload } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActiveExtraction {
  taskId: string;
  documentType: DocumentUpload["document_type"];
}

// ─── Tab Keys ───────────────────────────────────────────────────────────────

const TAB_TEMPLATES = "templates";
const TAB_GENERATE = "generate";
const TAB_GENERATED = "generated";
const TAB_KYC = "kyc";

// ─── Page Component ─────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { t } = useTranslation();

  // ── Tab state ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(TAB_TEMPLATES);

  // ── KYC tab state ──────────────────────────────────────────────────────
  const [activeKycId, setActiveKycId] = useState<string | null>(null);
  const [activeExtraction, setActiveExtraction] =
    useState<ActiveExtraction | null>(null);

  // ── KYC list for selector ──────────────────────────────────────────────
  const { data: kycData, isLoading: kycLoading } = useKYCList();

  const kycOptions =
    kycData?.results.map((kyc) => ({
      value: kyc.id,
      label: `${kyc.id.slice(0, 8)}... - ${kyc.status}`,
    })) ?? [];

  // ── KYC tab handlers ───────────────────────────────────────────────────

  const handleExtractionStarted = (
    taskId: string,
    _file: File,
    documentType: DocumentUpload["document_type"],
  ) => {
    setActiveExtraction({ taskId, documentType });
  };

  const handleDismissExtraction = () => {
    setActiveExtraction(null);
  };

  // ── Tabs config ────────────────────────────────────────────────────────

  const tabs = [
    { key: TAB_TEMPLATES, label: t("documents.tabs.templates") },
    { key: TAB_GENERATE, label: t("documents.tabs.generate") },
    { key: TAB_GENERATED, label: t("documents.tabs.generated") },
    { key: TAB_KYC, label: t("documents.tabs.kyc") },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {t("documents.page.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("documents.page.description")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {/* ── Templates tab ──────────────────────────────────────── */}
        {activeTab === TAB_TEMPLATES && <TemplateManagement />}

        {/* ── Generate tab ───────────────────────────────────────── */}
        {activeTab === TAB_GENERATE && <DocumentGenerator />}

        {/* ── Generated Documents tab ────────────────────────────── */}
        {activeTab === TAB_GENERATED && <GeneratedDocumentList />}

        {/* ── KYC Documents tab ──────────────────────────────────── */}
        {activeTab === TAB_KYC && (
          <div className="space-y-6">
            {/* KYC Selector */}
            <Card>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 shrink-0">
                  {t("documents.page.selectKyc")}
                </label>
                {kycLoading ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-gray-500">
                      {t("documents.page.loadingKyc")}
                    </span>
                  </div>
                ) : (
                  <Select
                    options={kycOptions}
                    value={activeKycId || ""}
                    onChange={(e) =>
                      setActiveKycId(e.target.value || null)
                    }
                    placeholder={t("documents.page.selectKycPlaceholder")}
                  />
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left column: Upload + Extraction */}
              <div className="space-y-6 lg:col-span-1">
                {/* Document upload area */}
                {activeKycId ? (
                  <DocumentUploader
                    kycId={activeKycId}
                    onExtractionStarted={(taskId, file) => {
                      handleExtractionStarted(taskId, file, "other");
                    }}
                  />
                ) : (
                  <Card>
                    <h3 className="mb-3 text-lg font-semibold text-gray-900">
                      {t("documents.upload.title")}
                    </h3>
                    <p className="mb-4 text-sm text-gray-500">
                      {t("documents.page.selectKycHint")}
                    </p>
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-8">
                      <svg
                        className="mb-3 h-8 w-8 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <p className="text-sm text-gray-400">
                        {t("documents.page.uploadDisabled")}
                      </p>
                    </div>
                  </Card>
                )}

                {/* Active extraction preview */}
                {activeExtraction && (
                  <ExtractionPreview
                    taskId={activeExtraction.taskId}
                    documentType={activeExtraction.documentType}
                    onDismiss={handleDismissExtraction}
                    onRetry={() => {
                      handleDismissExtraction();
                    }}
                  />
                )}

                {/* Extraction capability info */}
                <Card>
                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                    {t("documents.page.extractionInfo")}
                  </h4>
                  <p className="mb-3 text-xs text-gray-500">
                    {t("documents.page.extractionInfoDescription")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge color="blue">
                      {t("documents.types.passport")}
                    </Badge>
                    <Badge color="blue">
                      {t("documents.types.cedula")}
                    </Badge>
                    <Badge color="blue">
                      {t("documents.types.utilityBill")}
                    </Badge>
                    <Badge color="blue">
                      {t("documents.types.corporateRegistry")}
                    </Badge>
                    <Badge color="blue">
                      {t("documents.types.proofOfAddress")}
                    </Badge>
                    <Badge color="blue">
                      {t("documents.types.sourceOfWealth")}
                    </Badge>
                  </div>
                </Card>
              </div>

              {/* Right column: Document list */}
              <div className="lg:col-span-2">
                {activeKycId ? (
                  <>
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">
                      {t("documents.list.title")}
                    </h2>
                    <DocumentList kycId={activeKycId} />
                  </>
                ) : (
                  <Card>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <svg
                        className="mb-4 h-12 w-12 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                        />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900">
                        {t("documents.page.noKycSelected")}
                      </h3>
                      <p className="mt-1 max-w-sm text-sm text-gray-500">
                        {t("documents.page.noKycSelectedDescription")}
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
