import { useState, useMemo } from "react";
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon, XMarkIcon } from "@heroicons/react/20/solid";

interface SearchableMultiSelectOption {
  value: string;
  label: string;
}

interface SearchableMultiSelectProps {
  label?: string;
  error?: string;
  options: SearchableMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableMultiSelect({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = "",
  disabled = false,
}: SearchableMultiSelectProps) {
  const [query, setQuery] = useState("");

  const selectedOptions = useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query) return options.filter((o) => o.value !== "");
    const lower = query.toLowerCase();
    return options
      .filter((o) => o.value !== "")
      .filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, query]);

  const selectId = label?.toLowerCase().replace(/\s+/g, "-");

  const removeItem = (val: string) => {
    onChange(value.filter((v) => v !== val));
  };

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
        multiple
        value={value}
        onChange={(vals) => onChange(vals)}
        disabled={disabled}
      >
        <div className="relative">
          <div
            className={`
              flex min-h-[38px] flex-wrap items-center gap-1 rounded-md border px-2 py-1 pr-8 shadow-sm
              transition-colors duration-150
              focus-within:border-arifa-navy focus-within:ring-1 focus-within:ring-arifa-navy
              ${disabled ? "cursor-not-allowed bg-gray-50" : "bg-white"}
              ${error ? "border-error" : "border-gray-300"}
            `}
          >
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-0.5 rounded bg-arifa-navy/10 px-1.5 py-0.5 text-xs font-medium text-arifa-navy"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(opt.value);
                  }}
                  className="ml-0.5 hover:text-red-500"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
            <ComboboxInput
              id={selectId}
              className="min-w-[80px] flex-1 border-none bg-transparent py-1 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-0"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selectedOptions.length === 0 ? placeholder : ""}
              aria-invalid={!!error}
            />
          </div>
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
          </ComboboxButton>

          <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg focus:outline-none">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-gray-500">No results</div>
            ) : (
              filtered.map((option) => (
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
