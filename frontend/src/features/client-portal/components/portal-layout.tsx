import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import {
  HomeIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

interface NavItem {
  label: string;
  route: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;
}

export function PortalLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const navItems: NavItem[] = [
    { label: t("portal.nav.home"), route: ROUTES.CLIENT_PORTAL, icon: HomeIcon, exact: true },
    { label: t("portal.nav.entities"), route: ROUTES.CLIENT_PORTAL_ENTITIES, icon: BuildingOfficeIcon },
    { label: t("portal.nav.services"), route: ROUTES.CLIENT_PORTAL_SERVICES, icon: ClipboardDocumentListIcon },
    { label: t("portal.nav.notifications"), route: ROUTES.CLIENT_PORTAL_NOTIFICATIONS, icon: BellIcon },
    { label: t("portal.nav.profile"), route: ROUTES.CLIENT_PORTAL_PROFILE, icon: UserCircleIcon },
  ];

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.route;
    return location.pathname.startsWith(item.route);
  };

  return (
    <div className="flex min-h-screen bg-surface-light">
      <aside className="flex w-56 flex-col border-r border-surface-border bg-white">
        <div className="flex h-16 items-center border-b border-surface-border px-4">
          <span className="text-xl font-bold text-primary">ARIFA</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "text-primary" : "text-gray-400"}`}
                />
                {item.label}
              </button>
            );
          })}
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
