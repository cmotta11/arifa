import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ESShareholdersManager } from "./es-shareholders-manager";
import { ESAttentionScreen } from "./es-attention-screen";

// ─── Flow Step Config ───────────────────────────────────────────────────────

export interface FlowStepConfig {
  key: string;
  label: string;
  description?: string;
  type: "multi_select" | "yes_no" | "country_select" | "shareholders_list" | "terminal";
  options?: { value: string; label: string }[];
  noneOption?: string;
  terminalType?: "completed" | "attention";
}

interface ESQuestionRendererProps {
  step: FlowStepConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  attentionReason?: string;
  entityName?: string;
  shareholdersData?: Array<{ name: string; type: string; percentage: number; person_id?: string }>;
  onShareholdersChange?: (data: Array<{ name: string; type: string; percentage: number }>) => void;
  disabled?: boolean;
  fieldComment?: string;
}

export function ESQuestionRenderer({
  step,
  value,
  onChange,
  attentionReason = "",
  entityName = "",
  shareholdersData = [],
  onShareholdersChange,
  disabled = false,
  fieldComment,
}: ESQuestionRendererProps) {
  switch (step.type) {
    case "multi_select":
      return (
        <MultiSelectQuestion
          step={step}
          value={value as string[] | undefined}
          onChange={onChange}
          disabled={disabled}
          fieldComment={fieldComment}
        />
      );
    case "yes_no":
      return (
        <YesNoQuestion
          step={step}
          value={value as boolean | undefined}
          onChange={onChange}
          disabled={disabled}
          fieldComment={fieldComment}
        />
      );
    case "country_select":
      return (
        <CountrySelectQuestion
          step={step}
          value={value as string | undefined}
          onChange={onChange}
          disabled={disabled}
          fieldComment={fieldComment}
        />
      );
    case "shareholders_list":
      return (
        <ShareholdersQuestion
          step={step}
          shareholdersData={shareholdersData}
          onShareholdersChange={onShareholdersChange}
          disabled={disabled}
          fieldComment={fieldComment}
        />
      );
    case "terminal":
      if (step.terminalType === "attention") {
        return (
          <ESAttentionScreen
            attentionReason={attentionReason}
            entityName={entityName}
          />
        );
      }
      return <TerminalCompletedQuestion step={step} />;
    default:
      return null;
  }
}

// ─── Multi-select (checkbox group) ──────────────────────────────────────────

function MultiSelectQuestion({
  step,
  value,
  onChange,
  disabled,
  fieldComment,
}: {
  step: FlowStepConfig;
  value: string[] | undefined;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  fieldComment?: string;
}) {
  const { t } = useTranslation();
  const selected = value ?? [];
  const noneValue = step.noneOption ?? "__none__";
  const isNoneSelected = selected.includes(noneValue);

  const handleToggle = (optionValue: string) => {
    if (disabled) return;

    if (optionValue === noneValue) {
      // Toggling "None" clears all other selections
      if (isNoneSelected) {
        onChange([]);
      } else {
        onChange([noneValue]);
      }
      return;
    }

    // Toggling a regular option removes "None" if it was selected
    let next: string[];
    if (selected.includes(optionValue)) {
      next = selected.filter((v) => v !== optionValue);
    } else {
      next = [...selected.filter((v) => v !== noneValue), optionValue];
    }
    onChange(next);
  };

  const options = step.options ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{step.label}</h3>
        {step.description && (
          <p className="mt-1 text-sm text-gray-500">{step.description}</p>
        )}
      </div>

      {fieldComment && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {fieldComment}
        </div>
      )}

      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                isChecked
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:border-gray-300"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(option.value)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          );
        })}

        {/* None of the above option */}
        {step.noneOption && (
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
              isNoneSelected
                ? "border-primary bg-primary/5"
                : "border-gray-200 hover:border-gray-300"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={isNoneSelected}
              onChange={() => handleToggle(noneValue)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-gray-700">
              {t("es.flow.noneOfTheAbove")}
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

// ─── Yes / No ───────────────────────────────────────────────────────────────

function YesNoQuestion({
  step,
  value,
  onChange,
  disabled,
  fieldComment,
}: {
  step: FlowStepConfig;
  value: boolean | undefined;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  fieldComment?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{step.label}</h3>
        {step.description && (
          <p className="mt-1 text-sm text-gray-500">{step.description}</p>
        )}
      </div>

      {fieldComment && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {fieldComment}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => !disabled && onChange(true)}
          disabled={disabled}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-6 text-center transition-colors ${
            value === true
              ? "border-primary bg-primary/5 text-primary"
              : "border-gray-200 text-gray-500 hover:border-gray-300"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-lg font-semibold">{t("es.flow.yes")}</span>
        </button>

        <button
          type="button"
          onClick={() => !disabled && onChange(false)}
          disabled={disabled}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-6 text-center transition-colors ${
            value === false
              ? "border-red-500 bg-red-50 text-red-600"
              : "border-gray-200 text-gray-500 hover:border-gray-300"
          } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-lg font-semibold">{t("es.flow.no")}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Country select ─────────────────────────────────────────────────────────

const COUNTRIES = [
  { value: "PA", label: "Panama" },
  { value: "BZ", label: "Belize" },
  { value: "VG", label: "British Virgin Islands" },
  { value: "KY", label: "Cayman Islands" },
  { value: "BS", label: "Bahamas" },
  { value: "BB", label: "Barbados" },
  { value: "CR", label: "Costa Rica" },
  { value: "CO", label: "Colombia" },
  { value: "MX", label: "Mexico" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "ES", label: "Spain" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "CH", label: "Switzerland" },
  { value: "SG", label: "Singapore" },
  { value: "HK", label: "Hong Kong" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "BR", label: "Brazil" },
  { value: "AR", label: "Argentina" },
  { value: "CL", label: "Chile" },
  { value: "PE", label: "Peru" },
  { value: "EC", label: "Ecuador" },
  { value: "DO", label: "Dominican Republic" },
  { value: "JM", label: "Jamaica" },
  { value: "TT", label: "Trinidad and Tobago" },
  { value: "NL", label: "Netherlands" },
  { value: "LU", label: "Luxembourg" },
  { value: "IE", label: "Ireland" },
  { value: "IT", label: "Italy" },
  { value: "PT", label: "Portugal" },
  { value: "CN", label: "China" },
  { value: "JP", label: "Japan" },
  { value: "IN", label: "India" },
  { value: "AU", label: "Australia" },
  { value: "CA", label: "Canada" },
  { value: "ZA", label: "South Africa" },
  { value: "OTHER", label: "Other" },
];

function CountrySelectQuestion({
  step,
  value,
  onChange,
  disabled,
  fieldComment,
}: {
  step: FlowStepConfig;
  value: string | undefined;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  fieldComment?: string;
}) {
  const { t } = useTranslation();
  const sortedCountries = useMemo(
    () =>
      COUNTRIES.map((c) =>
        c.value === "OTHER" ? { ...c, label: t("common.other", "Other") } : c,
      ).sort((a, b) => a.label.localeCompare(b.label)),
    [t],
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{step.label}</h3>
        {step.description && (
          <p className="mt-1 text-sm text-gray-500">{step.description}</p>
        )}
      </div>

      {fieldComment && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {fieldComment}
        </div>
      )}

      <SearchableSelect
        options={sortedCountries}
        value={value ?? ""}
        onChange={(val) => onChange(val)}
        placeholder={step.description ?? ""}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Shareholders list ──────────────────────────────────────────────────────

function ShareholdersQuestion({
  step,
  shareholdersData,
  onShareholdersChange,
  disabled,
  fieldComment,
}: {
  step: FlowStepConfig;
  shareholdersData: Array<{ name: string; type: string; percentage: number; person_id?: string }>;
  onShareholdersChange?: (data: Array<{ name: string; type: string; percentage: number }>) => void;
  disabled?: boolean;
  fieldComment?: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{step.label}</h3>
        {step.description && (
          <p className="mt-1 text-sm text-gray-500">{step.description}</p>
        )}
      </div>

      {fieldComment && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          {fieldComment}
        </div>
      )}

      <ESShareholdersManager
        shareholders={shareholdersData}
        onChange={(data) => onShareholdersChange?.(data)}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Terminal completed screen ──────────────────────────────────────────────

function TerminalCompletedQuestion({ step }: { step: FlowStepConfig }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-8 w-8 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-900">{step.label}</h3>
      {step.description && (
        <p className="max-w-md text-sm text-gray-500">{step.description}</p>
      )}
      <p className="text-sm text-gray-500">
        {t("es.flow.readyToSubmit")}
      </p>
    </div>
  );
}
