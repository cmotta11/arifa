import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { NavItem } from "@/config/navigation";

interface SidebarUser {
  first_name: string;
  last_name: string;
  email: string;
}

interface SidebarContentProps {
  navItems: NavItem[];
  user: SidebarUser | null;
  collapsed: boolean;
  language: string;
  onToggle: () => void;
  onLogout: () => void;
  onLanguageChange: () => void;
  onNavClick?: () => void;
  t: (key: string) => string;
}

function SidebarContent({
  navItems,
  user,
  collapsed,
  language,
  onToggle,
  onLogout,
  onLanguageChange,
  onNavClick,
  t,
}: SidebarContentProps) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
        {!collapsed && (
          <span className="text-xl font-bold text-primary">ARIFA</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="hidden rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 md:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const label = t(item.labelKey);
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              onClick={onNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-100
                ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }
                ${collapsed ? "justify-center" : ""}
                `
              }
              title={collapsed ? label : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-200 p-2">
        {/* Language toggle */}
        <button
          type="button"
          onClick={onLanguageChange}
          className={`
            flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium
            text-gray-600 hover:bg-gray-100
            ${collapsed ? "justify-center" : ""}
          `}
          title="Toggle language"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center text-xs font-bold">
            {language === "es" ? "ES" : "EN"}
          </span>
          {!collapsed && (
            <span>{language === "es" ? "Español" : "English"}</span>
          )}
        </button>

        {/* User info */}
        {user && !collapsed && (
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
          onClick={onLogout}
          className={`
            flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium
            text-gray-600 hover:bg-red-50 hover:text-red-600
            ${collapsed ? "justify-center" : ""}
          `}
          title="Logout"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>{t("auth.logout")}</span>}
        </button>
      </div>
    </>
  );
}

interface SidebarProps {
  navItems: NavItem[];
  user: SidebarUser | null;
  collapsed: boolean;
  mobileSidebarOpen: boolean;
  language: string;
  onToggle: () => void;
  onLogout: () => void;
  onLanguageChange: () => void;
  onMobileSidebarClose: () => void;
  t: (key: string) => string;
}

export function Sidebar({
  navItems,
  user,
  collapsed,
  mobileSidebarOpen,
  language,
  onToggle,
  onLogout,
  onLanguageChange,
  onMobileSidebarClose,
  t,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 md:flex
          ${collapsed ? "w-16" : "w-60"}
        `}
      >
        <SidebarContent
          navItems={navItems}
          user={user}
          collapsed={collapsed}
          language={language}
          onToggle={onToggle}
          onLogout={onLogout}
          onLanguageChange={onLanguageChange}
          t={t}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      <Transition show={mobileSidebarOpen} as={Fragment}>
        <Dialog onClose={onMobileSidebarClose} className="relative z-50 md:hidden">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          </TransitionChild>

          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="fixed inset-y-0 left-0 flex w-60 flex-col bg-white shadow-xl">
              <button
                type="button"
                onClick={onMobileSidebarClose}
                className="absolute right-2 top-4 rounded-md p-1 text-gray-400 hover:text-gray-600"
                aria-label="Close sidebar"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <SidebarContent
                navItems={navItems}
                user={user}
                collapsed={false}
                language={language}
                onToggle={onToggle}
                onLogout={onLogout}
                onLanguageChange={onLanguageChange}
                onNavClick={onMobileSidebarClose}
                t={t}
              />
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </>
  );
}
