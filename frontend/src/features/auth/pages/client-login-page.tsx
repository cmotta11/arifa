import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ROUTES } from "@/config/routes";
import { api } from "@/lib/api-client";

export default function ClientLoginPage() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-light">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role === "client") {
      return <Navigate to={ROUTES.CLIENT_PORTAL} replace />;
    }
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await api.post("/auth/magic-link/request/", { email: email.trim().toLowerCase() });
      setSubmitted(true);
    } catch {
      setError(t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLanguageToggle = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
    localStorage.setItem("language", newLang);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-light px-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-arifa-navy">ARIFA</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("auth.clientLogin.title")}
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-lg border border-surface-border bg-white p-8 shadow-sm">
          {submitted ? (
            <div className="text-center">
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {t("auth.clientLogin.success")}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setEmail("");
                }}
                className="mt-2 text-sm text-arifa-navy hover:underline"
              >
                {t("common.back")}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-6 text-center text-sm text-gray-600">
                {t("auth.clientLogin.subtitle")}
              </p>

              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <Input
                  label={t("auth.email")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.clientLogin.emailPlaceholder")}
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="mt-4 w-full"
                  loading={isSubmitting}
                >
                  {t("auth.clientLogin.sendLink")}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Staff login link */}
        <div className="mt-6 text-center">
          <Link
            to={ROUTES.LOGIN}
            className="text-sm text-gray-500 hover:text-arifa-navy"
          >
            {t("auth.clientLogin.staffLogin")}
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
