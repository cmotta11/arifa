import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import type { Party, RFI } from "@/types";
import type { KYCDocument } from "@/features/kyc/api/kyc-api";
import {
  usePortalKYCDetail,
  usePortalParties,
  usePortalRFIs,
  usePortalDocuments,
  useRespondToRFI,
  usePortalUploadDocument,
} from "../api/portal-api";
import { kycStatusColorMap } from "@/config/status-colors";

type PortalTab = "overview" | "parties" | "rfis" | "documents";

export default function PortalKYCDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<PortalTab>("overview");

  const kycQuery = usePortalKYCDetail(id);
  const partiesQuery = usePortalParties(id);
  const rfisQuery = usePortalRFIs(id);
  const documentsQuery = usePortalDocuments(id);

  if (kycQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (kycQuery.isError || !kycQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const kyc = kycQuery.data;
  const parties = partiesQuery.data ?? [];
  const rfis = rfisQuery.data ?? [];
  const documents = (documentsQuery.data ?? []) as KYCDocument[];

  const tabs: { key: PortalTab; label: string }[] = [
    { key: "overview", label: t("portal.detail.tabs.overview") },
    { key: "parties", label: t("portal.detail.tabs.parties") },
    { key: "rfis", label: t("portal.detail.tabs.rfis") },
    { key: "documents", label: t("portal.detail.tabs.documents") },
  ];

  return (
    <div className="p-6">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.CLIENT_PORTAL)}
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
        {t("portal.detail.backToList")}
      </button>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("portal.detail.title")}
        </h1>
        <Badge color={kycStatusColorMap[kyc.status] ?? "gray"}>
          {kyc.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Metadata */}
      <Card className="mb-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              ID
            </dt>
            <dd className="mt-1 font-mono text-sm text-gray-900">
              {kyc.id.slice(0, 8)}...
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("kyc.fields.submittedAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {kyc.submitted_at
                ? new Date(kyc.submitted_at).toLocaleDateString()
                : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("kyc.fields.createdAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(kyc.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <OverviewTab partiesCount={parties.length} rfisCount={rfis.length} docsCount={documents.length} />
        )}
        {activeTab === "parties" && (
          <PartiesTab parties={parties} isLoading={partiesQuery.isLoading} />
        )}
        {activeTab === "rfis" && (
          <RFIsTab kycId={id!} rfis={rfis} isLoading={rfisQuery.isLoading} />
        )}
        {activeTab === "documents" && (
          <DocumentsTab kycId={id!} documents={documents} isLoading={documentsQuery.isLoading} />
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({
  partiesCount,
  rfisCount,
  docsCount,
}: {
  partiesCount: number;
  rfisCount: number;
  docsCount: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <p className="text-sm font-medium text-gray-500">{t("portal.detail.tabs.parties")}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{partiesCount}</p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-gray-500">{t("portal.detail.tabs.rfis")}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{rfisCount}</p>
      </Card>
      <Card>
        <p className="text-sm font-medium text-gray-500">{t("portal.detail.tabs.documents")}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{docsCount}</p>
      </Card>
    </div>
  );
}

// ─── Parties Tab ─────────────────────────────────────────────────────────────

function PartiesTab({ parties, isLoading }: { parties: Party[]; isLoading: boolean }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (parties.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm text-gray-500">{t("common.noResults")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {parties.map((party) => (
        <Card key={party.id}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{party.name}</p>
              <p className="text-xs text-gray-500">
                {party.role} &middot; {party.party_type}
              </p>
            </div>
            {party.pep_status && (
              <Badge color="red">PEP</Badge>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── RFIs Tab ────────────────────────────────────────────────────────────────

function RFIsTab({
  kycId,
  rfis,
  isLoading,
}: {
  kycId: string;
  rfis: RFI[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const respondMutation = useRespondToRFI();
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (rfis.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm text-gray-500">{t("compliance.rfi.noRfis")}</p>
      </div>
    );
  }

  const handleRespond = (rfiId: string) => {
    respondMutation.mutate(
      { kycId, rfiId, responseText },
      {
        onSuccess: () => {
          setRespondingId(null);
          setResponseText("");
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      {rfis.map((rfi) => {
        const RFI_COLOR: Record<RFI["status"], "blue" | "green" | "gray"> = {
          open: "blue",
          responded: "green",
          closed: "gray",
        };

        return (
          <Card key={rfi.id}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge color={RFI_COLOR[rfi.status]}>{rfi.status}</Badge>
                  <span className="text-xs text-gray-400">
                    {new Date(rfi.created_at ?? "").toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  {rfi.requested_fields.join(", ")}
                </p>
                {rfi.notes && (
                  <p className="mt-1 text-xs text-gray-500">{rfi.notes}</p>
                )}
                {rfi.response_text && (
                  <div className="mt-2 rounded bg-green-50 p-2 text-sm text-green-800">
                    {rfi.response_text}
                  </div>
                )}
              </div>
            </div>

            {rfi.status === "open" && respondingId !== rfi.id && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setRespondingId(rfi.id)}
              >
                {t("portal.detail.rfiRespond")}
              </Button>
            )}

            {respondingId === rfi.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder={t("portal.detail.rfiRespondPlaceholder")}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleRespond(rfi.id)}
                    loading={respondMutation.isPending}
                    disabled={!responseText.trim()}
                  >
                    {t("portal.detail.rfiSubmit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRespondingId(null);
                      setResponseText("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Documents Tab ───────────────────────────────────────────────────────────

function DocumentsTab({
  kycId,
  documents,
  isLoading,
}: {
  kycId: string;
  documents: KYCDocument[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const uploadMutation = usePortalUploadDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState("passport");

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ kycId, file, documentType: selectedType });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const DOC_TYPES = [
    "passport",
    "cedula",
    "utility_bill",
    "corporate_registry",
    "proof_of_address",
    "source_of_wealth",
    "other",
  ];

  return (
    <div className="space-y-4">
      {/* Upload */}
      <Card>
        <p className="mb-2 text-sm font-medium text-gray-700">
          {t("portal.detail.uploadDocument")}
        </p>
        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`documents.types.${type}`)}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="text-sm text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-white file:hover:bg-primary/90"
          />
          {uploadMutation.isPending && <Spinner size="sm" />}
        </div>
      </Card>

      {/* List */}
      {documents.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">{t("documents.noDocuments")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {doc.file_name}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <Badge color="gray">{doc.document_type}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
