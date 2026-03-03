import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/auth-context";
import { ROUTES } from "@/config/routes";
import { Spinner } from "@/components/ui/spinner";

export default function MagicLoginPage() {
  const { token } = useParams<{ token: string }>();
  const { loginWithMagicToken, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(t("auth.magicLink.invalid"));
      setValidating(false);
      return;
    }

    let cancelled = false;

    loginWithMagicToken(token)
      .then(() => {
        if (!cancelled) setValidating(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("auth.magicLink.invalid"));
          setValidating(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!validating && user) {
      navigate(user.role === "client" ? ROUTES.CLIENT_PORTAL : ROUTES.DASHBOARD, {
        replace: true,
      });
    }
  }, [validating, user, navigate]);

  if (validating) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Spinner size="lg" />
        <p className="text-gray-500">{t("auth.magicLink.validating")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">
            {t("auth.magicLink.errorTitle")}
          </h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <p className="mt-4 text-xs text-gray-500">
            {t("auth.magicLink.contactInfo")}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
