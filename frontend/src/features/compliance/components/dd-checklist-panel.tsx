import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  useDDChecklists,
  useUpdateChecklist,
  useCompleteChecklist,
  type DDChecklist,
  type DDChecklistItem,
} from "../api/dd-api";

// ---------------------------------------------------------------------------
// Section Configuration
// ---------------------------------------------------------------------------

const DD_SECTIONS = [
  {
    key: "entity_details",
    labelKey: "dueDiligence.checklist.sections.entity_details",
    fallback: "Entity Details",
    defaultItems: [
      { key: "entity_name_verified", labelKey: "dueDiligence.checklist.items.entity_name_verified" },
      { key: "jurisdiction_confirmed", labelKey: "dueDiligence.checklist.items.jurisdiction_confirmed" },
      { key: "incorporation_docs", labelKey: "dueDiligence.checklist.items.incorporation_docs" },
      { key: "registered_agent", labelKey: "dueDiligence.checklist.items.registered_agent" },
      { key: "good_standing", labelKey: "dueDiligence.checklist.items.good_standing" },
    ],
  },
  {
    key: "directors_officers",
    labelKey: "dueDiligence.checklist.sections.directors_officers",
    fallback: "Directors & Officers",
    defaultItems: [
      { key: "directors_identified", labelKey: "dueDiligence.checklist.items.directors_identified" },
      { key: "directors_id_verified", labelKey: "dueDiligence.checklist.items.directors_id_verified" },
      { key: "directors_pep_check", labelKey: "dueDiligence.checklist.items.directors_pep_check" },
      { key: "officers_documented", labelKey: "dueDiligence.checklist.items.officers_documented" },
      { key: "powers_of_attorney", labelKey: "dueDiligence.checklist.items.powers_of_attorney" },
    ],
  },
  {
    key: "shareholders",
    labelKey: "dueDiligence.checklist.sections.shareholders",
    fallback: "Shareholders",
    defaultItems: [
      { key: "share_register_reviewed", labelKey: "dueDiligence.checklist.items.share_register_reviewed" },
      { key: "shareholder_ids", labelKey: "dueDiligence.checklist.items.shareholder_ids" },
      { key: "ownership_confirmed", labelKey: "dueDiligence.checklist.items.ownership_confirmed" },
      { key: "corporate_shareholders", labelKey: "dueDiligence.checklist.items.corporate_shareholders" },
    ],
  },
  {
    key: "beneficial_owners",
    labelKey: "dueDiligence.checklist.sections.beneficial_owners",
    fallback: "Beneficial Owners",
    defaultItems: [
      { key: "ubo_identified", labelKey: "dueDiligence.checklist.items.ubo_identified" },
      { key: "ubo_id_verified", labelKey: "dueDiligence.checklist.items.ubo_id_verified" },
      { key: "ubo_sow_documented", labelKey: "dueDiligence.checklist.items.ubo_sow_documented" },
      { key: "ubo_pep_check", labelKey: "dueDiligence.checklist.items.ubo_pep_check" },
      { key: "ubo_worldcheck", labelKey: "dueDiligence.checklist.items.ubo_worldcheck" },
    ],
  },
  {
    key: "attorneys_in_fact",
    labelKey: "dueDiligence.checklist.sections.attorneys_in_fact",
    fallback: "Attorneys-in-Fact",
    defaultItems: [
      { key: "poa_documents", labelKey: "dueDiligence.checklist.items.poa_documents" },
      { key: "attorney_id_verified", labelKey: "dueDiligence.checklist.items.attorney_id_verified" },
      { key: "scope_of_authority", labelKey: "dueDiligence.checklist.items.scope_of_authority" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DDChecklistPanelProps {
  kycId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DDChecklistPanel({ kycId }: DDChecklistPanelProps) {
  const { t } = useTranslation("common");
  const checklistsQuery = useDDChecklists(kycId);
  const updateMutation = useUpdateChecklist();
  const completeMutation = useCompleteChecklist();

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(DD_SECTIONS.map((s) => s.key)),
  );

  // Merge server data with default sections
  const sectionData = useMemo(() => {
    const serverChecklists = checklistsQuery.data ?? [];
    const serverMap = new Map<string, DDChecklist>();
    for (const cl of serverChecklists) {
      serverMap.set(cl.section, cl);
    }

    return DD_SECTIONS.map((section) => {
      const server = serverMap.get(section.key);
      const items: DDChecklistItem[] = server
        ? server.items
        : section.defaultItems.map((di) => ({
            key: di.key,
            label: t(di.labelKey, di.key),
            completed: false,
          }));

      return {
        ...section,
        checklistId: server?.id ?? null,
        items,
        isComplete: server?.is_complete ?? false,
      };
    });
  }, [checklistsQuery.data]);

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleToggleItem = (sectionKey: string, itemKey: string) => {
    const section = sectionData.find((s) => s.key === sectionKey);
    if (!section) return;

    const updatedItems = section.items.map((item) =>
      item.key === itemKey ? { ...item, completed: !item.completed } : item,
    );

    updateMutation.mutate({
      kycId,
      section: sectionKey,
      items: updatedItems,
    });
  };

  const handleCompleteSection = (sectionKey: string) => {
    const section = sectionData.find((s) => s.key === sectionKey);
    if (!section?.checklistId) return;

    completeMutation.mutate({
      kycId,
      checklistId: section.checklistId,
    });
  };

  if (checklistsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {t("dueDiligence.checklist.title", "Due Diligence Checklist")}
      </h3>

      {sectionData.map((section) => {
        const isExpanded = expandedSections.has(section.key);
        const completedCount = section.items.filter((i) => i.completed).length;
        const totalCount = section.items.length;
        const allChecked = completedCount === totalCount && totalCount > 0;
        const progressPct =
          totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return (
          <div
            key={section.key}
            className="rounded-lg border border-gray-200 bg-white"
          >
            {/* Section Header */}
            <button
              type="button"
              onClick={() => toggleSection(section.key)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`h-4 w-4 text-gray-400 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
                <span className="text-sm font-semibold text-gray-900">
                  {t(section.labelKey, section.fallback)}
                </span>
                {section.isComplete && (
                  <Badge color="green">
                    {t("dueDiligence.checklist.completed", "Complete")}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {completedCount}/{totalCount}
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      allChecked ? "bg-green-500" : "bg-primary"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </button>

            {/* Section Items */}
            {isExpanded && (
              <div className="border-t border-gray-200 px-4 py-3">
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item.key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() =>
                          handleToggleItem(section.key, item.key)
                        }
                        disabled={section.isComplete}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span
                        className={`text-sm ${
                          item.completed
                            ? "text-gray-400 line-through"
                            : "text-gray-700"
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.completed_by && item.completed_at && (
                        <span className="ml-auto text-xs text-gray-400">
                          {item.completed_by} &middot;{" "}
                          {new Date(item.completed_at).toLocaleDateString()}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Mark Section Complete */}
                {!section.isComplete && allChecked && section.checklistId && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={completeMutation.isPending}
                      onClick={() => handleCompleteSection(section.key)}
                    >
                      {t("dueDiligence.checklist.markComplete", "Mark Section Complete")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
