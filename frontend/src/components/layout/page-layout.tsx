import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/navigation/sidebar";
import { ToastContainer } from "@/components/overlay/toast";
import { Spinner } from "@/components/ui/spinner";

function ContentSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export function PageLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - hidden on mobile, visible on md+ */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-auto">
        <Suspense fallback={<ContentSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      <ToastContainer />
    </div>
  );
}
