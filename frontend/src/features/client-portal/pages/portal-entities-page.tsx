import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import { usePortalEntities } from "../api/portal-api";

const entityStatusColor: Record<string, "gray" | "green" | "yellow" | "red" | "blue"> = {
  pending: "yellow",
  active: "green",
  dissolved: "gray",
  struck_off: "red",
};

const riskLevelColor: Record<string, "green" | "yellow" | "red" | "gray"> = {
  low: "green",
  medium: "yellow",
  high: "red",
};

export default function PortalEntitiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const entitiesQuery = usePortalEntities();
  const [search, setSearch] = useState("");

  const entities = entitiesQuery.data?.results ?? [];
  const filtered = entities.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.jurisdiction.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">
        {t("portal.entities.title")}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("portal.entities.description")}
      </p>

      <div className="mt-6 max-w-sm">
        <Input
          placeholder={t("portal.entities.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mt-6">
        {entitiesQuery.isLoading && (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {entitiesQuery.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {t("common.error")}
          </div>
        )}

        {entitiesQuery.data && filtered.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
            <p className="text-sm text-gray-500">
              {t("portal.entities.empty")}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((entity) => (
              <Card
                key={entity.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() =>
                  navigate(
                    ROUTES.CLIENT_PORTAL_ENTITY_DETAIL.replace(":id", entity.id),
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {entity.name}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                      <span className="capitalize">{entity.entity_type}</span>
                      <span>&middot;</span>
                      <span className="uppercase">{entity.jurisdiction}</span>
                      {entity.incorporation_date && (
                        <>
                          <span>&middot;</span>
                          <span>
                            {new Date(entity.incorporation_date).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {entity.current_risk_level && (
                      <Badge color={riskLevelColor[entity.current_risk_level] ?? "gray"}>
                        {t(`riskLevels.${entity.current_risk_level}`)}
                      </Badge>
                    )}
                    <Badge color={entityStatusColor[entity.status] ?? "gray"}>
                      {entity.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                {/* Compliance status row */}
                <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3">
                  {entity.kyc_status && (
                    <span className="text-xs text-gray-500">
                      <span className="font-medium">{t("portal.entities.kyc")}:</span>{" "}
                      {entity.kyc_status.replace("_", " ")}
                    </span>
                  )}
                  {entity.es_status && (
                    <span className="text-xs text-gray-500">
                      <span className="font-medium">{t("portal.entities.es")}:</span>{" "}
                      {entity.es_status.replace("_", " ")}
                    </span>
                  )}
                  {entity.ar_status && (
                    <span className="text-xs text-gray-500">
                      <span className="font-medium">{t("portal.entities.ar")}:</span>{" "}
                      {entity.ar_status.replace("_", " ")}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
