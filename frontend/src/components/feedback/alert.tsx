import { type ReactNode, useState } from "react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import {
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string }> = {
  info: {
    container: "bg-blue-50 border-info text-blue-800",
    icon: "text-info",
  },
  success: {
    container: "bg-green-50 border-success text-green-800",
    icon: "text-success",
  },
  warning: {
    container: "bg-yellow-50 border-warning text-yellow-800",
    icon: "text-warning",
  },
  error: {
    container: "bg-red-50 border-error text-red-800",
    icon: "text-error",
  },
};

const variantIcons: Record<AlertVariant, typeof InformationCircleIcon> = {
  info: InformationCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationCircleIcon,
};

export function Alert({
  variant = "info",
  title,
  children,
  dismissible = false,
  className = "",
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const styles = variantStyles[variant];
  const Icon = variantIcons[variant];

  return (
    <div
      className={`flex gap-3 rounded-md border-l-4 p-4 ${styles.container} ${className}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 shrink-0 ${styles.icon}`} />
      <div className="flex-1">
        {title && <p className="text-sm font-medium">{title}</p>}
        <div className={`text-sm ${title ? "mt-1" : ""}`}>{children}</div>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
