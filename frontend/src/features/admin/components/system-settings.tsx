import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useIntegrationStatus } from "@/features/compliance/api/compliance-api";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SystemSettings() {
  const { t } = useTranslation();
  const integrationQuery = useIntegrationStatus();

  return (
    <div className="space-y-6">
      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settings.integrationStatus")}</CardTitle>
        </CardHeader>

        {integrationQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        ) : integrationQuery.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("admin.settings.integrationError")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(integrationQuery.data ?? {}).map(
              ([key, integration]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-500">
                      {integration.status ?? integration.message ?? "-"}
                    </p>
                  </div>
                  <Badge
                    color={integration.configured ? "green" : "red"}
                  >
                    {integration.configured
                      ? t("admin.settings.connected")
                      : t("admin.settings.disconnected")}
                  </Badge>
                </div>
              ),
            )}
          </div>
        )}
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settings.systemInfo")}</CardTitle>
        </CardHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("admin.settings.backend")}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              Django REST Framework
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {t("admin.settings.database")}
            </p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              PostgreSQL
            </p>
          </div>
        </div>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settings.quickLinks")}</CardTitle>
        </CardHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a
            href="/admin/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {t("admin.settings.djangoAdmin")}
              </p>
              <p className="text-xs text-gray-500">
                {t("admin.settings.djangoAdminDesc")}
              </p>
            </div>
            <svg
              className="ml-auto h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>

          <a
            href="/api/v1/docs/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {t("admin.settings.apiDocs")}
              </p>
              <p className="text-xs text-gray-500">
                {t("admin.settings.apiDocsDesc")}
              </p>
            </div>
            <svg
              className="ml-auto h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>
        </div>
      </Card>
    </div>
  );
}
