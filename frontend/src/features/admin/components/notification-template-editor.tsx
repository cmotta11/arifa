import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useNotificationTemplates } from "@/features/notifications/api/notifications-api";
import type { NotificationTemplate } from "@/features/notifications/api/notifications-api";

const categoryColors: Record<string, "blue" | "green" | "yellow" | "red" | "gray"> = {
  ticket: "blue",
  kyc: "green",
  compliance: "yellow",
  rpa: "gray",
  document: "blue",
  system: "gray",
  reminder: "yellow",
};

export function NotificationTemplateEditor() {
  const { t } = useTranslation();
  const { data, isLoading } = useNotificationTemplates({ page_size: "100" });

  const templates = data?.results ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  // Group templates by category
  const grouped = templates.reduce<Record<string, NotificationTemplate[]>>((acc, tmpl) => {
    const cat = tmpl.category || "system";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tmpl);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          {t("admin.notificationTemplates.title")}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {t("admin.notificationTemplates.description")}
        </p>
      </div>

      {Object.entries(grouped).map(([category, tmpls]) => (
        <div key={category} className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h4 className="text-sm font-semibold text-gray-700">
              {t(`notifications.categories.${category}`, category)}
            </h4>
          </div>
          <div className="divide-y divide-gray-100">
            {tmpls.map((tmpl) => (
              <div key={tmpl.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {tmpl.display_name}
                    </p>
                    <Badge color={categoryColors[tmpl.category] || "gray"}>
                      {tmpl.key}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {tmpl.subject_template}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {tmpl.default_channel}
                  </span>
                  <Badge color={tmpl.is_active ? "green" : "red"}>
                    {tmpl.is_active
                      ? t("common.active", "Active")
                      : t("common.inactive", "Inactive")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-500">
          {t("admin.notificationTemplates.empty", "No notification templates found. Run the seed command.")}
        </p>
      )}
    </div>
  );
}
