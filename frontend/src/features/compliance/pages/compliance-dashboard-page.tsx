import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/data-display/empty-state";
import { StatCard } from "@/components/data-display/stat-card";
import { useComplianceQueue } from "../api/compliance-api";
import { useRiskStats } from "../api/risk-matrix-api";
import { IntegrationStatusBanner } from "../components/integration-status-banner";
import { ComplianceQueue } from "../components/compliance-queue";
import { KYCReviewPanel } from "../components/kyc-review-panel";
import { ROUTES } from "@/config/routes";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ComplianceDashboardPage() {
  const { t } = useTranslation("compliance");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected KYC from URL or local state
  const selectedKycId = searchParams.get("kyc") ?? null;

  function handleSelectKyc(id: string) {
    setSearchParams({ kyc: id });
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Integration Status Banners */}
      <IntegrationStatusBanner />

      {/* Page Title */}
      <div className="mb-6 mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("dashboard.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(ROUTES.RISK_MATRIX)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("riskMatrix.config.title", { ns: "common" })}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.COMPLIANCE_SNAPSHOTS)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("riskMatrix.snapshots.title", { ns: "common" })}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar />

      {/* Main Content: Two Column Layout */}
      <div className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left Column: Queue (40%) */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <ComplianceQueue
            selectedKycId={selectedKycId}
            onSelectKyc={handleSelectKyc}
          />
        </div>

        {/* Right Column: Review Panel (60%) */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-3">
          {selectedKycId ? (
            <KYCReviewPanel kycId={selectedKycId} />
          ) : (
            <EmptyState
              title={t("dashboard.noSelection")}
              description={t("dashboard.noSelectionDescription")}
              icon={
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Bar
// ---------------------------------------------------------------------------

function StatsBar() {
  const { t } = useTranslation("compliance");

  // Fetch queue data to compute stats
  const queueQuery = useComplianceQueue();
  const riskStatsQuery = useRiskStats();
  const allItems = queueQuery.data ?? [];

  const totalPending = allItems.length;
  const highRiskCount = riskStatsQuery.data?.high_risk_count ?? 0;
  const submittedCount = allItems.filter((k) => k.status === "submitted").length;
  const underReviewCount = allItems.filter((k) => k.status === "under_review").length;

  if (queueQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("stats.totalPending")}
        value={totalPending}
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />
      <StatCard
        label={t("stats.submitted")}
        value={submittedCount}
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
      <StatCard
        label={t("stats.underReview")}
        value={underReviewCount}
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        }
      />
      <StatCard
        label={t("stats.highRisk")}
        value={highRiskCount}
        icon={
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
      />
    </div>
  );
}
