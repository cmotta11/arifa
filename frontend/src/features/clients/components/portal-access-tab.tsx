import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardIcon, CheckIcon } from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/data-display/data-table";
import { Spinner } from "@/components/ui/spinner";
import { ShareGuestLinkButton } from "@/features/kyc/components/share-guest-link-button";
import { useClientGuestLinks, useClientKYCSubmissions } from "../api/clients-api";
import { useSendMagicLink } from "@/features/admin/api/admin-api";
import { api } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse } from "@/types";

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

interface PortalAccessTabProps {
  clientId: string;
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

export function PortalAccessTab({ clientId }: PortalAccessTabProps) {
  const { t } = useTranslation();
  const guestLinksQuery = useClientGuestLinks(clientId);
  const kycQuery = useClientKYCSubmissions(clientId);
  const sendMagicLink = useSendMagicLink();

  const clientUsersQuery = useQuery({
    queryKey: ["admin", "users", "client", clientId],
    queryFn: () =>
      api.get<PaginatedResponse<AdminUser>>("/auth/users/", {
        client_id: clientId,
        per_page: "100",
      }),
    enabled: !!clientId,
  });

  const clientUsers = clientUsersQuery.data?.results ?? [];
  const guestLinks = guestLinksQuery.data?.results ?? [];
  const kycSubmissions = kycQuery.data?.results ?? [];

  const userColumns = [
    {
      key: "email",
      header: t("admin.users.email"),
      render: (row: Record<string, unknown>) => (
        <span className="font-medium">{String(row.email ?? "")}</span>
      ),
    },
    {
      key: "name",
      header: t("admin.users.firstName"),
      render: (row: Record<string, unknown>) =>
        `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim() || "—",
    },
    {
      key: "is_active",
      header: t("tickets.status"),
      render: (row: Record<string, unknown>) => (
        <Badge color={row.is_active ? "green" : "gray"}>
          {row.is_active ? t("admin.users.active") : t("admin.users.inactive")}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row: Record<string, unknown>) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            sendMagicLink.mutate(String(row.id));
          }}
          loading={sendMagicLink.isPending}
        >
          {t("clients.portalAccess.sendMagicLink")}
        </Button>
      ),
    },
  ];

  const guestLinkColumns = [
    {
      key: "token",
      header: t("clients.portalAccess.linkUrl"),
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
      header: t("clients.portalAccess.expires"),
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

  if (
    clientUsersQuery.isLoading ||
    guestLinksQuery.isLoading ||
    kycQuery.isLoading
  ) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client Users */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("clients.portalAccess.clientUsers")}
        </h3>
        {clientUsers.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("clients.portalAccess.noUsers")}
          </p>
        ) : (
          <DataTable
            columns={userColumns}
            data={clientUsers as unknown as Record<string, unknown>[]}
            emptyMessage={t("clients.portalAccess.noUsers")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>

      {/* Active Guest Links */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("clients.portalAccess.guestLinks")}
        </h3>
        {guestLinks.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("clients.portalAccess.noLinks")}
          </p>
        ) : (
          <DataTable
            columns={guestLinkColumns}
            data={guestLinks as unknown as Record<string, unknown>[]}
            emptyMessage={t("clients.portalAccess.noLinks")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>

      {/* KYC Submissions */}
      <Card>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("clients.portalAccess.kycSubmissions")}
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
