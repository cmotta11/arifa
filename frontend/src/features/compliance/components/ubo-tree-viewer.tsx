import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { Party } from "@/types";
import { useKYCParties } from "../api/compliance-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PartyCategory = "shareholders" | "directors" | "other";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const roleToCategory: Record<string, PartyCategory> = {
  shareholder: "shareholders",
  ubo: "shareholders",
  beneficial_owner: "shareholders",
  director: "directors",
  officer: "directors",
  secretary: "directors",
  registered_agent: "other",
  protector: "other",
  trustee: "other",
  settlor: "other",
  beneficiary: "other",
};

function categorizeParties(parties: Party[]) {
  const shareholders: Party[] = [];
  const directors: Party[] = [];
  const other: Party[] = [];

  for (const party of parties) {
    const category = roleToCategory[party.role.toLowerCase()] ?? "other";
    switch (category) {
      case "shareholders":
        shareholders.push(party);
        break;
      case "directors":
        directors.push(party);
        break;
      default:
        other.push(party);
    }
  }

  return { shareholders, directors, other };
}

function getOwnershipColor(pct: number | null): string {
  if (pct === null) return "bg-gray-300";
  if (pct >= 25) return "bg-red-500";
  if (pct >= 10) return "bg-yellow-500";
  return "bg-green-500";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UBOTreeViewerProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UBOTreeViewer({ kycId }: UBOTreeViewerProps) {
  const { t } = useTranslation("compliance");
  const partiesQuery = useKYCParties(kycId);

  const { shareholders, directors, other, totalOwnership } = useMemo(() => {
    const parties = partiesQuery.data ?? [];
    const categorized = categorizeParties(parties);
    const total = categorized.shareholders.reduce(
      (sum, p) => sum + (p.ownership_percentage ?? 0),
      0,
    );
    return { ...categorized, totalOwnership: total };
  }, [partiesQuery.data]);

  if (partiesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (partiesQuery.isError) {
    return (
      <Card>
        <div className="py-6 text-center text-sm text-error">
          {t("parties.errorLoading")}
        </div>
      </Card>
    );
  }

  if ((partiesQuery.data ?? []).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("parties.title")}</CardTitle>
        </CardHeader>
        <p className="py-6 text-center text-sm text-gray-500">
          {t("parties.empty")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* UBO / Shareholders Tree */}
      {shareholders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("parties.shareholdersTitle")}</CardTitle>
            <TotalOwnershipIndicator total={totalOwnership} />
          </CardHeader>

          {/* Tree Structure */}
          <div className="relative">
            {/* Root node (Entity) */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-primary/5 px-4 py-2">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm font-semibold text-primary">
                  {t("parties.entity")}
                </span>
              </div>
            </div>

            {/* Connecting line from root */}
            <div className="flex justify-center">
              <div className="h-6 w-0.5 bg-gray-300" />
            </div>

            {/* Horizontal connector */}
            {shareholders.length > 1 && (
              <div className="mx-auto" style={{ width: `${Math.min(shareholders.length * 220, 880)}px` }}>
                <div className="h-0.5 bg-gray-300" />
              </div>
            )}

            {/* Shareholder nodes */}
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              {shareholders.map((party) => (
                <div key={party.id} className="flex flex-col items-center">
                  {/* Vertical connector to horizontal line */}
                  {shareholders.length > 1 && (
                    <div className="h-4 w-0.5 bg-gray-300" />
                  )}
                  <PartyNode party={party} showOwnership />
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Directors Section */}
      {directors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("parties.directorsTitle")}</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {directors.map((party) => (
              <PartyNode key={party.id} party={party} />
            ))}
          </div>
        </Card>
      )}

      {/* Other Parties */}
      {other.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("parties.otherTitle")}</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {other.map((party) => (
              <PartyNode key={party.id} party={party} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Party Node
// ---------------------------------------------------------------------------

function PartyNode({
  party,
  showOwnership = false,
}: {
  party: Party;
  showOwnership?: boolean;
}) {
  const { t } = useTranslation("compliance");
  const ownershipPct = party.ownership_percentage;

  return (
    <div className="w-full max-w-[240px] rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Party Type Icon + Name */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex-shrink-0">
          {party.party_type === "natural" ? (
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {party.name}
          </p>
          <p className="truncate text-xs text-gray-500">{party.nationality}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge color="blue">{party.role}</Badge>
        {party.pep_status && (
          <Badge color="red">{t("parties.pep")}</Badge>
        )}
        {party.party_type === "corporate" && (
          <Badge color="gray">{t("parties.corporate")}</Badge>
        )}
      </div>

      {/* Ownership percentage */}
      {showOwnership && ownershipPct !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-500">{t("parties.ownership")}</span>
            <span className="font-semibold text-gray-900">{ownershipPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${getOwnershipColor(ownershipPct)}`}
              style={{ width: `${Math.min(ownershipPct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Total Ownership Indicator
// ---------------------------------------------------------------------------

function TotalOwnershipIndicator({ total }: { total: number }) {
  const { t } = useTranslation("compliance");
  const isComplete = Math.abs(total - 100) < 0.01;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">
        {t("parties.totalOwnership")}:
      </span>
      <span
        className={`text-sm font-semibold ${
          isComplete ? "text-green-700" : "text-yellow-700"
        }`}
      >
        {total.toFixed(1)}%
      </span>
      {isComplete ? (
        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
    </div>
  );
}
