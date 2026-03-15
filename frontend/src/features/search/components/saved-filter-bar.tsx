import { useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BookmarkIcon,
  XMarkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { StarIcon as StarIconSolid } from "@heroicons/react/24/solid";
import {
  getSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
  type SavedFilter,
} from "../api/search-api";

interface SavedFilterBarProps {
  /** The module key (e.g. "entities", "tickets", "people", "clients") */
  module: string;
  /** The current active filter params from the page */
  currentFilters: Record<string, string>;
  /** Called when the user selects a saved filter to apply */
  onApplyFilter: (filters: Record<string, string>) => void;
}

export function SavedFilterBar({
  module,
  currentFilters,
  onApplyFilter,
}: SavedFilterBarProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [isNaming, setIsNaming] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  // Fetch saved filters for this module
  const { data: savedFilters = [] } = useQuery<SavedFilter[]>({
    queryKey: ["saved-filters", module],
    queryFn: () => getSavedFilters(module),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createSavedFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters", module] });
      setIsNaming(false);
      setFilterName("");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSavedFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-filters", module] });
    },
  });

  const handleSave = useCallback(() => {
    if (!filterName.trim()) return;

    // Only save non-empty filter params
    const nonEmptyFilters: Record<string, string> = {};
    for (const [key, value] of Object.entries(currentFilters)) {
      if (value) nonEmptyFilters[key] = value;
    }

    createMutation.mutate({
      name: filterName.trim(),
      module,
      filters: nonEmptyFilters,
      is_default: false,
    });
  }, [filterName, module, currentFilters, createMutation]);

  const handleApply = useCallback(
    (filter: SavedFilter) => {
      setActiveFilterId(filter.id);
      onApplyFilter(filter.filters);
    },
    [onApplyFilter],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, filterId: string) => {
      e.stopPropagation();
      if (activeFilterId === filterId) {
        setActiveFilterId(null);
      }
      deleteMutation.mutate(filterId);
    },
    [activeFilterId, deleteMutation],
  );

  const handleClearActive = useCallback(() => {
    setActiveFilterId(null);
    onApplyFilter({});
  }, [onApplyFilter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        setIsNaming(false);
        setFilterName("");
      }
    },
    [handleSave],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <BookmarkIcon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-medium text-gray-500">
        {t("filters.saved")}:
      </span>

      {/* Saved filter chips */}
      {savedFilters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => handleApply(filter)}
          className={`group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            activeFilterId === filter.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          {filter.is_default ? (
            <StarIconSolid className="h-3 w-3 text-amber-400" />
          ) : null}
          <span>{filter.name}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => handleDelete(e, filter.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleDelete(e as unknown as React.MouseEvent, filter.id);
              }
            }}
            className="ml-0.5 hidden rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 group-hover:inline-flex"
            aria-label={t("filters.delete")}
          >
            <XMarkIcon className="h-3 w-3" />
          </span>
        </button>
      ))}

      {/* Clear active filter */}
      {activeFilterId && (
        <button
          onClick={handleClearActive}
          className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
        >
          <XMarkIcon className="h-3 w-3" />
          {t("common.clear")}
        </button>
      )}

      {/* Save current filter button / input */}
      {isNaming ? (
        <div className="inline-flex items-center gap-1">
          <input
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("filters.name")}
            className="h-7 w-32 rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!filterName.trim() || createMutation.isPending}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {t("common.save")}
          </button>
          <button
            onClick={() => {
              setIsNaming(false);
              setFilterName("");
            }}
            className="rounded-md px-1.5 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsNaming(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
        >
          <PlusIcon className="h-3 w-3" />
          {t("filters.save")}
        </button>
      )}
    </div>
  );
}
