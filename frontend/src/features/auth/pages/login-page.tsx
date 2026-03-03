import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import { ENV } from "@/config/env";
import { LoginForm } from "../components/login-form";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-light">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const handleLogin = async (values: { email: string; password: string }) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(values.email, values.password);
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch {
      setError(t("auth.loginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLanguageToggle = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  };

  const microsoftLoginUrl = `${ENV.API_BASE_URL}/auth/microsoft/`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-light px-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-arifa-navy">ARIFA</h1>
          <p className="mt-2 text-sm text-gray-500">{t("auth.welcomeBack")}</p>
        </div>

        {/* Login Card */}
        <div className="rounded-lg border border-surface-border bg-white p-8 shadow-sm">
          {/* Error Toast */}
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          <LoginForm onSubmit={handleLogin} isLoading={isSubmitting} />

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-surface-border" />
            <span className="text-xs text-gray-400">O</span>
            <div className="h-px flex-1 bg-surface-border" />
          </div>

          {/* Microsoft Login */}
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              window.location.href = microsoftLoginUrl;
            }}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 21 21"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            {t("auth.loginWithMicrosoft")}
          </Button>
        </div>

        {/* Client portal link */}
        <div className="mt-6 text-center">
          <Link
            to={ROUTES.CLIENT_LOGIN}
            className="text-sm text-gray-500 hover:text-arifa-navy"
          >
            {t("auth.clientPortalLogin")}
          </Link>
        </div>

        {/* Language Toggle */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-xs text-gray-400">{t("auth.language")}:</span>
          <button
            type="button"
            onClick={handleLanguageToggle}
            className="rounded-md px-3 py-1 text-sm font-medium text-arifa-navy hover:bg-arifa-navy/5 focus:outline-none focus:ring-2 focus:ring-arifa-navy/30"
          >
            {i18n.language === "es" ? "EN" : "ES"}
          </button>
        </div>
      </div>
    </div>
  );
}
