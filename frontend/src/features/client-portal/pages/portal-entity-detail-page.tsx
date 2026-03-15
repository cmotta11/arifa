import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import { usePortalEntityDetail } from "../api/portal-api";
import type { PortalDocument, PortalRenewal } from "../api/portal-api";

const entityStatusColor: Record<string, "gray" | "green" | "yellow" | "red"> = {
  pending: "yellow",
  active: "green",
  dissolved: "gray",
  struck_off: "red",
};

const riskLevelColor: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

const renewalStatusColor: Record<string, "gray" | "green" | "red" | "yellow"> = {
  pending: "yellow",
  completed: "green",
  overdue: "red",
};

type DetailTab = "info" | "documents" | "renewals";

export default function PortalEntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entityQuery = usePortalEntityDetail(id);
  const [activeTab, setActiveTab] = useState<DetailTab>("info");

  if (entityQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (entityQuery.isError || !entityQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const entity = entityQuery.data;

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "info", label: t("portal.entityDetail.tabs.info") },
    { key: "documents", label: t("portal.entityDetail.tabs.documents") },
    { key: "renewals", label: t("portal.entityDetail.tabs.renewals") },
  ];

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.CLIENT_PORTAL_ENTITIES)}
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
        {t("portal.entityDetail.backToEntities")}
      </button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{entity.name}</h1>
        <Badge color="blue">{entity.jurisdiction.toUpperCase()}</Badge>
        <Badge color={entityStatusColor[entity.status] ?? "gray"}>
          {entity.status.replace("_", " ")}
        </Badge>
        {entity.current_risk_level && (
          <Badge color={riskLevelColor[entity.current_risk_level] ?? "gray"}>
            {t(`riskLevels.${entity.current_risk_level}`)}
          </Badge>
        )}
      </div>

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

      <div>
        {activeTab === "info" && <InfoTab entity={entity} />}
        {activeTab === "documents" && <DocumentsTab documents={entity.documents} />}
        {activeTab === "renewals" && <RenewalsTab renewals={entity.renewals} />}
      </div>
    </div>
  );
}

function InfoTab({ entity }: { entity: ReturnType<typeof usePortalEntityDetail>["data"] & object }) {
  const { t } = useTranslation();

  const fields = [
    { label: t("portal.entityDetail.entityType"), value: entity.entity_type },
    { label: t("portal.entityDetail.jurisdiction"), value: entity.jurisdiction.toUpperCase() },
    {
      label: t("portal.entityDetail.incorporationDate"),
      value: entity.incorporation_date
        ? new Date(entity.incorporation_date).toLocaleDateString()
        : t("portal.entityDetail.notAvailable"),
    },
    { label: t("portal.entityDetail.status"), value: entity.status.replace("_", " ") },
    {
      label: t("portal.entityDetail.riskLevel"),
      value: entity.current_risk_level
        ? t(`riskLevels.${entity.current_risk_level}`)
        : t("portal.entityDetail.notAvailable"),
    },
    {
      label: t("portal.entityDetail.kycStatus"),
      value: entity.kyc_status?.replace("_", " ") ?? t("portal.entityDetail.notAvailable"),
    },
    {
      label: t("portal.entityDetail.esStatus"),
      value: entity.es_status?.replace("_", " ") ?? t("portal.entityDetail.notAvailable"),
    },
    {
      label: t("portal.entityDetail.arStatus"),
      value: entity.ar_status?.replace("_", " ") ?? t("portal.entityDetail.notAvailable"),
    },
  ];

  return (
    <Card>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {field.label}
            </dt>
            <dd className="mt-1 text-sm capitalize text-gray-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function DocumentsTab({ documents }: { documents: PortalDocument[] }) {
  const { t } = useTranslation();

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm text-gray-500">{t("portal.entityDetail.noDocuments")}</p>
      </div>
    );
  }

  const columns = [
    {
      key: "file_name",
      header: t("portal.entityDetail.fileName"),
      render: (row: PortalDocument) => (
        <span className="font-medium text-gray-900">{row.file_name}</span>
      ),
    },
    {
      key: "document_type",
      header: t("portal.entityDetail.documentType"),
      render: (row: PortalDocument) => (
        <Badge color="gray">{row.document_type}</Badge>
      ),
    },
    {
      key: "created_at",
      header: t("portal.entityDetail.date"),
      render: (row: PortalDocument) =>
        new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "download",
      header: t("portal.entityDetail.download"),
      render: (row: PortalDocument) =>
        row.download_url ? (
          <a
            href={row.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:text-primary-dark"
            onClick={(e) => e.stopPropagation()}
          >
            {t("portal.entityDetail.download")}
          </a>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        ),
    },
  ];

  return <DataTable columns={columns} data={documents} />;
}

function RenewalsTab({ renewals }: { renewals: PortalRenewal[] }) {
  const { t } = useTranslation();

  if (renewals.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm text-gray-500">{t("portal.entityDetail.noRenewals")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renewals.map((renewal) => (
        <Card key={renewal.id}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {renewal.renewal_type}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("portal.entityDetail.dueDate")}:{" "}
                {new Date(renewal.due_date).toLocaleDateString()}
              </p>
            </div>
            <Badge color={renewalStatusColor[renewal.status] ?? "gray"}>
              {renewal.status}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}
