import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { setGuestToken } from "@/lib/api-client";
import { useValidateGuestLink } from "@/features/guest-intake/api/guest-api";
import { GuestForm } from "@/features/guest-intake/components/guest-form";
import { GuestLayout } from "@/features/guest-intake/components/guest-layout";

// ─── Page Component ─────────────────────────────────────────────────────────

export default function GuestIntakePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();

  const {
    data: linkData,
    isLoading,
    isError,
    error,
  } = useValidateGuestLink(token);

  // ─── Determine page state ─────────────────────────────────────────

  // Set guest token for API calls
  useEffect(() => {
    if (token) {
      setGuestToken(token);
    }
    return () => setGuestToken(null);
  }, [token]);

  const isExpired = (() => {
    if (!linkData) return false;
    if (!linkData.is_active) return true;
    const expiresAt = new Date(linkData.expires_at);
    return expiresAt < new Date();
  })();

  const isValid = linkData?.is_active && !isExpired;
  const kycId = linkData?.kyc_submission;

  // ─── Loading State ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <GuestLayout>
        <div className="flex flex-col items-center gap-4 py-16">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">{t("guest.validating")}</p>
        </div>
      </GuestLayout>
    );
  }

  // ─── No token provided ────────────────────────────────────────────

  if (!token) {
    return (
      <GuestLayout>
        <InvalidLinkCard />
      </GuestLayout>
    );
  }

  // ─── Error / Invalid Link ─────────────────────────────────────────

  if (isError || (!isLoading && !linkData)) {
    const is404 =
      error && typeof error === "object" && "status" in error && (error as { status: number }).status === 404;

    return (
      <GuestLayout>
        {is404 ? <InvalidLinkCard /> : <ErrorCard />}
      </GuestLayout>
    );
  }

  // ─── Expired Link ─────────────────────────────────────────────────

  if (isExpired) {
    const expiresFormatted = linkData
      ? new Date(linkData.expires_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

    return (
      <GuestLayout>
        <Card className="mx-auto max-w-md text-center">
          <div className="py-8">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-yellow-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("guest.linkExpired")}
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              {t("guest.linkExpiredDescription", { date: expiresFormatted })}
            </p>

            {/* Contact info */}
            <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-left">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                {t("guest.expired.contactTitle")}
              </h3>
              <p className="text-sm text-gray-600">
                {t("guest.expired.contactDescription")}
              </p>
              <a
                href="mailto:compliance@arifa.law"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                compliance@arifa.law
              </a>
            </div>
          </div>
        </Card>
      </GuestLayout>
    );
  }

  // ─── Valid State: Show Form ───────────────────────────────────────

  if (!isValid || !kycId) {
    return (
      <GuestLayout>
        <InvalidLinkCard />
      </GuestLayout>
    );
  }

  const expiresFormatted = linkData
    ? new Date(linkData.expires_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <GuestLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Expiry notice */}
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {t("guest.expiresOn", { date: expiresFormatted })}
        </div>

        {/* Client name if available */}
        {linkData.client_name && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">
              {t("guest.title")}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("guest.forClient", { name: linkData.client_name })}
            </p>
          </div>
        )}

        {/* Multi-step guest form */}
        <GuestForm kycId={kycId} />
      </div>
    </GuestLayout>
  );
}

// ─── Shared State Cards ─────────────────────────────────────────────────────

function InvalidLinkCard() {
  const { t } = useTranslation();

  return (
    <Card className="mx-auto max-w-md text-center">
      <div className="py-8">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          {t("guest.linkInvalid")}
        </h2>
        <p className="text-sm text-gray-500">
          {t("guest.linkInvalidDescription")}
        </p>

        {/* Contact info */}
        <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-left">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            {t("guest.expired.contactTitle")}
          </h3>
          <p className="text-sm text-gray-600">
            {t("guest.expired.contactDescription")}
          </p>
          <a
            href="mailto:compliance@arifa.law"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            compliance@arifa.law
          </a>
        </div>
      </div>
    </Card>
  );
}

function ErrorCard() {
  const { t } = useTranslation();

  return (
    <Card className="mx-auto max-w-md text-center">
      <div className="py-8">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">
          {t("guest.error.title")}
        </h2>
        <p className="text-sm text-gray-500">
          {t("guest.error.description")}
        </p>
      </div>
    </Card>
  );
}
