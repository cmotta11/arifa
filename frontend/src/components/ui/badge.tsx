import type { ReactNode } from "react";

type BadgeColor = "gray" | "green" | "yellow" | "red" | "blue" | "primary";

interface BadgeProps {
  color?: BadgeColor;
  children: ReactNode;
  className?: string;
}

const colorClasses: Record<BadgeColor, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  primary: "bg-primary/10 text-primary",
};

export function Badge({ color = "gray", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
        ${colorClasses[color]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
