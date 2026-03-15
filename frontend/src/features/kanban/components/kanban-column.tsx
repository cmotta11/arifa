import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useTranslation } from "react-i18next";
import type { WorkflowState, Ticket } from "@/types";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  state: WorkflowState;
  tickets: Ticket[];
  selectedTicketIds: Set<string>;
  onToggleSelect: (ticketId: string) => void;
}

export const KanbanColumn = memo(function KanbanColumn({
  state,
  tickets,
  selectedTicketIds,
  onToggleSelect,
}: KanbanColumnProps) {
  const { t } = useTranslation();

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${state.id}`,
    data: {
      type: "column",
      state,
    },
  });

  const ticketIds = tickets.map((ticket) => ticket.id);
  const headerColor = state.color || "#6B7280";

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-gray-50">
      {/* Column header with state color accent */}
      <div className="relative overflow-hidden rounded-t-lg border-b border-surface-border px-4 py-3">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: headerColor }}
        />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: headerColor }}
            />
            <h3 className="text-sm font-semibold text-gray-700">
              {state.name}
            </h3>
          </div>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-600">
            {tickets.length}
          </span>
        </div>
      </div>

      {/* Droppable ticket list */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-3 transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
        style={{ minHeight: "120px" }}
      >
        <SortableContext
          items={ticketIds}
          strategy={verticalListSortingStrategy}
        >
          {tickets.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">
              {t("kanban.noTickets")}
            </p>
          ) : (
            tickets.map((ticket) => (
              <KanbanCard
                key={ticket.id}
                ticket={ticket}
                isSelected={selectedTicketIds.has(ticket.id)}
                onToggleSelect={onToggleSelect}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
});
