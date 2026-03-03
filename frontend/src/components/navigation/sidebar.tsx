import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  HomeIcon,
  BuildingOfficeIcon,
  BuildingLibraryIcon,
  UsersIcon,
  TicketIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/lib/auth/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { ROUTES } from "@/config/routes";

interface NavItem {
  labelKey: string;
  href: string;
  icon: typeof HomeIcon;
  roles?: string[];
}

const navItems: NavItem[] = [
  { labelKey: "nav.dashboard", href: ROUTES.DASHBOARD, icon: HomeIcon },
  { labelKey: "nav.clients", href: ROUTES.CLIENTS, icon: BuildingOfficeIcon },
  { labelKey: "nav.entities", href: ROUTES.ENTITIES, icon: BuildingLibraryIcon },
  { labelKey: "nav.people", href: ROUTES.PEOPLE, icon: UsersIcon },
  { labelKey: "nav.tickets", href: ROUTES.TICKETS, icon: TicketIcon },
  { labelKey: "nav.kyc", href: ROUTES.KYC, icon: IdentificationIcon },
  { labelKey: "nav.compliance", href: ROUTES.COMPLIANCE, icon: ShieldCheckIcon },
  { labelKey: "nav.documents", href: ROUTES.DOCUMENTS, icon: DocumentDuplicateIcon },
  { labelKey: "nav.admin", href: ROUTES.ADMIN, icon: Cog6ToothIcon, roles: ["director"] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar, language, setLanguage } = useUIStore();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  const handleLanguageToggle = () => {
    const newLang = language === "es" ? "en" : "es";
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <aside
      className={`
        flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200
        ${sidebarCollapsed ? "w-16" : "w-60"}
      `}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        {!sidebarCollapsed && (
          <span className="text-xl font-bold text-arifa-navy">ARIFA</span>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleNavItems.map((item) => {
          const label = t(item.labelKey);
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100
                ${
                  isActive
                    ? "bg-arifa-navy text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }
                ${sidebarCollapsed ? "justify-center" : ""}
                `
              }
              title={sidebarCollapsed ? label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 p-2">
        {/* Language toggle */}
        <button
          type="button"
          onClick={handleLanguageToggle}
          className={`
            flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium
            text-gray-600 hover:bg-gray-100
            ${sidebarCollapsed ? "justify-center" : ""}
          `}
          title="Toggle language"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center text-xs font-bold">
            {language === "es" ? "ES" : "EN"}
          </span>
          {!sidebarCollapsed && (
            <span>{language === "es" ? "Espanol" : "English"}</span>
          )}
        </button>

        {/* User info */}
        {user && !sidebarCollapsed && (
          <div className="mb-1 rounded-md px-3 py-2">
            <p className="truncate text-sm font-medium text-gray-900">
              {user.first_name} {user.last_name}
            </p>
            <p className="truncate text-xs text-gray-500">{user.email}</p>
          </div>
        )}

        {/* Logout */}
        <button
          type="button"
          onClick={handleLogout}
          className={`
            flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium
            text-gray-600 hover:bg-red-50 hover:text-red-600
            ${sidebarCollapsed ? "justify-center" : ""}
          `}
          title="Logout"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
          {!sidebarCollapsed && <span>{t("auth.logout")}</span>}
        </button>
      </div>
    </aside>
  );
}
