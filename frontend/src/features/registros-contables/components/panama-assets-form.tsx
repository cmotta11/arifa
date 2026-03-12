import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/config/countries";
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select";

interface PanamaAssetsFormProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  entityName?: string;
}

export function PanamaAssetsForm({ formData, onChange, entityName }: PanamaAssetsFormProps) {
  const { t } = useTranslation();

  const selected = (formData.asset_countries as string[]) || [];

  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
    [],
  );

  const handleCountryChange = (values: string[]) => {
    onChange({ ...formData, asset_countries: values });
  };

  return (
    <div className="space-y-5">
      {/* Formulario B header */}
      <div className="text-center space-y-1">
        <h3 className="text-sm font-bold text-gray-900 uppercase">
          {t("registrosContables.panamaAssets.formTitle")}
        </h3>
        <p className="text-sm font-semibold text-gray-900 uppercase">
          {t("registrosContables.panamaAssets.declarationTitle")}
        </p>
        <p className="text-xs font-medium text-gray-600 uppercase">
          {t("registrosContables.panamaAssets.subtitle")}
        </p>
      </div>

      {/* Entity name */}
      {entityName && (
        <div className="text-sm text-gray-700">
          <span className="font-medium">{t("registrosContables.panamaAssets.entityLabel")}:</span>{" "}
          <span className="underline">{entityName}</span>
        </div>
      )}

      {/* Intro paragraph */}
      <p className="text-sm text-gray-700 leading-relaxed">
        {t("registrosContables.panamaAssets.introText")}
      </p>

      {/* Requirement 1 — searchable country multi-select */}
      <div className="space-y-2">
        <p className="text-sm text-gray-700">
          <span className="font-medium">1.</span>{" "}
          {t("registrosContables.panamaAssets.requirement1")}
        </p>
        <div className="ml-4">
          <SearchableMultiSelect
            options={countryOptions}
            value={selected}
            onChange={handleCountryChange}
            placeholder={t("registrosContables.panamaAssets.searchCountries")}
          />
        </div>
      </div>

      {/* Requirement 2 */}
      <p className="text-sm text-gray-700">
        <span className="font-medium">2.</span>{" "}
        {t("registrosContables.panamaAssets.requirement2")}
      </p>

      {/* Requirement 3 */}
      <p className="text-sm text-gray-700">
        <span className="font-medium">3.</span>{" "}
        {t("registrosContables.panamaAssets.requirement3")}
      </p>
    </div>
  );
}
