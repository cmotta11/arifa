import { useTranslation } from "react-i18next";

const FORM_TYPES = [
  "no_operations",
  "panama_assets",
  "balance_general",
  "exempt_license",
] as const;

interface FormTypeSelectorProps {
  selected: string;
  onSelect: (formType: string) => void;
}

export function FormTypeSelector({ selected, onSelect }: FormTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("registrosContables.guest.selectFormType")}
      </h2>
      <p className="text-sm text-gray-500">
        {t("registrosContables.guest.selectFormTypeDescription")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FORM_TYPES.map((type) => {
          const isSelected = selected === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelect(type)}
              className={`
                rounded-lg border-2 p-5 text-left transition-all duration-150
                ${
                  isSelected
                    ? "border-arifa-navy bg-arifa-navy/5 ring-1 ring-arifa-navy"
                    : "border-gray-200 hover:border-arifa-navy/40 hover:bg-gray-50"
                }
              `}
            >
              <h3 className={`text-sm font-semibold ${isSelected ? "text-arifa-navy" : "text-gray-900"}`}>
                {t(`registrosContables.formTypes.${type}.name`)}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {t(`registrosContables.formTypes.${type}.description`)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
