import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import type { KYCSubmission } from "@/types";
import { useKYCList, type KYCListFilters } from "../api/kyc-api";

// ─── Status Tab Definitions ─────────────────────────────────────────────────

interface StatusTab {
  key: KYCListFilters["status"];
  labelKey: string;
}

const STATUS_TABS: StatusTab[] = [
  { key: "all", labelKey: "statusFilter.all" },
  { key: "draft", labelKey: "statusFilter.draft" },
  { key: "submitted", labelKey: "statusFilter.submitted" },
  { key: "under_review", labelKey: "statusFilter.underReview" },
  { key: "approved", labelKey: "statusFilter.approved" },
  { key: "rejected", labelKey: "statusFilter.rejected" },
];

// ─── Badge Color Map ────────────────────────────────────────────────────────

const STATUS_BADGE_COLOR: Record<
  KYCSubmission["status"],
  "gray" | "blue" | "yellow" | "green" | "red"
> = {
  draft: "gray",
  submitted: "blue",
  under_review: "yellow",
  sent_back: "yellow",
  approved: "green",
  rejected: "red",
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function KYCListPage() {
  const { t } = useTranslation("kyc");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<KYCListFilters["status"]>("all");

  const filters: KYCListFilters = useMemo(
    () => ({
      status: activeTab,
      per_page: 50,
    }),
    [activeTab]
  );

  const kycListQuery = useKYCList(filters);
  const submissions = kycListQuery.data?.results ?? [];

  const columns = useMemo(
    () => [
      {
        key: "id",
        header: t("columns.id"),
        render: (row: Record<string, unknown>) => {
          const id = String(row.id ?? "");
          return (
            <span className="font-mono text-xs text-gray-600">
              {id.slice(0, 8)}...
            </span>
          );
        },
      },
      {
        key: "ticket",
        header: t("columns.ticket"),
        render: (row: Record<string, unknown>) => {
          const ticket = String(row.ticket ?? "");
          return (
            <span className="font-mono text-xs text-gray-700">
              {ticket.slice(0, 8)}...
            </span>
          );
        },
      },
      {
        key: "status",
        header: t("columns.status"),
        render: (row: Record<string, unknown>) => {
          const status = row.status as KYCSubmission["status"];
          return (
            <Badge color={STATUS_BADGE_COLOR[status] ?? "gray"}>
              {t(`status.${status}`)}
            </Badge>
          );
        },
      },
      {
        key: "submitted_at",
        header: t("columns.submittedAt"),
        render: (row: Record<string, unknown>) =>
          formatDate(row.submitted_at as string | null),
      },
      {
        key: "created_at",
        header: t("columns.createdAt"),
        render: (row: Record<string, unknown>) =>
          formatDate(row.created_at as string),
      },
      {
        key: "actions",
        header: "",
        render: (row: Record<string, unknown>) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(
                ROUTES.KYC_DETAIL.replace(":id", String(row.id))
              );
            }}
          >
            {t("actions.view")}
          </Button>
        ),
      },
    ],
    [t, navigate]
  );

  const handleRowClick = (row: Record<string, unknown>) => {
    navigate(ROUTES.KYC_DETAIL.replace(":id", String(row.id)));
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("list.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("list.description")}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate(ROUTES.KYC_NEW)}
        >
          <svg
            className="mr-1.5 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          {t("list.newKYC")}
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          {STATUS_TABS.map((tab) => {
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
                      ? "border-arifa-navy text-arifa-navy"
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

      {/* Error State */}
      {kycListQuery.isError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("errors.loadListFailed")}
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={submissions as unknown as Record<string, unknown>[]}
          onRowClick={handleRowClick}
          loading={kycListQuery.isLoading}
          emptyMessage={t("list.empty")}
          keyExtractor={(row) => String(row.id)}
        />
      </div>

      {/* Pagination info */}
      {kycListQuery.data && (
        <div className="mt-4 text-sm text-gray-500">
          {t("list.showing", {
            count: submissions.length,
            total: kycListQuery.data.count,
          })}
        </div>
      )}
    </div>
  );
}
