import { useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
}

export function CollapsibleSection({
  title,
  children,
  action,
  defaultOpen = false,
  onToggle,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onToggle?.(next);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-400" />
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {action && (
          <div onClick={(e) => e.stopPropagation()}>{action}</div>
        )}
      </button>
      {isOpen && <div className="border-t border-gray-200 px-4 py-4">{children}</div>}
    </div>
  );
}
