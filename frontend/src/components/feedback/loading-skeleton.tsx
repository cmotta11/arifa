interface LoadingSkeletonProps {
  variant?: "text" | "circle" | "rect";
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = "text",
  width,
  height,
  lines = 3,
  className = "",
}: LoadingSkeletonProps) {
  const baseClass = "animate-pulse bg-gray-200 rounded";

  if (variant === "circle") {
    const size = width || height || 40;
    return (
      <div
        className={`${baseClass} rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (variant === "rect") {
    return (
      <div
        className={`${baseClass} ${className}`}
        style={{
          width: width || "100%",
          height: height || 120,
        }}
      />
    );
  }

  // text variant
  return (
    <div className={`space-y-2 ${className}`} style={{ width: width || "100%" }}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={baseClass}
          style={{
            height: height || 16,
            width: i === lines - 1 ? "75%" : "100%",
          }}
        />
      ))}
    </div>
  );
}
