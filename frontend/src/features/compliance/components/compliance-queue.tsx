import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/navigation/tabs";
import { EmptyState } from "@/components/data-display/empty-state";
import { useDebounce } from "@/hooks/use-debounce";
import { useComplianceQueue, type KYCDetail } from "../api/compliance-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusColorMap: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  draft: "gray",
  submitted: "blue",
  under_review: "yellow",
  approved: "green",
  rejected: "red",
};

const riskColorMap: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplianceQueueProps {
  selectedKycId: string | null;
  onSelectKyc: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComplianceQueue({ selectedKycId, onSelectKyc }: ComplianceQueueProps) {
  const { t } = useTranslation("compliance");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 300);

  const apiStatus = statusFilter === "all" ? undefined : statusFilter;
  const queueQuery = useComplianceQueue(apiStatus);

  const tabs = [
    { key: "all", label: t("queue.allStatuses") },
    { key: "submitted", label: t("queue.submitted") },
    { key: "under_review", label: t("queue.underReview") },
  ];

  // Sort: under_review first, then submitted, then oldest first within groups
  const sortedAndFiltered = useMemo(() => {
    const items = queueQuery.data ?? [];

    const filtered = debouncedSearch
      ? items.filter((item) => {
          const term = debouncedSearch.toLowerCase();
          const entityName = item.ticket_detail?.entity?.name?.toLowerCase() ?? "";
          const clientName = item.ticket_detail?.client?.name?.toLowerCase() ?? "";
          const id = item.id.toLowerCase();
          return entityName.includes(term) || clientName.includes(term) || id.includes(term);
        })
      : items;

    const statusOrder: Record<string, number> = {
      under_review: 0,
      submitted: 1,
      draft: 2,
      approved: 3,
      rejected: 4,
    };

    return [...filtered].sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      // Oldest first within same status group
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [queueQuery.data, debouncedSearch]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("queue.title")}
        </h2>
        <p className="text-sm text-gray-500">
          {t("queue.subtitle", { count: sortedAndFiltered.length })}
        </p>
      </div>

      {/* Status Tabs */}
      <Tabs tabs={tabs} activeTab={statusFilter} onChange={setStatusFilter} className="mb-4" />

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder={t("queue.searchPlaceholder")}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* Queue List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {queueQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : queueQuery.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
            {t("common.errorLoading")}
          </div>
        ) : sortedAndFiltered.length === 0 ? (
          <EmptyState
            title={t("queue.empty")}
            description={t("queue.emptyDescription")}
          />
        ) : (
          <ul className="space-y-2">
            {sortedAndFiltered.map((kyc) => (
              <QueueItem
                key={kyc.id}
                kyc={kyc}
                isSelected={selectedKycId === kyc.id}
                onSelect={() => onSelectKyc(kyc.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue Item
// ---------------------------------------------------------------------------

interface QueueItemProps {
  kyc: KYCDetail;
  isSelected: boolean;
  onSelect: () => void;
}

function QueueItem({ kyc, isSelected, onSelect }: QueueItemProps) {
  const { t } = useTranslation("compliance");

  const entityName = kyc.ticket_detail?.entity?.name ?? t("queue.noEntity");
  const clientName = kyc.ticket_detail?.client?.name ?? t("queue.noClient");
  const jurisdiction = kyc.ticket_detail?.entity?.jurisdiction?.toUpperCase() ?? "";

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`
          w-full rounded-lg border bg-white p-4 text-left transition-all duration-100
          hover:shadow-md
          ${
            isSelected
              ? "border-arifa-navy ring-2 ring-arifa-navy/30 shadow-md"
              : "border-gray-200 hover:border-gray-300"
          }
        `}
      >
        {/* Top Row: Entity + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {entityName}
            </p>
            <p className="truncate text-xs text-gray-500">{clientName}</p>
          </div>
          <Badge color={statusColorMap[kyc.status] ?? "gray"}>
            {t(`status.${kyc.status}`)}
          </Badge>
        </div>

        {/* Bottom Row: Meta info */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          {jurisdiction && (
            <span className="inline-flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {jurisdiction}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(kyc.submitted_at ?? kyc.created_at)}
          </span>
          <span className="ml-auto font-mono text-xs text-gray-400">
            {kyc.id.slice(0, 8)}
          </span>
        </div>
      </button>
    </li>
  );
}
