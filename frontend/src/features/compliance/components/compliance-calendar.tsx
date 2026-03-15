import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { PaginatedResponse } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceDeadline {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  type: "kyc_renewal" | "es_deadline" | "ar_deadline";
  entityName: string;
  entityId: string;
  description: string;
}

interface DeadlineEntity {
  id: string;
  name: string;
  jurisdiction: string;
  client_name: string;
  status: string;
  kyc_status: string | null;
  es_status: string | null;
  ar_status: string | null;
  risk_level: string | null;
  risk_score: number | null;
}

// ---------------------------------------------------------------------------
// Deadline computation (client-side)
// ---------------------------------------------------------------------------

/**
 * Generates compliance deadlines for a given year based on entity data.
 *
 * Since there is no dedicated backend endpoint, deadlines are derived from
 * entity jurisdiction and status:
 * - KYC Renewal: Annual renewal, due on the anniversary month or a default
 *   date (entities with pending/draft KYC are assumed due within the year).
 * - ES Deadline: BVI entities have an ES filing deadline of June 30.
 * - AR Deadline: Panama entities have accounting record deadlines of March 31.
 */
function computeDeadlines(
  entities: DeadlineEntity[],
  year: number,
): ComplianceDeadline[] {
  const deadlines: ComplianceDeadline[] = [];

  for (const entity of entities) {
    if (entity.status === "dissolved" || entity.status === "struck_off") {
      continue;
    }

    // KYC renewal: assume annual renewal. If KYC is not approved,
    // the renewal is more urgent. Place on the 15th of each quarter.
    const kycQuarterMonth =
      entity.kyc_status === "approved"
        ? 11 // December for approved - annual renewal
        : entity.kyc_status === "draft" || entity.kyc_status === "submitted"
          ? new Date().getMonth() // current month if in progress
          : 5; // June default

    deadlines.push({
      id: `kyc-${entity.id}-${year}`,
      date: `${year}-${String(kycQuarterMonth + 1).padStart(2, "0")}-15`,
      type: "kyc_renewal",
      entityName: entity.name,
      entityId: entity.id,
      description:
        entity.kyc_status === "approved"
          ? `KYC annual renewal`
          : `KYC pending review`,
    });

    // ES deadline: BVI entities only - June 30
    if (entity.jurisdiction === "bvi") {
      deadlines.push({
        id: `es-${entity.id}-${year}`,
        date: `${year}-06-30`,
        type: "es_deadline",
        entityName: entity.name,
        entityId: entity.id,
        description:
          entity.es_status === "completed"
            ? `ES declaration completed`
            : `ES filing deadline`,
      });
    }

    // AR deadline: Panama entities only - March 31
    if (entity.jurisdiction === "panama") {
      deadlines.push({
        id: `ar-${entity.id}-${year}`,
        date: `${year}-03-31`,
        type: "ar_deadline",
        entityName: entity.name,
        entityId: entity.id,
        description:
          entity.ar_status === "approved"
            ? `Accounting record filed`
            : `Accounting record deadline`,
      });
    }
  }

  return deadlines;
}

// ---------------------------------------------------------------------------
// API Hook
// ---------------------------------------------------------------------------

function useComplianceDeadlines(year: number) {
  return useQuery({
    queryKey: ["complianceCalendar", "deadlines", year],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<DeadlineEntity>>(
        "/compliance/overview-entities/",
        { per_page: "500" },
      );
      return computeDeadlines(response.results, year);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

const MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

const WEEKDAY_KEYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the day-of-week for the 1st of the given month.
 * Adjusted so Monday = 0, Sunday = 6.
 */
function getStartDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return (
    now.getFullYear() === year &&
    now.getMonth() === month &&
    now.getDate() === day
  );
}

const DOT_COLORS: Record<ComplianceDeadline["type"], string> = {
  kyc_renewal: "bg-red-500",
  es_deadline: "bg-blue-500",
  ar_deadline: "bg-yellow-500",
};

const BADGE_COLORS: Record<ComplianceDeadline["type"], "red" | "blue" | "yellow"> = {
  kyc_renewal: "red",
  es_deadline: "blue",
  ar_deadline: "yellow",
};

// ---------------------------------------------------------------------------
// Popover Component
// ---------------------------------------------------------------------------

interface DayPopoverProps {
  deadlines: ComplianceDeadline[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}

function DayPopover({ deadlines, anchorRef, onClose, t }: DayPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={popoverRef}
      className="absolute left-1/2 top-full z-50 mt-1 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
    >
      <ul className="space-y-2">
        {deadlines.map((d) => (
          <li key={d.id} className="flex items-start gap-2">
            <span
              className={`mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT_COLORS[d.type]}`}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {d.entityName}
              </p>
              <p className="text-xs text-gray-500">{d.description}</p>
              <Badge
                color={BADGE_COLORS[d.type]}
                className="mt-0.5"
              >
                {t(
                  `complianceCalendar.${d.type === "kyc_renewal" ? "kycRenewal" : d.type === "es_deadline" ? "esDeadline" : "arDeadline"}`,
                  d.type,
                )}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day Cell
// ---------------------------------------------------------------------------

interface DayCellProps {
  day: number;
  year: number;
  month: number;
  deadlines: ComplianceDeadline[];
  isSelected: boolean;
  onSelect: (day: number) => void;
  t: (key: string, fallback?: string) => string;
}

function DayCell({
  day,
  year,
  month,
  deadlines,
  isSelected,
  onSelect,
  t,
}: DayCellProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const today = isToday(year, month, day);
  const hasDeadlines = deadlines.length > 0;

  // Get unique deadline types for this day
  const types = useMemo(() => {
    const set = new Set<ComplianceDeadline["type"]>();
    deadlines.forEach((d) => set.add(d.type));
    return Array.from(set);
  }, [deadlines]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => hasDeadlines && onSelect(isSelected ? -1 : day)}
        className={`
          flex h-10 w-full flex-col items-center justify-center rounded-lg text-sm transition-colors
          ${today ? "font-bold ring-2 ring-primary/50" : ""}
          ${today ? "bg-primary/10 text-primary" : "text-gray-700"}
          ${hasDeadlines ? "cursor-pointer hover:bg-gray-100" : "cursor-default"}
          ${isSelected ? "bg-gray-100 ring-2 ring-primary" : ""}
        `}
      >
        <span>{day}</span>
        {hasDeadlines && (
          <span className="flex gap-0.5">
            {types.map((type) => (
              <span
                key={type}
                className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLORS[type]}`}
              />
            ))}
          </span>
        )}
      </button>
      {isSelected && hasDeadlines && (
        <DayPopover
          deadlines={deadlines}
          anchorRef={btnRef}
          onClose={() => onSelect(-1)}
          t={t}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Calendar Component
// ---------------------------------------------------------------------------

export function ComplianceCalendar() {
  const { t } = useTranslation("common");

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(-1);

  const deadlinesQuery = useComplianceDeadlines(currentYear);
  const deadlines = deadlinesQuery.data ?? [];

  // Group deadlines by date key
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, ComplianceDeadline[]>();
    for (const d of deadlines) {
      const key = d.date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(d);
    }
    return map;
  }, [deadlines]);

  // Navigation
  const goToPreviousMonth = () => {
    setSelectedDay(-1);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    setSelectedDay(-1);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setSelectedDay(-1);
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Calendar grid computation
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startDayOfWeek = getStartDayOfWeek(currentYear, currentMonth);

  // Count deadlines in current month for the legend
  const monthDeadlineCounts = useMemo(() => {
    const counts = { kyc_renewal: 0, es_deadline: 0, ar_deadline: 0 };
    for (const d of deadlines) {
      const dDate = new Date(d.date);
      if (
        dDate.getFullYear() === currentYear &&
        dDate.getMonth() === currentMonth
      ) {
        counts[d.type]++;
      }
    }
    return counts;
  }, [deadlines, currentYear, currentMonth]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("complianceCalendar.title", "Compliance Calendar")}
        </h2>
        <Button variant="secondary" size="sm" onClick={goToToday}>
          {t("complianceCalendar.today", "Today")}
        </Button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Previous month"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        <span className="text-base font-medium text-gray-900">
          {t(
            `complianceCalendar.months.${MONTH_KEYS[currentMonth]}`,
            MONTH_KEYS[currentMonth],
          )}{" "}
          {currentYear}
        </span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Next month"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>

      {deadlinesQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : (
        <div className="px-4 pb-4 sm:px-6">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_KEYS.map((wd) => (
              <div
                key={wd}
                className="py-2 text-xs font-medium uppercase text-gray-500"
              >
                {t(`complianceCalendar.weekdays.${wd}`, wd)}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before month start */}
            {Array.from({ length: startDayOfWeek }, (_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateKey = toDateKey(currentYear, currentMonth, day);
              const dayDeadlines = deadlinesByDate.get(dateKey) ?? [];
              return (
                <DayCell
                  key={day}
                  day={day}
                  year={currentYear}
                  month={currentMonth}
                  deadlines={dayDeadlines}
                  isSelected={selectedDay === day}
                  onSelect={setSelectedDay}
                  t={t}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-gray-600">
            {t("complianceCalendar.kycRenewal", "KYC Renewal")}
            {monthDeadlineCounts.kyc_renewal > 0 && (
              <span className="ml-1 text-gray-400">
                ({monthDeadlineCounts.kyc_renewal})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-xs text-gray-600">
            {t("complianceCalendar.esDeadline", "ES Deadline")}
            {monthDeadlineCounts.es_deadline > 0 && (
              <span className="ml-1 text-gray-400">
                ({monthDeadlineCounts.es_deadline})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <span className="text-xs text-gray-600">
            {t("complianceCalendar.arDeadline", "AR Deadline")}
            {monthDeadlineCounts.ar_deadline > 0 && (
              <span className="ml-1 text-gray-400">
                ({monthDeadlineCounts.ar_deadline})
              </span>
            )}
          </span>
        </div>
        {deadlines.length === 0 && !deadlinesQuery.isLoading && (
          <span className="text-xs text-gray-400">
            {t("complianceCalendar.noDeadlines", "No deadlines this year")}
          </span>
        )}
      </div>
    </div>
  );
}
