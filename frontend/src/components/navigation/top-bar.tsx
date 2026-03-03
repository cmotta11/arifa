import type { ReactNode } from "react";
import { Breadcrumbs } from "./breadcrumbs";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopBarProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function TopBar({ title, breadcrumbs, actions, className = "" }: TopBarProps) {
  return (
    <div
      className={`
        flex flex-col gap-1 border-b border-gray-200 bg-white px-6 py-4
        sm:flex-row sm:items-center sm:justify-between
        ${className}
      `}
    >
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className="mb-1" />
        )}
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
