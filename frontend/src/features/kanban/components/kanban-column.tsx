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
}

export function KanbanColumn({ state, tickets }: KanbanColumnProps) {
  const { t } = useTranslation();

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${state.id}`,
    data: {
      type: "column",
      state,
    },
  });

  const ticketIds = tickets.map((ticket) => ticket.id);

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-gray-50">
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-700">{state.name}</h3>
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-200 px-1.5 text-xs font-medium text-gray-600">
          {tickets.length}
        </span>
      </div>

      {/* Droppable ticket list */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-3 transition-colors ${
          isOver ? "bg-arifa-navy/5" : ""
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
              <KanbanCard key={ticket.id} ticket={ticket} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
