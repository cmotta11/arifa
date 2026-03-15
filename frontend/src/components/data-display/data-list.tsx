import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { EmptyState } from "./empty-state";

interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, selected: boolean) => ReactNode;
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  onSelectionChange?: (selectedKeys: string[]) => void;
  emptyMessage?: string;
  filterFn?: (item: T, query: string) => boolean;
  className?: string;
}

export function DataList<T>({
  items,
  renderItem,
  keyExtractor,
  searchPlaceholder,
  onSelectionChange,
  emptyMessage,
  filterFn,
  className = "",
}: DataListProps<T>) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase().trim();
    if (filterFn) {
      return items.filter((item) => filterFn(item, query));
    }
    // Default: stringify and search
    return items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query),
    );
  }, [items, searchQuery, filterFn]);

  const allFilteredKeys = useMemo(
    () => filteredItems.map(keyExtractor),
    [filteredItems, keyExtractor],
  );

  const allSelected =
    filteredItems.length > 0 &&
    allFilteredKeys.every((key) => selectedKeys.has(key));

  const someSelected =
    !allSelected && allFilteredKeys.some((key) => selectedKeys.has(key));

  const updateSelection = useCallback(
    (next: Set<string>) => {
      setSelectedKeys(next);
      onSelectionChange?.(Array.from(next));
    },
    [onSelectionChange],
  );

  const toggleItem = useCallback(
    (key: string) => {
      const next = new Set(selectedKeys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      updateSelection(next);
    },
    [selectedKeys, updateSelection],
  );

  const toggleAll = useCallback(() => {
    if (allSelected) {
      // Deselect all visible items
      const next = new Set(selectedKeys);
      for (const key of allFilteredKeys) {
        next.delete(key);
      }
      updateSelection(next);
    } else {
      // Select all visible items
      const next = new Set(selectedKeys);
      for (const key of allFilteredKeys) {
        next.add(key);
      }
      updateSelection(next);
    }
  }, [allSelected, allFilteredKeys, selectedKeys, updateSelection]);

  const selectedCount = selectedKeys.size;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Search input */}
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchPlaceholder || t("dataList.searchPlaceholder")}
          className="block w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm
            placeholder:text-gray-400
            focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Select all / count bar */}
      <div className="mt-2 flex items-center justify-between border-b border-gray-200 pb-2">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          {allSelected
            ? t("dataList.deselectAll")
            : t("dataList.selectAll")}
        </label>
        <span className="text-xs text-gray-400">
          {t("dataList.itemCount", {
            selected: selectedCount,
            total: filteredItems.length,
          })}
        </span>
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <EmptyState
          title={emptyMessage || t("dataList.noResults")}
          className="py-8"
        />
      ) : (
        <ul className="mt-1 divide-y divide-gray-100 overflow-y-auto">
          {filteredItems.map((item) => {
            const key = keyExtractor(item);
            const isSelected = selectedKeys.has(key);

            return (
              <li
                key={key}
                className={`flex items-center gap-3 px-1 py-2 transition-colors duration-100 ${
                  isSelected ? "bg-primary/5" : "hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleItem(key)}
                  className="h-4 w-4 flex-shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="min-w-0 flex-1">
                  {renderItem(item, isSelected)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
