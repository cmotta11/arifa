import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "@/components/navigation/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { UserManagement } from "../components/user-management";
import { WorkflowConfig } from "../components/workflow-config";
import { JurisdictionRiskManagement } from "../components/jurisdiction-risk-management";
import { SystemSettings } from "../components/system-settings";

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

type AdminTab = "users" | "workflow" | "jurisdiction" | "settings";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");

  // Access control: only directors can access the admin panel
  if (user?.role !== "director") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {t("admin.accessDenied")}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {t("admin.accessDeniedMessage")}
          </p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "users" as const, label: t("admin.tabs.users") },
    { key: "workflow" as const, label: t("admin.tabs.workflow") },
    { key: "jurisdiction" as const, label: t("admin.tabs.jurisdiction") },
    { key: "settings" as const, label: t("admin.tabs.settings") },
  ];

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("admin.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("admin.description")}
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as AdminTab)}
        className="mb-6"
      />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "users" && <UserManagement />}
        {activeTab === "workflow" && <WorkflowConfig />}
        {activeTab === "jurisdiction" && <JurisdictionRiskManagement />}
        {activeTab === "settings" && <SystemSettings />}
      </div>
    </div>
  );
}
