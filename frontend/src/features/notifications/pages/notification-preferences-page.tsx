import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../api/notifications-api";

const CATEGORIES = [
  { key: "ticket", labelKey: "notifications.categories.ticket" },
  { key: "kyc", labelKey: "notifications.categories.kyc" },
  { key: "compliance", labelKey: "notifications.categories.compliance" },
  { key: "rpa", labelKey: "notifications.categories.rpa" },
  { key: "document", labelKey: "notifications.categories.document" },
  { key: "system", labelKey: "notifications.categories.system" },
  { key: "reminder", labelKey: "notifications.categories.reminder" },
];

const CHANNEL_OPTIONS = [
  { value: "both", labelKey: "notifications.channels.both" },
  { value: "in_app", labelKey: "notifications.channels.inApp" },
  { value: "email", labelKey: "notifications.channels.email" },
  { value: "none", labelKey: "notifications.channels.none" },
];

export default function NotificationPreferencesPage() {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const [categoryChannels, setCategoryChannels] = useState<Record<string, string>>({});
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestHour, setDigestHour] = useState(8);

  useEffect(() => {
    if (preferences) {
      setCategoryChannels(preferences.category_channels || {});
      setDigestEnabled(preferences.daily_digest_enabled);
      setDigestHour(preferences.digest_hour);
    }
  }, [preferences]);

  const handleSave = () => {
    updatePreferences.mutate({
      category_channels: categoryChannels,
      daily_digest_enabled: digestEnabled,
      digest_hour: digestHour,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("notifications.preferences")}
        </h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Category channel preferences */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            {t("notifications.channelPreferences")}
          </h3>
          <p className="mb-6 text-sm text-gray-500">
            {t("notifications.channelPreferencesDesc")}
          </p>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between">
                <label
                  htmlFor={`channel-${cat.key}`}
                  className="text-sm font-medium text-gray-700"
                >
                  {t(cat.labelKey)}
                </label>
                <select
                  id={`channel-${cat.key}`}
                  value={categoryChannels[cat.key] || "both"}
                  onChange={(e) =>
                    setCategoryChannels((prev) => ({
                      ...prev,
                      [cat.key]: e.target.value,
                    }))
                  }
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Daily digest */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            {t("notifications.dailyDigest")}
          </h3>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                {t("notifications.enableDailyDigest")}
              </span>
            </label>

            {digestEnabled && (
              <div className="flex items-center gap-3">
                <label
                  htmlFor="digest-hour"
                  className="text-sm text-gray-700"
                >
                  {t("notifications.digestHour")}
                </label>
                <select
                  id="digest-hour"
                  value={digestHour}
                  onChange={(e) => setDigestHour(Number(e.target.value))}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updatePreferences.isPending}
          >
            {updatePreferences.isPending
              ? t("common.saving")
              : t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
