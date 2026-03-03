import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-display/data-table";
import { Spinner } from "@/components/ui/spinner";
import { ShareGuestLinkButton } from "@/features/kyc/components/share-guest-link-button";
import {
  useEntityGuestLinks,
  useEntityKYCSubmissions,
} from "../api/entities-api";

interface AccessLinksTabProps {
  entityId: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded border border-gray-300 p-1 text-gray-500 hover:bg-gray-50"
    >
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-500" />
      ) : (
        <ClipboardIcon className="h-4 w-4" />
      )}
    </button>
  );
}

export function AccessLinksTab({ entityId }: AccessLinksTabProps) {
  const { t } = useTranslation();
  const guestLinksQuery = useEntityGuestLinks(entityId);
  const kycQuery = useEntityKYCSubmissions(entityId);

  const guestLinks = guestLinksQuery.data?.results ?? [];
  const kycSubmissions = kycQuery.data?.results ?? [];

  const guestLinkColumns = [
    {
      key: "token",
      header: t("entities.accessLinks.linkUrl"),
      render: (row: Record<string, unknown>) => {
        const url = `${window.location.origin}/guest/${String(row.token)}`;
        return (
          <div className="flex items-center gap-2">
            <span className="max-w-xs truncate text-sm text-gray-600">
              {url}
            </span>
            <CopyButton text={url} />
          </div>
        );
      },
    },
    {
      key: "kyc_submission",
      header: "KYC",
      render: (row: Record<string, unknown>) =>
        row.kyc_submission
          ? String(row.kyc_submission).slice(0, 8) + "..."
          : "—",
    },
    {
      key: "expires_at",
      header: t("entities.accessLinks.expires"),
      render: (row: Record<string, unknown>) =>
        new Date(String(row.expires_at)).toLocaleDateString(),
    },
  ];

  const kycColumns = [
    {
      key: "id",
      header: "ID",
      render: (row: Record<string, unknown>) => (
        <span className="font-medium">{String(row.id).slice(0, 8)}...</span>
      ),
    },
    {
      key: "status",
      header: t("tickets.status"),
      render: (row: Record<string, unknown>) => {
        const status = String(row.status);
        const colors: Record<string, "gray" | "blue" | "yellow" | "green" | "red"> = {
          draft: "gray",
          submitted: "blue",
          under_review: "yellow",
          approved: "green",
          rejected: "red",
        };
        return <Badge color={colors[status] ?? "gray"}>{status}</Badge>;
      },
    },
    {
      key: "created_at",
      header: t("tickets.createdAt"),
      render: (row: Record<string, unknown>) =>
        new Date(String(row.created_at)).toLocaleDateString(),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row: Record<string, unknown>) => (
        <ShareGuestLinkButton kycId={String(row.id)} />
      ),
    },
  ];

  if (guestLinksQuery.isLoading || kycQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Guest Links */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("entities.accessLinks.guestLinks")}
        </h3>
        {guestLinks.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("entities.accessLinks.noLinks")}
          </p>
        ) : (
          <DataTable
            columns={guestLinkColumns}
            data={guestLinks as unknown as Record<string, unknown>[]}
            emptyMessage={t("entities.accessLinks.noLinks")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>

      {/* KYC Submissions */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("entities.accessLinks.kycSubmissions")}
        </h3>
        {kycSubmissions.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("kyc.noKyc")}
          </p>
        ) : (
          <DataTable
            columns={kycColumns}
            data={kycSubmissions as unknown as Record<string, unknown>[]}
            emptyMessage={t("kyc.noKyc")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>
    </div>
  );
}
