import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Ticket } from "@/types";

interface KanbanCardProps {
  ticket: Ticket;
}

const priorityColorMap: Record<Ticket["priority"], "gray" | "green" | "yellow" | "red"> = {
  low: "gray",
  medium: "green",
  high: "yellow",
  urgent: "red",
};

const priorityLabelMap: Record<Ticket["priority"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function KanbanCard({ ticket }: KanbanCardProps) {
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

  const dueDate = formatDueDate(ticket.due_date);
  const isOverdue =
    ticket.due_date && new Date(ticket.due_date) < new Date();

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="cursor-grab p-4 transition-shadow hover:shadow-md active:cursor-grabbing"
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
        {/* Title */}
        <p className="mb-2 text-sm font-medium text-gray-900 line-clamp-2">
          {ticket.title}
        </p>

        {/* Client */}
        <p className="mb-3 text-xs text-gray-500 truncate">
          {ticket.client.name}
        </p>

        {/* Bottom row: priority, assignee, due date */}
        <div className="flex items-center justify-between gap-2">
          <Badge color={priorityColorMap[ticket.priority]}>
            {priorityLabelMap[ticket.priority]}
          </Badge>

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
                className="flex h-6 w-6 items-center justify-center rounded-full bg-arifa-navy text-[10px] font-medium text-white"
                title={`${ticket.assigned_to.first_name} ${ticket.assigned_to.last_name}`}
              >
                {getInitials(
                  ticket.assigned_to.first_name,
                  ticket.assigned_to.last_name
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
