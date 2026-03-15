import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Spinner } from "@/components/ui/spinner";

interface AIAssistantShellProps {
  title?: string;
  loading?: boolean;
  children?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function AIAssistantShell({
  title,
  loading = false,
  children,
  defaultOpen = true,
  className = "",
}: AIAssistantShellProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const displayTitle = title ?? t("ai.title");

  return (
    <div className={`rounded-lg border border-primary/20 bg-primary/5 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3"
        aria-label={`${isOpen ? t("ai.collapse") : t("ai.expand")} ${displayTitle}`}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">{displayTitle}</span>
          {loading && <Spinner size="sm" />}
        </div>
        {isOpen ? (
          <ChevronUpIcon className="h-4 w-4 text-primary" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-primary" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-primary/20 px-4 py-3">
          {loading && !children ? (
            <div className="flex items-center justify-center py-6">
              <div className="text-center">
                <Spinner size="md" />
                <p className="mt-2 text-sm text-gray-500">{t("ai.processing")}</p>
              </div>
            </div>
          ) : children ? (
            children
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">
              {t("ai.noResults")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
