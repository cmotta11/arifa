import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Ticket } from "@/types";

interface KanbanCardProps {
  ticket: Ticket;
  isSelected?: boolean;
  onToggleSelect?: (ticketId: string) => void;
}

const priorityColorMap: Record<
  Ticket["priority"],
  "gray" | "green" | "yellow" | "red"
> = {
  low: "gray",
  medium: "green",
  high: "yellow",
  urgent: "red",
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const KanbanCard = memo(function KanbanCard({
  ticket,
  isSelected = false,
  onToggleSelect,
}: KanbanCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    data: {
      type: "ticket",
      ticket,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = () => {
    navigate(`/tickets/${ticket.id}`);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(ticket.id);
  };

  const dueDate = formatDueDate(ticket.due_date);
  const isOverdue =
    ticket.due_date && new Date(ticket.due_date) < new Date();

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={`cursor-grab p-4 transition-shadow hover:shadow-md active:cursor-grabbing ${
          isSelected ? "ring-2 ring-primary" : ""
        }`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className="flex items-start gap-2">
          {/* Selection checkbox */}
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onClick={handleCheckboxClick}
              onChange={() => {}}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              aria-label={`Select ticket: ${ticket.title}`}
            />
          )}
          <div className="min-w-0 flex-1">
            {/* Title */}
            <p className="mb-1 text-sm font-medium text-gray-900 line-clamp-2">
              {ticket.title}
            </p>

            {/* Client + Workflow badge */}
            <div className="mb-2 flex items-center gap-2">
              <p className="truncate text-xs text-gray-500">
                {ticket.client_name || ticket.client.name}
              </p>
              {ticket.workflow_definition_name && (
                <Badge color="blue" className="text-[10px] whitespace-nowrap">
                  {ticket.workflow_definition_name}
                </Badge>
              )}
            </div>

            {/* Bottom row: priority, sub-tickets, assignee, due date */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Badge color={priorityColorMap[ticket.priority]}>
                  {t(`priority.${ticket.priority}`)}
                </Badge>
                {ticket.sub_ticket_count > 0 && (
                  <span className="text-[10px] text-gray-400">
                    +{ticket.sub_ticket_count}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Due date */}
                {dueDate && (
                  <span
                    className={`text-xs ${
                      isOverdue ? "font-medium text-error" : "text-gray-400"
                    }`}
                  >
                    {dueDate}
                  </span>
                )}

                {/* Assigned user avatar / initials */}
                {ticket.assigned_to && (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-white"
                    title={`${ticket.assigned_to.first_name} ${ticket.assigned_to.last_name}`}
                  >
                    {getInitials(
                      ticket.assigned_to.first_name,
                      ticket.assigned_to.last_name,
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});
