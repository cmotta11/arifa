import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import type { RiskAssessment } from "@/types";
import {
  useKYCDetail,
  useKYCParties,
  useKYCDocuments,
  useKYCRisk,
  useCalculateRisk,
  useKYCEntitySnapshot,
  useApproveWithChanges,
  useSendBackKYC,
  type KYCDocument,
} from "../api/kyc-api";
import { EntityChangeReview } from "../components/entity-change-review";
import { KYCFormShell } from "../components/kyc-form-shell";
import { PartyList } from "../components/party-list";
import { ReviewSummary } from "../components/review-summary";
import { ShareGuestLinkButton } from "../components/share-guest-link-button";
import { kycStatusColorMap } from "@/config/status-colors";
import { formatDate } from "@/lib/format";
import { HelpButton } from "@/components/feedback/help-button";

// ─── Constants ──────────────────────────────────────────────────────────────

type DetailTab = "overview" | "parties" | "documents" | "risk" | "rfis" | "entityReview";

interface TabDef {
  key: DetailTab;
  labelKey: string;
}

const TABS: TabDef[] = [
  { key: "overview", labelKey: "tabs.overview" },
  { key: "parties", labelKey: "tabs.parties" },
  { key: "documents", labelKey: "tabs.documents" },
  { key: "risk", labelKey: "tabs.risk" },
  { key: "rfis", labelKey: "tabs.rfis" },
  { key: "entityReview", labelKey: "tabs.entityReview" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function KYCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("kyc");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const kycQuery = useKYCDetail(id);
  const partiesQuery = useKYCParties(id);
  const documentsQuery = useKYCDocuments(id);
  const riskQuery = useKYCRisk(id);
  const calculateRiskMutation = useCalculateRisk();
  const snapshotQuery = useKYCEntitySnapshot(id);
  const approveMutation = useApproveWithChanges();
  const sendBackMutation = useSendBackKYC();

  // ─── Loading State ──────────────────────────────────────────────────────

  if (kycQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────

  if (kycQuery.isError || !kycQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("errors.loadFailed")}
        </div>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate(ROUTES.KYC)}
        >
          {t("actions.backToList")}
        </Button>
      </div>
    );
  }

  const kyc = kycQuery.data;
  const parties = partiesQuery.data ?? [];
  const documents = (documentsQuery.data ?? []) as KYCDocument[];
  const risk = riskQuery.data ?? null;
  const isDraft = kyc.status === "draft";

  // ─── Draft Mode: Show multi-step form ───────────────────────────────────

  if (isDraft) {
    return (
      <div className="p-6">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.KYC)}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("actions.backToList")}
        </button>

        {/* Title */}
        <div className="mb-6 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">
            {t("detail.editTitle")}
          </h1>
          <Badge color={kycStatusColorMap[kyc.status] ?? "gray"}>
            {t(`status.${kyc.status}`)}
          </Badge>
        </div>

        {/* Multi-step form */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <KYCFormShell
            kycId={id!}
            onSubmitSuccess={() => {
              kycQuery.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  // ─── Read-Only Mode: Submitted / Under Review / Approved / Rejected ─────

  return (
    <div className="p-6">
      {/* Back Button */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.KYC)}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("actions.backToList")}
      </button>

      {/* Page Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("detail.title")}
        </h1>
        <Badge color={kycStatusColorMap[kyc.status] ?? "gray"}>
          {t(`status.${kyc.status}`)}
        </Badge>
        {risk && (
          <Badge
            color={
              risk.risk_level === "low"
                ? "green"
                : risk.risk_level === "medium"
                  ? "yellow"
                  : "red"
            }
          >
            {t(`risk.${risk.risk_level}`)} ({risk.total_score})
          </Badge>
        )}
        <div className="ml-auto">
          <ShareGuestLinkButton kycId={id!} />
        </div>
      </div>

      {/* Metadata Row */}
      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("fields.ticket")}
            </dt>
            <dd className="mt-1 font-mono text-sm text-gray-900">
              {kyc.ticket.slice(0, 8)}...
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("fields.submittedAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(kyc.submitted_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("fields.reviewedAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(kyc.reviewed_at)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("fields.createdAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(kyc.created_at)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`
                  whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }
                `}
              >
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <ReviewSummary
            kyc={kyc}
            parties={parties}
            documents={documents}
            risk={risk}
            onSubmit={() => {}}
            isSubmitting={false}
          />
        )}

        {activeTab === "parties" && (
          <PartyList
            kycId={id!}
            parties={parties}
            isLoading={partiesQuery.isLoading}
            readonly
          />
        )}

        {activeTab === "documents" && (
          <DocumentsTab
            documents={documents}
            isLoading={documentsQuery.isLoading}
          />
        )}

        {activeTab === "risk" && (
          <RiskTab
            kycId={id!}
            risk={risk}
            isLoading={riskQuery.isLoading}
            onCalculate={() => calculateRiskMutation.mutate(id!)}
            isCalculating={calculateRiskMutation.isPending}
          />
        )}

        {activeTab === "rfis" && <RFIsTab kycId={id!} />}

        {activeTab === "entityReview" && snapshotQuery.data && (
          <EntityChangeReview
            snapshot={snapshotQuery.data}
            proposedData={kyc.proposed_entity_data}
            fieldComments={kyc.field_comments}
            onApprove={(modifiedData) =>
              approveMutation.mutate({ kycId: id!, modifiedData })
            }
            onSendBack={(comments) =>
              sendBackMutation.mutate({ kycId: id!, fieldComments: comments })
            }
            isApproving={approveMutation.isPending}
            isSendingBack={sendBackMutation.isPending}
          />
        )}
        {activeTab === "entityReview" && snapshotQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}
      </div>
      <HelpButton module="kyc" entityId={kyc?.entity_id} currentPage="kyc-detail" />
    </div>
  );
}

// ─── Documents Tab ──────────────────────────────────────────────────────────

function DocumentsTab({
  documents,
  isLoading,
}: {
  documents: KYCDocument[];
  isLoading: boolean;
}) {
  const { t } = useTranslation("kyc");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
        <svg
          className="mx-auto h-10 w-10 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
        <p className="mt-3 text-sm text-gray-500">{t("documents.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {doc.file_name}
              </p>
              <p className="text-xs text-gray-500">
                {t("documents.uploadedOn", {
                  date: new Date(doc.created_at).toLocaleDateString(),
                })}
              </p>
            </div>
          </div>
          <Badge color="gray">{doc.document_type}</Badge>
        </div>
      ))}
    </div>
  );
}

// ─── Risk Tab ───────────────────────────────────────────────────────────────

function RiskTab({
  risk,
  isLoading,
  onCalculate,
  isCalculating,
}: {
  kycId: string;
  risk: RiskAssessment | null;
  isLoading: boolean;
  onCalculate: () => void;
  isCalculating: boolean;
}) {
  const { t } = useTranslation("kyc");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calculate button */}
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={onCalculate}
          loading={isCalculating}
        >
          <svg
            className="mr-1.5 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
            />
          </svg>
          {t("risk.recalculate")}
        </Button>
      </div>

      {risk ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("risk.title")}</CardTitle>
          </CardHeader>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-gray-900">
                {risk.total_score}
              </p>
              <p className="mt-1 text-xs text-gray-500">{t("risk.score")}</p>
            </div>
            <div>
              <Badge
                color={
                  risk.risk_level === "low"
                    ? "green"
                    : risk.risk_level === "medium"
                      ? "yellow"
                      : "red"
                }
                className="text-sm"
              >
                {t(`risk.${risk.risk_level}`)}
              </Badge>
              <p className="mt-2 text-xs text-gray-500">
                {t("risk.assessedAt", {
                  date: new Date(risk.assessed_at).toLocaleDateString(),
                })}
              </p>
              <p className="text-xs text-gray-500">
                {t("risk.trigger")}: {risk.trigger}
              </p>
            </div>
          </div>

          {/* Breakdown */}
          {risk.breakdown_json &&
            Object.keys(risk.breakdown_json).length > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="mb-3 text-sm font-medium text-gray-700">
                  {t("risk.breakdown")}
                </h4>
                <div className="space-y-2">
                  {Object.entries(risk.breakdown_json).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{key}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min(Number(value) * 10, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="min-w-[2rem] text-right text-sm font-medium text-gray-900">
                          {String(value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </Card>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
          <svg
            className="mx-auto h-10 w-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
          <p className="mt-3 text-sm text-gray-500">{t("risk.noAssessment")}</p>
          <p className="mt-1 text-xs text-gray-400">
            {t("risk.calculateHint")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── RFIs Tab (placeholder) ─────────────────────────────────────────────────

function RFIsTab({ kycId: _kycId }: { kycId: string }) {
  const { t } = useTranslation("kyc");

  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
      <svg
        className="mx-auto h-10 w-10 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
        />
      </svg>
      <p className="mt-3 text-sm text-gray-500">{t("rfis.empty")}</p>
      <p className="mt-1 text-xs text-gray-400">{t("rfis.hint")}</p>
    </div>
  );
}
