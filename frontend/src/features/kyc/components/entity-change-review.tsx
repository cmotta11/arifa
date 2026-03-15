import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EntitySnapshot } from "@/features/guest-intake/api/guest-api";

interface EntityChangeReviewProps {
  snapshot: EntitySnapshot;
  proposedData: Record<string, unknown>;
  fieldComments: Record<string, string>;
  onApprove: (modifiedData?: Record<string, unknown>) => void;
  onSendBack: (comments: Record<string, string>) => void;
  isApproving: boolean;
  isSendingBack: boolean;
}

export function EntityChangeReview({
  snapshot,
  proposedData,
  fieldComments: existingComments,
  onApprove,
  onSendBack,
  isApproving,
  isSendingBack,
}: EntityChangeReviewProps) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<Record<string, string>>(existingComments);
  const [showSendBack, setShowSendBack] = useState(false);

  const proposedGeneral = (proposedData.general ?? {}) as Record<string, unknown>;
  const proposedOfficers = (proposedData.officers ?? []) as Array<Record<string, unknown>>;
  const proposedShareClasses = (proposedData.share_classes ?? []) as Array<Record<string, unknown>>;
  const proposedActivities = (proposedData.activities ?? []) as Array<Record<string, unknown>>;
  const proposedSof = (proposedData.sources_of_funds ?? []) as Array<Record<string, unknown>>;

  const handleSendBack = () => {
    const nonEmpty = Object.fromEntries(
      Object.entries(comments).filter(([, v]) => v.trim() !== "")
    );
    onSendBack(nonEmpty);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
        {t("kyc.review.proposedChanges")}
      </div>

      {/* General Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("guest.steps.general")}</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <DiffRow
            label={t("entities.form.name")}
            current={snapshot.general.name}
            proposed={proposedGeneral.name as string | undefined}
          />
          <DiffRow
            label={t("entities.form.incorporationDate")}
            current={snapshot.general.incorporation_date ?? "—"}
            proposed={proposedGeneral.incorporation_date as string | undefined}
          />
          <DiffRow
            label={t("entities.form.jurisdiction")}
            current={snapshot.general.jurisdiction.toUpperCase()}
          />
          <DiffRow
            label={t("entities.form.status")}
            current={snapshot.general.status}
          />
        </div>
      </Card>

      {/* Officers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("guest.steps.officers")}</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{t("kyc.review.currentValue")}</p>
              {snapshot.officers.length === 0 ? (
                <p className="text-sm text-gray-400">—</p>
              ) : (
                snapshot.officers.map((o) => (
                  <div key={o.id} className="mb-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <span className="font-medium">{o.officer_person?.full_name ?? o.officer_entity_name ?? "—"}</span>
                    <span className="ml-2 text-gray-500">{o.positions.join(", ")}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{t("kyc.review.proposedValue")}</p>
              {proposedOfficers.length === 0 ? (
                <p className="text-sm text-gray-400">{t("kyc.review.noChanges")}</p>
              ) : (
                proposedOfficers.map((o, idx) => {
                  const person = o.officer_person as { full_name: string } | null;
                  return (
                    <div key={idx} className="mb-1 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm">
                      <span className="font-medium">{person?.full_name ?? (o.officer_entity_name as string) ?? "—"}</span>
                      <span className="ml-2 text-gray-500">{((o.positions as string[]) ?? []).join(", ")}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Share Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("guest.steps.shares")}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{t("kyc.review.currentValue")}</p>
            <p className="text-sm text-gray-600">{snapshot.share_classes.length} {t("guest.review.classes")}</p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{t("kyc.review.proposedValue")}</p>
            <p className="text-sm text-gray-600">
              {proposedShareClasses.length > 0 ? `${proposedShareClasses.length} ${t("guest.review.classes")}` : t("kyc.review.noChanges")}
            </p>
          </div>
        </div>
      </Card>

      {/* Risk Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("guest.steps.riskProfile")}</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{t("kyc.review.currentValue")}</p>
            <p className="text-sm text-gray-600">
              {snapshot.activities.length} {t("entities.activities.title").toLowerCase()}, {snapshot.sources_of_funds.length} {t("entities.sourcesOfFunds.title").toLowerCase()}
            </p>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{t("kyc.review.proposedValue")}</p>
            <p className="text-sm text-gray-600">
              {proposedActivities.length > 0 || proposedSof.length > 0
                ? `${proposedActivities.length} ${t("entities.activities.title").toLowerCase()}, ${proposedSof.length} ${t("entities.sourcesOfFunds.title").toLowerCase()}`
                : t("kyc.review.noChanges")}
            </p>
          </div>
        </div>
      </Card>

      {/* Send-back comment form */}
      {showSendBack && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("kyc.review.addComment")}</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {["general.name", "general.incorporation_date", "officers", "shares", "risk_profile"].map((fieldKey) => (
              <div key={fieldKey}>
                <label className="text-xs font-medium text-gray-600">{fieldKey}</label>
                <Input
                  value={comments[fieldKey] ?? ""}
                  onChange={(e) => setComments((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                  placeholder={t("kyc.review.commentPlaceholder")}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSendBack(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="secondary" onClick={handleSendBack} loading={isSendingBack}>
              {t("kyc.review.sendBack")}
            </Button>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      {!showSendBack && (
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowSendBack(true)}>
            {t("kyc.review.sendBack")}
          </Button>
          <Button variant="primary" onClick={() => onApprove()} loading={isApproving}>
            {t("kyc.review.approve")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Diff Row Helper ───────────────────────────────────────────────────────

function DiffRow({
  label,
  current,
  proposed,
}: {
  label: string;
  current: string;
  proposed?: string | null;
}) {
  const hasChange = proposed !== undefined && proposed !== null && proposed !== current;

  return (
    <div className="flex items-start gap-4">
      <span className="w-40 shrink-0 text-sm text-gray-500">{label}</span>
      <div className="flex-1">
        {hasChange ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 line-through">{current || "—"}</span>
            <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-sm font-medium text-yellow-800">{proposed || "—"}</span>
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-900">{current || "—"}</span>
        )}
      </div>
    </div>
  );
}
