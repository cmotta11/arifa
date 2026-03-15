import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/navigation/tabs";
import { Modal } from "@/components/overlay/modal";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import {
  useKYCDetail,
  useApproveKYC,
  useRejectKYC,
  useEscalateKYC,
  useKYCDocuments,
  type KYCDocument,
} from "../api/compliance-api";
import { RiskMatrixDisplay } from "./risk-matrix-display";
import { RiskHistoryTimeline } from "./risk-history-timeline";
import { WorldCheckPanel } from "./world-check-panel";
import { RFISection } from "./rfi-section";
import { UBOTreeViewer } from "./ubo-tree-viewer";
import { kycStatusColorMap } from "@/config/status-colors";
import { formatDateTime } from "@/lib/format";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KYCReviewPanelProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KYCReviewPanel({ kycId }: KYCReviewPanelProps) {
  const { t } = useTranslation("compliance");

  const [activeTab, setActiveTab] = useState("overview");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const kycQuery = useKYCDetail(kycId);
  const approveMutation = useApproveKYC();
  const rejectMutation = useRejectKYC();
  const escalateMutation = useEscalateKYC();
  const documentsQuery = useKYCDocuments(kycId);

  const tabs = [
    { key: "overview", label: t("tabs.overview") },
    { key: "parties", label: t("tabs.parties") },
    { key: "risk", label: t("tabs.risk") },
    { key: "worldcheck", label: t("tabs.worldCheck") },
    { key: "rfis", label: t("tabs.rfis") },
    { key: "documents", label: t("tabs.documents") },
  ];

  // --- Loading / Error ---

  if (kycQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (kycQuery.isError || !kycQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("common.errorLoading")}
        </div>
      </div>
    );
  }

  const kyc = kycQuery.data;
  const entityName = kyc.ticket_detail?.entity?.name ?? t("queue.noEntity");
  const clientName = kyc.ticket_detail?.client?.name ?? t("queue.noClient");
  const canTakeAction = kyc.status === "submitted" || kyc.status === "under_review";

  // --- Handlers ---

  function handleApprove() {
    approveMutation.mutate(kycId, {
      onSuccess: () => setShowApproveDialog(false),
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: kycId, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setShowRejectModal(false);
          setRejectReason("");
        },
      },
    );
  }

  function handleEscalate() {
    escalateMutation.mutate(kycId, {
      onSuccess: () => setShowEscalateDialog(false),
    });
  }

  // --- Tab Content ---

  function renderTabContent() {
    switch (activeTab) {
      case "overview":
        return <OverviewTab kyc={kyc} />;
      case "parties":
        return <UBOTreeViewer kycId={kycId} />;
      case "risk":
        return (
          <div className="space-y-6">
            <RiskMatrixDisplay kycId={kycId} />
            <RiskHistoryTimeline kycId={kycId} />
          </div>
        );
      case "worldcheck":
        return <WorldCheckPanel kycId={kycId} />;
      case "rfis":
        return <RFISection kycId={kycId} />;
      case "documents":
        return <DocumentsTab documents={documentsQuery.data ?? []} loading={documentsQuery.isLoading} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{entityName}</h2>
              <Badge color={kycStatusColorMap[kyc.status] ?? "gray"}>
                {t(`status.${kyc.status}`)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {clientName} &middot; {t("review.kycId")}: {kyc.id.slice(0, 8)}
            </p>
          </div>

          {/* Action Buttons */}
          {canTakeAction && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowApproveDialog(true)}
              >
                {t("actions.approve")}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowRejectModal(true)}
              >
                {t("actions.reject")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowEscalateDialog(true)}
              >
                {t("actions.escalate")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="flex-shrink-0" />

      {/* Tab Content */}
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>

      {/* Approve Confirmation */}
      <ConfirmDialog
        isOpen={showApproveDialog}
        title={t("dialogs.approveTitle")}
        message={t("dialogs.approveMessage", { entity: entityName })}
        confirmLabel={t("actions.approve")}
        cancelLabel={t("actions.cancel")}
        variant="primary"
        loading={approveMutation.isPending}
        onConfirm={handleApprove}
        onCancel={() => setShowApproveDialog(false)}
      />

      {/* Escalate Confirmation */}
      <ConfirmDialog
        isOpen={showEscalateDialog}
        title={t("dialogs.escalateTitle")}
        message={t("dialogs.escalateMessage", { entity: entityName })}
        confirmLabel={t("actions.escalate")}
        cancelLabel={t("actions.cancel")}
        variant="primary"
        loading={escalateMutation.isPending}
        onConfirm={handleEscalate}
        onCancel={() => setShowEscalateDialog(false)}
      />

      {/* Reject Modal (needs reason text) */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason("");
        }}
        title={t("dialogs.rejectTitle")}
      >
        <p className="mb-4 text-sm text-gray-600">
          {t("dialogs.rejectMessage", { entity: entityName })}
        </p>
        <Input
          label={t("dialogs.rejectReasonLabel")}
          placeholder={t("dialogs.rejectReasonPlaceholder")}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setShowRejectModal(false);
              setRejectReason("");
            }}
            disabled={rejectMutation.isPending}
          >
            {t("actions.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={handleReject}
            loading={rejectMutation.isPending}
            disabled={!rejectReason.trim()}
          >
            {t("actions.reject")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ kyc }: { kyc: KYCDetail }) {
  const { t } = useTranslation("compliance");

  const entityName = kyc.ticket_detail?.entity?.name ?? "-";
  const clientName = kyc.ticket_detail?.client?.name ?? "-";
  const jurisdiction = kyc.ticket_detail?.entity?.jurisdiction?.toUpperCase() ?? "-";

  return (
    <Card>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.entity")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{entityName}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.client")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{clientName}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.jurisdiction")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{jurisdiction}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.status")}</dt>
          <dd className="mt-1">
            <Badge color={kycStatusColorMap[kyc.status] ?? "gray"}>
              {t(`status.${kyc.status}`)}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.submittedAt")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{formatDateTime(kyc.submitted_at)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.reviewedAt")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{formatDateTime(kyc.reviewed_at)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.ticketId")}</dt>
          <dd className="mt-1 font-mono text-sm text-gray-900">
            {kyc.ticket_detail?.id?.slice(0, 8) ?? kyc.ticket}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">{t("overview.createdAt")}</dt>
          <dd className="mt-1 text-sm text-gray-900">{formatDateTime(kyc.created_at)}</dd>
        </div>
      </dl>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Documents Tab
// ---------------------------------------------------------------------------

function DocumentsTab({ documents, loading }: { documents: KYCDocument[]; loading: boolean }) {
  const { t } = useTranslation("compliance");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm font-medium text-gray-900">{t("documents.empty")}</p>
          <p className="mt-1 text-sm text-gray-500">{t("documents.emptyDescription")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <ul className="divide-y divide-gray-200">
        {documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                <p className="text-xs text-gray-500">
                  {doc.document_type} &middot; {formatDateTime(doc.created_at)}
                </p>
              </div>
            </div>
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("documents.download")}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}
