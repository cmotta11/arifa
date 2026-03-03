import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import {
  HomeIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

export function PortalLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex min-h-screen bg-surface-light">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-surface-border bg-white">
        <div className="flex h-16 items-center border-b border-surface-border px-4">
          <span className="text-xl font-bold text-arifa-navy">ARIFA</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          <button
            type="button"
            onClick={() => navigate(ROUTES.CLIENT_PORTAL)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <HomeIcon className="h-5 w-5 text-gray-400" />
            {t("portal.nav.home")}
          </button>
        </nav>

        <div className="border-t border-surface-border p-4">
          <p className="truncate text-sm font-medium text-gray-900">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            {t("portal.nav.logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center p-6">
              <Spinner size="lg" />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
