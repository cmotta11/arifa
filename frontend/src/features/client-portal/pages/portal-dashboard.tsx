import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { usePortalKYCList } from "../api/portal-api";
import { kycStatusColorMap } from "@/config/status-colors";

export default function PortalDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const kycQuery = usePortalKYCList();

  const displayName =
    user?.first_name || user?.client_name || user?.email || "";

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">
        {t("portal.welcome", { name: displayName })}
      </h1>
      <p className="mt-1 text-sm text-gray-500">{t("portal.title")}</p>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {t("portal.kycList.title")}
        </h2>

        {kycQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {kycQuery.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("common.error")}
          </div>
        )}

        {kycQuery.data && kycQuery.data.results.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
            <p className="text-sm text-gray-500">
              {t("portal.kycList.empty")}
            </p>
          </div>
        )}

        {kycQuery.data && kycQuery.data.results.length > 0 && (
          <div className="space-y-3">
            {kycQuery.data.results.map((kyc) => (
              <Card
                key={kyc.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() =>
                  navigate(
                    ROUTES.CLIENT_PORTAL_KYC_DETAIL.replace(":id", kyc.id)
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      KYC #{kyc.id.slice(0, 8)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(kyc.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge color={kycStatusColorMap[kyc.status] ?? "gray"}>
                    {kyc.status.replace("_", " ")}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
