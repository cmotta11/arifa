import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-context";
import { useUIStore } from "@/stores/ui-store";
import { navItems } from "@/config/navigation";
import { Sidebar } from "@/components/navigation/sidebar";
import { ROUTES } from "@/config/routes";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { sidebarCollapsed, mobileSidebarOpen, toggleSidebar, setMobileSidebarOpen, language, setLanguage } = useUIStore();
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
    <Sidebar
      navItems={visibleNavItems}
      user={user}
      collapsed={sidebarCollapsed}
      mobileSidebarOpen={mobileSidebarOpen}
      language={language}
      onToggle={toggleSidebar}
      onLogout={handleLogout}
      onLanguageChange={handleLanguageToggle}
      onMobileSidebarClose={() => setMobileSidebarOpen(false)}
      t={t}
    />
  );
}
