import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import type { Party, WorldCheckCase } from "@/types";
import {
  useKYCParties,
  useWorldCheckResults,
  useScreenParty,
  useResolveWorldCheck,
  useIntegrationStatus,
} from "../api/compliance-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ScreeningStatus = WorldCheckCase["screening_status"];

const screeningBadgeColor: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  pending: "gray",
  clear: "green",
  matched: "red",
  false_positive: "yellow",
  true_match: "red",
  escalated: "yellow",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorldCheckPanelProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorldCheckPanel({ kycId }: WorldCheckPanelProps) {
  const { t } = useTranslation("compliance");
  const partiesQuery = useKYCParties(kycId);
  const integrationQuery = useIntegrationStatus();

  const isMockMode =
    integrationQuery.data && !integrationQuery.data.worldcheck?.configured;

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
          {t("worldCheck.errorLoading")}
        </div>
      </Card>
    );
  }

  const parties = partiesQuery.data ?? [];

  if (parties.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("worldCheck.title")}</CardTitle>
        </CardHeader>
        <p className="py-6 text-center text-sm text-gray-500">
          {t("worldCheck.noParties")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mock data warning */}
      {isMockMode && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{t("worldCheck.mockDataWarning")}</span>
        </div>
      )}

      {parties.map((party) => (
        <PartyScreeningCard key={party.id} party={party} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Party Screening Card
// ---------------------------------------------------------------------------

function PartyScreeningCard({ party }: { party: Party }) {
  const { t } = useTranslation("compliance");
  const screenMutation = useScreenParty();
  const worldCheckQuery = useWorldCheckResults(party.id);
  const resolveMutation = useResolveWorldCheck();

  const [showResolveConfirm, setShowResolveConfirm] = useState<
    "false_positive" | "true_match" | null
  >(null);

  const wcCase = worldCheckQuery.data;
  const hasResults = !!wcCase;
  const isScreening = screenMutation.isPending;

  function handleScreen() {
    screenMutation.mutate(party.id);
  }

  function handleResolve(resolution: "false_positive" | "true_match") {
    resolveMutation.mutate(
      { partyId: party.id, resolution },
      { onSuccess: () => setShowResolveConfirm(null) },
    );
  }

  return (
    <Card>
      {/* Party Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">{party.name}</h4>
            <Badge color="gray">{party.role}</Badge>
            {party.pep_status && (
              <Badge color="red">{t("worldCheck.pep")}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {party.nationality} &middot; {party.party_type}
            {party.identification_number && ` &middot; ${party.identification_number}`}
          </p>
        </div>

        {/* Screen button */}
        <Button
          variant="secondary"
          size="sm"
          loading={isScreening}
          onClick={handleScreen}
        >
          {hasResults ? t("worldCheck.rescreen") : t("worldCheck.screen")}
        </Button>
      </div>

      {/* Loading state for results */}
      {worldCheckQuery.isLoading && (
        <div className="mt-4 flex items-center justify-center py-4">
          <Spinner size="sm" />
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t("worldCheck.status")}:</span>
            <ScreeningStatusBadge status={wcCase.screening_status as ScreeningStatus} />
            {wcCase.screening_status === "clear" && (
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          {/* Last screened */}
          {wcCase.last_screened_at && (
            <p className="mt-1 text-xs text-gray-500">
              {t("worldCheck.lastScreened")}:{" "}
              {new Date(wcCase.last_screened_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}

          {/* Ongoing monitoring */}
          {wcCase.ongoing_monitoring_enabled && (
            <p className="mt-1 text-xs text-green-700">
              {t("worldCheck.ongoingMonitoring")}
            </p>
          )}

          {/* Match Data */}
          {wcCase.screening_status === "matched" &&
            Object.keys(wcCase.match_data_json).length > 0 && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
                <h5 className="mb-2 text-sm font-medium text-red-800">
                  {t("worldCheck.matchDetails")}
                </h5>
                <dl className="space-y-1">
                  {Object.entries(wcCase.match_data_json).map(([key, value]) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <dt className="min-w-[120px] font-medium text-red-700">
                        {key.replace(/_/g, " ")}:
                      </dt>
                      <dd className="text-red-600">{String(value)}</dd>
                    </div>
                  ))}
                </dl>

                {/* Resolve actions */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowResolveConfirm("false_positive")}
                  >
                    {t("worldCheck.falsePositive")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowResolveConfirm("true_match")}
                  >
                    {t("worldCheck.trueMatch")}
                  </Button>
                </div>
              </div>
            )}

          {/* Resolution info */}
          {(wcCase.screening_status === "false_positive" ||
            wcCase.screening_status === "true_match") &&
            wcCase.resolved_at && (
              <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm text-gray-700">
                  {t("worldCheck.resolvedAs")}:{" "}
                  <span className="font-medium">
                    {t(`worldCheck.${wcCase.screening_status}`)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(wcCase.resolved_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {wcCase.resolved_by && ` - ${wcCase.resolved_by}`}
                </p>
              </div>
            )}
        </div>
      )}

      {/* No results yet (not loading, no error, not screened) */}
      {!hasResults && !worldCheckQuery.isLoading && !worldCheckQuery.isError && (
        <p className="mt-3 text-xs text-gray-400">
          {t("worldCheck.notScreened")}
        </p>
      )}

      {/* Resolve Confirm Dialog */}
      {showResolveConfirm && (
        <ConfirmDialog
          isOpen={true}
          title={
            showResolveConfirm === "false_positive"
              ? t("worldCheck.confirmFalsePositiveTitle")
              : t("worldCheck.confirmTrueMatchTitle")
          }
          message={
            showResolveConfirm === "false_positive"
              ? t("worldCheck.confirmFalsePositiveMessage", { name: party.name })
              : t("worldCheck.confirmTrueMatchMessage", { name: party.name })
          }
          confirmLabel={
            showResolveConfirm === "false_positive"
              ? t("worldCheck.falsePositive")
              : t("worldCheck.trueMatch")
          }
          cancelLabel={t("actions.cancel")}
          variant={showResolveConfirm === "true_match" ? "danger" : "primary"}
          loading={resolveMutation.isPending}
          onConfirm={() => handleResolve(showResolveConfirm)}
          onCancel={() => setShowResolveConfirm(null)}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Screening Status Badge
// ---------------------------------------------------------------------------

function ScreeningStatusBadge({ status }: { status: ScreeningStatus }) {
  const { t } = useTranslation("compliance");
  return (
    <Badge color={screeningBadgeColor[status] ?? "gray"}>
      {t(`screeningStatus.${status}`, { defaultValue: status.replace(/_/g, " ") })}
    </Badge>
  );
}
