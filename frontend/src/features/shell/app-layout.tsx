import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { AppSidebar } from "@/features/shell/app-sidebar";
import { NotificationBell } from "@/features/notifications/components/notification-panel";
import { GlobalSearchBar } from "@/features/search/components/global-search-bar";
import { AIChatWidget } from "@/features/ai/components/ai-chat-widget";
import { ToastContainer } from "@/components/overlay/toast";
import { Spinner } from "@/components/ui/spinner";
import { useUIStore } from "@/stores/ui-store";
import { useAuth } from "@/lib/auth/auth-context";

const STAFF_ROLES = ["coordinator", "compliance_officer", "gestora", "director"];

function ContentSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export function AppLayout() {
  const { setMobileSidebarOpen } = useUIStore();
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />

      {/* Main content area */}
      <main className="flex flex-1 flex-col overflow-auto">
        {/* Top bar */}
        <div className="flex h-14 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4">
          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Open sidebar"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <span className="ml-3 text-lg font-bold text-primary">ARIFA</span>
          </div>
          <div className="hidden flex-1 justify-center md:flex">
            <GlobalSearchBar />
          </div>
          <NotificationBell />
        </div>

        <Suspense fallback={<ContentSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      {user && STAFF_ROLES.includes(user.role) && <AIChatWidget />}
      <ToastContainer />
    </div>
  );
}
