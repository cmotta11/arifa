import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Spinner } from "@/components/ui/spinner";

function ContentSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

/**
 * Minimal generic layout wrapper.
 * The full app shell (sidebar + topbar) is in features/shell/app-layout.tsx.
 */
export function PageLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex flex-1 flex-col overflow-auto">
        <Suspense fallback={<ContentSpinner />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
