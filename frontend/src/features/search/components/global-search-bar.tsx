import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  BuildingOffice2Icon,
  UserIcon,
  UsersIcon,
  TicketIcon,
} from "@heroicons/react/24/solid";
import { globalSearch, type SearchResult } from "../api/search-api";

const TYPE_ICONS: Record<string, typeof BuildingOffice2Icon> = {
  entity: BuildingOffice2Icon,
  person: UserIcon,
  client: UsersIcon,
  ticket: TicketIcon,
};

const TYPE_COLORS: Record<string, string> = {
  entity: "bg-blue-100 text-blue-700",
  person: "bg-green-100 text-green-700",
  client: "bg-purple-100 text-purple-700",
  ticket: "bg-amber-100 text-amber-700",
};

export function GlobalSearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      try {
        const data = await globalSearch(value.trim());
        // Discard stale responses from earlier requests
        if (seq !== requestSeqRef.current) return;
        setResults(data.results);
        setIsOpen(true);
      } catch {
        if (seq !== requestSeqRef.current) return;
        setResults([]);
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false);
        }
      }
    }, 300);
  }, []);

  // Navigate to a result
  const handleSelect = useCallback(
    (result: SearchResult) => {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      // Only allow relative URLs starting with "/" to prevent open-redirect attacks
      if (!result.url.startsWith("/")) {
        console.warn("Blocked navigation to non-relative URL:", result.url);
        return;
      }
      navigate(result.url);
    },
    [navigate],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
        return;
      }

      if (!isOpen || results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    },
    [isOpen, results, activeIndex, handleSelect],
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global shortcut: Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleGlobalKey);
    return () => document.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.type]) acc[result.type] = [];
      acc[result.type].push(result);
      return acc;
    },
    {},
  );

  // Flattened results for index tracking
  const flatResults = results;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search input */}
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => {
            if (results.length > 0 && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          className="w-full rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-9 pr-12 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary"
          aria-label={t("search.placeholder")}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
          }
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 sm:inline-block">
          {navigator.platform.includes("Mac") ? "\u2318K" : "Ctrl+K"}
        </kbd>
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          {isLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">
              {t("common.loading")}
            </div>
          )}

          {!isLoading && flatResults.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              {t("search.noResults")}
            </div>
          )}

          {!isLoading && flatResults.length > 0 && (
            <div className="max-h-80 overflow-y-auto py-1">
              {Object.entries(grouped).map(([type, items]) => {
                const typeKey = `search.types.${type}` as const;
                return (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {t(typeKey)}
                    </div>
                    {items.map((result) => {
                      const globalIdx = flatResults.indexOf(result);
                      const Icon = TYPE_ICONS[result.type] || MagnifyingGlassIcon;
                      const colorClass = TYPE_COLORS[result.type] || "bg-gray-100 text-gray-700";

                      return (
                        <button
                          key={result.id}
                          id={`search-result-${globalIdx}`}
                          role="option"
                          aria-selected={globalIdx === activeIndex}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                            globalIdx === activeIndex ? "bg-gray-100" : ""
                          }`}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                        >
                          <span
                            className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${colorClass}`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-900">
                              {result.title}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                              {result.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && query.trim().length < 2 && query.trim().length > 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">
              {t("search.minChars")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
