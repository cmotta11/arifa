import { useTranslation } from "react-i18next";

interface BalanceGeneralFormProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

function getNum(obj: Record<string, unknown> | undefined, key: string): number {
  if (!obj) return 0;
  const val = obj[key];
  return typeof val === "number" ? val : Number(val) || 0;
}

export function BalanceGeneralForm({ formData, onChange }: BalanceGeneralFormProps) {
  const { t } = useTranslation();

  const assets = (formData.assets as Record<string, unknown>) || {};
  const liabilities = (formData.liabilities as Record<string, unknown>) || {};
  const income = (formData.income as Record<string, unknown>) || {};

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

  const updateSection = (section: string, key: string, value: string) => {
    const current = (formData[section] as Record<string, unknown>) || {};
    onChange({
      ...formData,
      [section]: { ...current, [key]: value === "" ? 0 : Number(value) },
    });
  };

  const tField = (key: string) => t(`registrosContables.balanceFields.${key}`);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("registrosContables.formTypes.balance_general.name")}
      </h3>

      {/* Assets */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">
          {t("registrosContables.balanceSections.assets")}
        </legend>
        {(["cash", "investments_deposits", "fixed_assets", "other_assets"] as const).map(
          (key) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label htmlFor={`assets-${key}`} className="text-sm text-gray-600 w-48">{tField(key)}</label>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">
                  $
                </span>
                <input
                  id={`assets-${key}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={getNum(assets, key) === 0 ? "" : getNum(assets, key)}
                  onChange={(e) => updateSection("assets", key, e.target.value)}
                  className="w-full rounded-md border border-gray-300 py-1.5 pl-7 pr-3 text-sm focus:border-arifa-navy focus:ring-1 focus:ring-arifa-navy"
                  placeholder="0.00"
                />
              </div>
            </div>
          ),
        )}
        <div className="flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-medium text-gray-900">
            {t("registrosContables.balanceSections.totalAssets")}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            ${totalAssets.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </fieldset>

      {/* Liabilities */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">
          {t("registrosContables.balanceSections.liabilities")}
        </legend>
        {(["bank_debt", "other_liabilities"] as const).map((key) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <label htmlFor={`liabilities-${key}`} className="text-sm text-gray-600 w-48">{tField(key)}</label>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">
                $
              </span>
              <input
                id={`liabilities-${key}`}
                type="number"
                min="0"
                step="0.01"
                value={getNum(liabilities, key) === 0 ? "" : getNum(liabilities, key)}
                onChange={(e) => updateSection("liabilities", key, e.target.value)}
                className="w-full rounded-md border border-gray-300 py-1.5 pl-7 pr-3 text-sm focus:border-arifa-navy focus:ring-1 focus:ring-arifa-navy"
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-medium text-gray-900">
            {t("registrosContables.balanceSections.totalLiabilities")}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            ${totalLiabilities.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </fieldset>

      {/* Equity (computed) */}
      <div className="rounded-md border border-arifa-navy/20 bg-arifa-navy/5 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-arifa-navy">
            {t("registrosContables.balanceSections.equity")}
          </span>
          <span className="text-sm font-bold text-arifa-navy">
            ${equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Income */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">
          {t("registrosContables.balanceSections.income")}
        </legend>
        {(["interest", "dividends", "rent", "other_income"] as const).map((key) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <label htmlFor={`income-${key}`} className="text-sm text-gray-600 w-48">{tField(key)}</label>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 text-sm">
                $
              </span>
              <input
                id={`income-${key}`}
                type="number"
                min="0"
                step="0.01"
                value={getNum(income, key) === 0 ? "" : getNum(income, key)}
                onChange={(e) => updateSection("income", key, e.target.value)}
                className="w-full rounded-md border border-gray-300 py-1.5 pl-7 pr-3 text-sm focus:border-arifa-navy focus:ring-1 focus:ring-arifa-navy"
                placeholder="0.00"
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-medium text-gray-900">
            {t("registrosContables.balanceSections.totalIncome")}
          </span>
          <span className="text-sm font-semibold text-gray-900">
            ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </fieldset>
    </div>
  );
}
