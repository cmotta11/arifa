import { useTranslation } from "react-i18next";

interface MethodSelectorProps {
  selected: string;
  onSelect: (method: "upload_information" | "seven_steps") => void;
}

export function MethodSelector({ selected, onSelect }: MethodSelectorProps) {
  const { t } = useTranslation();

  const methods = [
    {
      key: "upload_information" as const,
      icon: (
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
      ),
    },
    {
      key: "seven_steps" as const,
      icon: (
        <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {t("registrosContables.methodSelector.title")}
      </h2>
      <p className="text-sm text-gray-500">
        {t("registrosContables.methodSelector.description")}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {methods.map((m) => {
          const isSelected = selected === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={`
                flex flex-col items-center rounded-xl border-2 p-6 text-center transition-all duration-150
                ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-md"
                    : "border-gray-200 hover:border-primary/40 hover:bg-gray-50 hover:shadow-sm"
                }
              `}
            >
              <div className={`mb-3 ${isSelected ? "text-primary" : "text-gray-400"}`}>
                {m.icon}
              </div>
              <h3 className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-gray-900"}`}>
                {t(`registrosContables.methodSelector.${m.key}.title`)}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {t(`registrosContables.methodSelector.${m.key}.description`)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
