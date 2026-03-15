import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronRightIcon, TrashIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";

interface BalanceGeneralFormProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

function getNum(obj: Record<string, unknown> | undefined, key: string): number {
  if (!obj) return 0;
  const val = obj[key];
  return typeof val === "number" ? val : Number(val) || 0;
}

interface SectionConfig {
  sectionKey: string;
  fields: string[];
}

const SECTIONS: SectionConfig[] = [
  { sectionKey: "assets", fields: ["cash", "investments_deposits", "fixed_assets", "other_assets"] },
  { sectionKey: "liabilities", fields: ["bank_debt", "other_liabilities"] },
  { sectionKey: "income", fields: ["interest", "dividends", "rent", "other_income"] },
];

export function BalanceGeneralForm({ formData, onChange }: BalanceGeneralFormProps) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    assets: true,
    liabilities: true,
    income: true,
  });
  const [showInstructions, setShowInstructions] = useState(false);

  const assets = (formData.assets as Record<string, unknown>) || {};
  const liabilities = (formData.liabilities as Record<string, unknown>) || {};
  const income = (formData.income as Record<string, unknown>) || {};

  const sectionData: Record<string, Record<string, unknown>> = { assets, liabilities, income };

  const totalAssets =
    getNum(assets, "cash") +
    getNum(assets, "investments_deposits") +
    getNum(assets, "fixed_assets") +
    getNum(assets, "other_assets");

  const totalLiabilities =
    getNum(liabilities, "bank_debt") + getNum(liabilities, "other_liabilities");

  const equity = totalAssets - totalLiabilities;

  const totalIncome =
    getNum(income, "interest") +
    getNum(income, "dividends") +
    getNum(income, "rent") +
    getNum(income, "other_income");

  const sectionTotals: Record<string, number> = {
    assets: totalAssets,
    liabilities: totalLiabilities,
    income: totalIncome,
  };

  const updateSection = (section: string, key: string, value: string) => {
    const current = (formData[section] as Record<string, unknown>) || {};
    onChange({
      ...formData,
      [section]: { ...current, [key]: value === "" ? 0 : Number(value) },
    });
  };

  const clearField = (section: string, key: string) => {
    const current = (formData[section] as Record<string, unknown>) || {};
    onChange({
      ...formData,
      [section]: { ...current, [key]: 0 },
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const tField = (key: string) => t(`registrosContables.balanceFields.${key}`);
  const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* Header with instructions toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          {t("registrosContables.formTypes.balance_general.name")}
        </h3>
        <div className="flex items-center gap-3">
          <a
            href="https://www.gacetaoficial.gob.pa/pdfTemp/29289_B/98388.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {t("registrosContables.balanceGeneral.faqLink")}
          </a>
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary"
          >
            <InformationCircleIcon className="h-4 w-4" />
            {t("registrosContables.balanceGeneral.instructions")}
          </button>
        </div>
      </div>

      {/* Instructions panel */}
      {showInstructions && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">{t("registrosContables.balanceGeneral.instructionsTitle")}</p>
          <ul className="list-disc ml-4 space-y-1 text-xs">
            <li>{t("registrosContables.balanceGeneral.instruction1")}</li>
            <li>{t("registrosContables.balanceGeneral.instruction2")}</li>
            <li>{t("registrosContables.balanceGeneral.instruction3")}</li>
            <li>{t("registrosContables.balanceGeneral.instruction4")}</li>
          </ul>
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map(({ sectionKey, fields }) => {
        const isExpanded = expandedSections[sectionKey] !== false;
        const data = sectionData[sectionKey] || {};

        return (
          <fieldset key={sectionKey} className="rounded-lg border border-gray-200">
            {/* Section header -- clickable to expand/collapse */}
            <button
              type="button"
              onClick={() => toggleSection(sectionKey)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                )}
                <legend className="text-sm font-medium text-gray-700">
                  {t(`registrosContables.balanceSections.${sectionKey}`)}
                </legend>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {fmt(sectionTotals[sectionKey] ?? 0)}
              </span>
            </button>

            {/* Section fields */}
            {isExpanded && (
              <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
                {fields.map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <label htmlFor={`${sectionKey}-${key}`} className="text-sm text-gray-600 w-48 shrink-0">
                      {tField(key)}
                    </label>
                    {/* Currency input with $ prefix — uses design system Input with custom padding */}
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3 text-gray-400 text-sm">
                        $
                      </span>
                      <Input
                        id={`${sectionKey}-${key}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={getNum(data, key) === 0 ? "" : getNum(data, key)}
                        onChange={(e) => updateSection(sectionKey, key, e.target.value)}
                        className="py-1.5 pl-7 pr-3"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => clearField(sectionKey, key)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title={t("common.clear")}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {/* Section subtotal */}
                <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                  <span className="text-sm font-medium text-gray-900">
                    {t(`registrosContables.balanceSections.total${sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}`)}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 pr-7">
                    {fmt(sectionTotals[sectionKey] ?? 0)}
                  </span>
                </div>
              </div>
            )}
          </fieldset>
        );
      })}

      {/* Equity (computed) */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-primary">
            {t("registrosContables.balanceSections.equity")}
          </span>
          <span className="text-sm font-bold text-primary">
            {fmt(equity)}
          </span>
        </div>
        <p className="mt-1 text-xs text-primary/70">
          {t("registrosContables.balanceGeneral.equityFormula")}
        </p>
      </div>
    </div>
  );
}
