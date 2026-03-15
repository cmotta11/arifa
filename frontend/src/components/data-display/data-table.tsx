import type { KeyboardEvent, ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "./empty-state";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  keyExtractor?: (row: T) => string;
  stickyHeader?: boolean;
  className?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  keyExtractor,
  stickyHeader = false,
  className = "",
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  const handleRowKeyDown = (row: T) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className={`bg-white border-b border-gray-200 ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.map((row, index) => {
            const rec = row as Record<string, unknown>;
            const key = keyExtractor ? keyExtractor(row) : String(rec.id ?? index);
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className={`
                  transition-colors duration-100
                  ${onRowClick ? "cursor-pointer hover:bg-gray-100" : ""}
                `}
                {...(onRowClick ? {
                  tabIndex: 0,
                  role: "row",
                  onKeyDown: handleRowKeyDown(row),
                } : {})}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-4 py-3 text-sm text-gray-700"
                  >
                    {column.render
                      ? column.render(row)
                      : String((row as Record<string, unknown>)[column.key] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
