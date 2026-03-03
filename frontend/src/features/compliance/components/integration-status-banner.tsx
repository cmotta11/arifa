import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-context";
import { useIntegrationStatus } from "../api/compliance-api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationWarning {
  key: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntegrationStatusBanner() {
  const { t } = useTranslation("compliance");
  const { user } = useAuth();
  const integrationQuery = useIntegrationStatus();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Only visible to compliance officers and directors
  const isComplianceRole =
    user?.role === "compliance_officer" || user?.role === "director";

  if (!isComplianceRole) return null;
  if (integrationQuery.isLoading || integrationQuery.isError) return null;
  if (!integrationQuery.data) return null;

  // Build list of warnings from integration status
  const warnings: IntegrationWarning[] = [];

  const integrations = integrationQuery.data;
  for (const [key, value] of Object.entries(integrations)) {
    if (!value.configured) {
      warnings.push({
        key,
        message: t("integration.notConfigured", {
          name: t(`integration.names.${key}`, { defaultValue: key.replace(/_/g, " ") }),
        }),
      });
    }
  }

  // Filter out dismissed warnings
  const activeWarnings = warnings.filter((w) => !dismissed.has(w.key));

  if (activeWarnings.length === 0) return null;

  function handleDismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {activeWarnings.map((warning) => (
        <div
          key={warning.key}
          className="flex items-center justify-between gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 flex-shrink-0 text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-yellow-800">{warning.message}</p>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(warning.key)}
            className="flex-shrink-0 rounded-md p-1 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-800"
            aria-label={t("integration.dismiss")}
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
