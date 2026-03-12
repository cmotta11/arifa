import { useTranslation } from "react-i18next";

export function NoOperationsForm() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("registrosContables.formTypes.no_operations.name")}
      </h3>
      <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-700 leading-relaxed">
          {t("registrosContables.guest.noOperationsDeclaration")}
        </p>
      </div>
    </div>
  );
}
