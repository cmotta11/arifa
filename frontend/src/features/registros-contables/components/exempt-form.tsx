import { useTranslation } from "react-i18next";

interface ExemptFormProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function ExemptForm({ formData, onChange }: ExemptFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("registrosContables.formTypes.exempt_license.name")}
      </h3>
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          {t("registrosContables.guest.exemptDeclaration")}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t("registrosContables.guest.licenseNumber")}
          <span className="ml-1 text-xs text-gray-400">
            ({t("registrosContables.guest.optional")})
          </span>
        </label>
        <input
          type="text"
          value={(formData.license_number as string) || ""}
          onChange={(e) =>
            onChange({ ...formData, license_number: e.target.value })
          }
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder={t("registrosContables.guest.licenseNumberPlaceholder")}
        />
      </div>
    </div>
  );
}
