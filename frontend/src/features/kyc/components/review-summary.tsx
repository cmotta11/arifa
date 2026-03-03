import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { KYCSubmission, Party, RiskAssessment } from "@/types";
import type { KYCDocument } from "../api/kyc-api";

// ─── Props ──────────────────────────────────────────────────────────────────

interface ReviewSummaryProps {
  kyc: KYCSubmission;
  parties: Party[];
  documents: KYCDocument[];
  risk: RiskAssessment | null;
  onSubmit: () => void;
  isSubmitting: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_BADGE_COLOR: Record<string, "blue" | "green" | "yellow" | "gray" | "red"> = {
  ubo: "red",
  director: "blue",
  shareholder: "green",
  protector: "yellow",
  authorized_signatory: "gray",
};

const RISK_BADGE_COLOR: Record<string, "green" | "yellow" | "red"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

// ─── Validation Warnings ────────────────────────────────────────────────────

interface ValidationWarning {
  key: string;
  severity: "error" | "warning";
}

function useValidationWarnings(
  parties: Party[],
  documents: KYCDocument[]
): ValidationWarning[] {
  return useMemo(() => {
    const warnings: ValidationWarning[] = [];

    // Must have at least one party
    if (parties.length === 0) {
      warnings.push({ key: "review.warnings.noParties", severity: "error" });
    }

    // UBO/Shareholder ownership should sum to 100%
    const ubosAndShareholders = parties.filter(
      (p) => p.role === "ubo" || p.role === "shareholder"
    );
    if (ubosAndShareholders.length > 0) {
      const total = ubosAndShareholders.reduce(
        (sum, p) => sum + (p.ownership_percentage ?? 0),
        0
      );
      if (total !== 100) {
        warnings.push({
          key: "review.warnings.ownershipNotComplete",
          severity: "warning",
        });
      }
    }

    // Should have at least one document
    if (documents.length === 0) {
      warnings.push({
        key: "review.warnings.noDocuments",
        severity: "warning",
      });
    }

    // Check for PEP parties without extra review note
    const pepParties = parties.filter((p) => p.pep_status);
    if (pepParties.length > 0) {
      warnings.push({
        key: "review.warnings.pepPresent",
        severity: "warning",
      });
    }

    // Check for parties missing identification
    const missingId = parties.filter((p) => !p.identification_number);
    if (missingId.length > 0) {
      warnings.push({
        key: "review.warnings.missingId",
        severity: "error",
      });
    }

    return warnings;
  }, [parties, documents]);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ReviewSummary({
  kyc,
  parties,
  documents,
  risk,
  onSubmit,
  isSubmitting,
}: ReviewSummaryProps) {
  const { t } = useTranslation("kyc");
  const warnings = useValidationWarnings(parties, documents);

  const hasErrors = warnings.some((w) => w.severity === "error");
  const isDraft = kyc.status === "draft";
  const canSubmit = isDraft && !hasErrors;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("steps.review")}
      </h2>

      {/* Warnings / Validation */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning) => (
            <div
              key={warning.key}
              className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
                warning.severity === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-yellow-200 bg-yellow-50 text-yellow-800"
              }`}
            >
              <svg
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  warning.severity === "error"
                    ? "text-red-500"
                    : "text-yellow-500"
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{t(warning.key)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Entity Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t("review.entityInfo")}</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.kycId")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{kyc.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.ticket")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{kyc.ticket}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.status")}
            </dt>
            <dd className="mt-1">
              <Badge
                color={
                  kyc.status === "approved"
                    ? "green"
                    : kyc.status === "rejected"
                      ? "red"
                      : kyc.status === "draft"
                        ? "gray"
                        : "yellow"
                }
              >
                {t(`status.${kyc.status}`)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("fields.createdAt")}
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(kyc.created_at).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Parties Summary */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("review.parties")} ({parties.length})
          </CardTitle>
        </CardHeader>
        {parties.length === 0 ? (
          <p className="text-sm text-gray-500">{t("review.noParties")}</p>
        ) : (
          <div className="space-y-3">
            {parties.map((party) => (
              <div
                key={party.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {party.name}
                  </span>
                  <Badge color={ROLE_BADGE_COLOR[party.role] ?? "gray"}>
                    {t(`roles.${party.role}`)}
                  </Badge>
                  {party.pep_status && (
                    <Badge color="red">{t("party.pep")}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{party.nationality}</span>
                  {party.ownership_percentage != null && (
                    <span className="font-semibold">
                      {party.ownership_percentage}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Risk Assessment */}
      {risk && (
        <Card>
          <CardHeader>
            <CardTitle>{t("review.riskAssessment")}</CardTitle>
          </CardHeader>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">
                {risk.total_score}
              </p>
              <p className="text-xs text-gray-500">{t("risk.score")}</p>
            </div>
            <Badge
              color={RISK_BADGE_COLOR[risk.risk_level] ?? "gray"}
              className="text-sm"
            >
              {t(`risk.${risk.risk_level}`)}
            </Badge>
          </div>
          {risk.breakdown_json && Object.keys(risk.breakdown_json).length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("risk.breakdown")}
              </h4>
              <dl className="space-y-1">
                {Object.entries(risk.breakdown_json).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <dt className="text-gray-600">{key}</dt>
                    <dd className="font-medium text-gray-900">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>
      )}

      {/* Documents Summary */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("review.documents")} ({documents.length})
          </CardTitle>
        </CardHeader>
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">{t("review.noDocuments")}</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <span className="text-gray-700">{doc.file_name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Submit Button */}
      {isDraft && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {t("review.readyToSubmit")}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {canSubmit
                ? t("review.submitHint")
                : t("review.fixErrors")}
            </p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={onSubmit}
            loading={isSubmitting}
            disabled={!canSubmit}
          >
            {t("actions.submit")}
          </Button>
        </div>
      )}
    </div>
  );
}
