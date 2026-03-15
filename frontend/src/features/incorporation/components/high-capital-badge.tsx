import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

interface HighCapitalBadgeProps {
  metadata: Record<string, unknown>;
  className?: string;
}

export function HighCapitalBadge({ metadata, className = "" }: HighCapitalBadgeProps) {
  if (metadata?.is_high_capital !== true) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 ${className}`}
    >
      <ExclamationTriangleIcon className="h-3.5 w-3.5" />
      <HighCapitalLabel />
    </span>
  );
}

function HighCapitalLabel() {
  const { t } = useTranslation();
  return <>{t("incorporation.highCapital")}</>;
}
