import { useState, useMemo } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/20/solid";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  error?: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "",
  disabled = false,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query) return options;
    const lower = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, query]);

  const selectId = label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <Combobox
        value={value}
        onChange={(val) => onChange(val ?? "")}
        disabled={disabled}
      >
        <div className="relative">
          <ComboboxInput
            id={selectId}
            className={`
              block w-full rounded-md border px-3 py-2 pr-8 text-sm shadow-sm
              transition-colors duration-150
              placeholder:text-gray-400
              focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy
              disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500
              ${error ? "border-error" : "border-gray-300"}
            `}
            displayValue={() => selected?.label ?? ""}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            aria-invalid={!!error}
            aria-describedby={error ? `${selectId}-error` : undefined}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
          </ComboboxButton>

          <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
            {/* Empty/clear option */}
            <ComboboxOption
              value=""
              className="group relative cursor-pointer select-none px-3 py-2 text-gray-400 data-[focus]:bg-arifa-navy/5 data-[focus]:text-gray-700"
            >
              —
            </ComboboxOption>
            {filtered.length === 0 && query !== "" ? (
              <div className="px-3 py-2 text-gray-500">No results</div>
            ) : (
              filtered
                .filter((o) => o.value !== "")
                .map((option) => (
                  <ComboboxOption
                    key={option.value}
                    value={option.value}
                    className="group relative cursor-pointer select-none py-2 pl-8 pr-3 text-gray-900 data-[focus]:bg-arifa-navy/5 data-[focus]:text-arifa-navy"
                  >
                    <span className="block truncate group-data-[selected]:font-medium">
                      {option.label}
                    </span>
                    <span className="absolute inset-y-0 left-0 hidden items-center pl-2 text-arifa-navy group-data-[selected]:flex">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                  </ComboboxOption>
                ))
            )}
          </ComboboxOptions>
        </div>
      </Combobox>
      {error && (
        <p id={`${selectId}-error`} className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
