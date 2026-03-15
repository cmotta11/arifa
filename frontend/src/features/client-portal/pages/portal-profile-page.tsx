import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  usePortalProfile,
  useUpdatePortalProfile,
  useChangePortalPassword,
  useUpdateNotificationPreferences,
} from "../api/portal-api";

const NOTIFICATION_CATEGORIES = [
  "ticket",
  "kyc",
  "compliance",
  "document",
  "system",
  "reminder",
] as const;

export default function PortalProfilePage() {
  const { t } = useTranslation();
  const profileQuery = usePortalProfile();

  if (profileQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("common.error")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {t("portal.profile.title")}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("portal.profile.description")}
      </p>

      <div className="mt-6 space-y-6">
        <ProfileInfoSection profile={profileQuery.data} />
        <ChangePasswordSection />
        <NotificationPreferencesSection profile={profileQuery.data} />
      </div>
    </div>
  );
}

function ProfileInfoSection({
  profile,
}: {
  profile: { first_name: string; last_name: string; phone: string; email: string };
}) {
  const { t } = useTranslation();
  const updateProfile = useUpdatePortalProfile();
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [phone, setPhone] = useState(profile.phone);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
    setPhone(profile.phone);
  }, [profile]);

  const handleSave = () => {
    setSuccessMsg("");
    updateProfile.mutate(
      { first_name: firstName, last_name: lastName, phone },
      {
        onSuccess: () => setSuccessMsg(t("portal.profile.info.saveSuccess")),
      },
    );
  };

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        {t("portal.profile.info.title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("portal.profile.info.firstName")}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label={t("portal.profile.info.lastName")}
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
        <Input
          label={t("portal.profile.info.phone")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label={t("portal.profile.info.email")}
          value={profile.email}
          disabled
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} loading={updateProfile.isPending}>
          {t("portal.profile.info.save")}
        </Button>
        {successMsg && (
          <span className="text-sm text-green-600">{successMsg}</span>
        )}
        {updateProfile.isError && (
          <span className="text-sm text-red-600">
            {t("portal.profile.info.saveError")}
          </span>
        )}
      </div>
    </Card>
  );
}

function ChangePasswordSection() {
  const { t } = useTranslation();
  const changePassword = useChangePortalPassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = () => {
    setError("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setError(t("portal.profile.password.mismatch"));
      return;
    }

    changePassword.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          setSuccessMsg(t("portal.profile.password.changeSuccess"));
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: () => {
          setError(t("portal.profile.password.changeError"));
        },
      },
    );
  };

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        {t("portal.profile.password.title")}
      </h2>
      <div className="max-w-md space-y-4">
        <Input
          label={t("portal.profile.password.currentPassword")}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label={t("portal.profile.password.newPassword")}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label={t("portal.profile.password.confirmPassword")}
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          onClick={handleChange}
          loading={changePassword.isPending}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        >
          {t("portal.profile.password.change")}
        </Button>
        {successMsg && (
          <span className="text-sm text-green-600">{successMsg}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </Card>
  );
}

function NotificationPreferencesSection({
  profile,
}: {
  profile: { notification_preferences: Record<string, { email: boolean; in_app: boolean }> };
}) {
  const { t } = useTranslation();
  const updatePrefs = useUpdateNotificationPreferences();
  const [prefs, setPrefs] = useState(profile.notification_preferences);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setPrefs(profile.notification_preferences);
  }, [profile.notification_preferences]);

  const togglePref = (category: string, channel: "email" | "in_app") => {
    setPrefs((prev) => ({
      ...prev,
      [category]: {
        email: prev[category]?.email ?? true,
        in_app: prev[category]?.in_app ?? true,
        [channel]: !(prev[category]?.[channel] ?? true),
      },
    }));
  };

  const handleSave = () => {
    setSuccessMsg("");
    updatePrefs.mutate(prefs, {
      onSuccess: () =>
        setSuccessMsg(t("portal.profile.notificationPreferences.saveSuccess")),
    });
  };

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-gray-900">
        {t("portal.profile.notificationPreferences.title")}
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        {t("portal.profile.notificationPreferences.description")}
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                &nbsp;
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("portal.profile.notificationPreferences.email")}
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                {t("portal.profile.notificationPreferences.inApp")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {NOTIFICATION_CATEGORIES.map((category) => (
              <tr key={category}>
                <td className="px-4 py-3 text-sm capitalize text-gray-700">
                  {t(`portal.notifications.categories.${category}`)}
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={prefs[category]?.email ?? true}
                    onChange={() => togglePref(category, "email")}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={prefs[category]?.in_app ?? true}
                    onChange={() => togglePref(category, "in_app")}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleSave} loading={updatePrefs.isPending}>
          {t("portal.profile.notificationPreferences.save")}
        </Button>
        {successMsg && (
          <span className="text-sm text-green-600">{successMsg}</span>
        )}
        {updatePrefs.isError && (
          <span className="text-sm text-red-600">
            {t("portal.profile.notificationPreferences.saveError")}
          </span>
        )}
      </div>
    </Card>
  );
}
