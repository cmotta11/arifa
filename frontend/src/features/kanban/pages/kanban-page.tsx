import { useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Ticket } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import { TicketCreateModal } from "@/features/tickets/components/ticket-create-modal";
import { getWorkflowStates, getTickets, transitionTicket, type KanbanView } from "../api/kanban-api";
import { KanbanColumn } from "../components/kanban-column";
import { KanbanCard } from "../components/kanban-card";

function useViewOptions() {
  const { t } = useTranslation();
  return [
    { value: "all", label: t("kanban.views.all") },
    { value: "my", label: t("kanban.views.my") },
    { value: "gestora", label: t("kanban.views.gestora") },
    { value: "compliance", label: t("kanban.views.compliance") },
    { value: "registry", label: t("kanban.views.registry") },
  ];
}

function getDefaultView(role: string | undefined): KanbanView {
  switch (role) {
    case "director":
    case "coordinator":
      return "all";
    case "compliance_officer":
      return "compliance";
    case "gestora":
      return "gestora";
    case "client":
      return "my";
    default:
      return "all";
  }
}

export default function KanbanPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const viewOptions = useViewOptions();
  const [selectedView, setSelectedView] = useState<KanbanView>(
    getDefaultView(user?.role),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const statesQuery = useQuery({
    queryKey: ["workflow", "states"],
    queryFn: getWorkflowStates,
  });

  const ticketsQuery = useQuery({
    queryKey: ["kanban", "tickets", selectedView],
    queryFn: () => getTickets(selectedView),
  });

  const transitionMutation = useMutation({
    mutationFn: ({
      ticketId,
      newStateId,
    }: {
      ticketId: string;
      newStateId: string;
    }) => transitionTicket(ticketId, newStateId),
    onMutate: async ({ ticketId, newStateId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["kanban", "tickets", selectedView] });

      // Snapshot previous value
      const previousTickets = queryClient.getQueryData<Ticket[]>([
        "kanban",
        "tickets",
        selectedView,
      ]);

      // Optimistically update the ticket's current state
      queryClient.setQueryData<Ticket[]>(["kanban", "tickets", selectedView], (old) => {
        if (!old) return old;
        const targetState = statesQuery.data?.find((s) => s.id === newStateId);
        if (!targetState) return old;

        return old.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, current_state: targetState }
            : ticket
        );
      });

      return { previousTickets };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousTickets) {
        queryClient.setQueryData(
          ["kanban", "tickets", selectedView],
          context.previousTickets
        );
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ["kanban", "tickets", selectedView] });
    },
  });

  // Group tickets by state
  const ticketsByState = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    if (statesQuery.data) {
      for (const state of statesQuery.data) {
        map.set(state.id, []);
      }
    }
    if (ticketsQuery.data) {
      for (const ticket of ticketsQuery.data) {
        const stateId = ticket.current_state.id;
        const existing = map.get(stateId) ?? [];
        existing.push(ticket);
        map.set(stateId, existing);
      }
    }
    return map;
  }, [statesQuery.data, ticketsQuery.data]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const ticket = ticketsQuery.data?.find((t) => t.id === active.id);
      if (ticket) {
        setActiveTicket(ticket);
      }
    },
    [ticketsQuery.data]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTicket(null);

      const { active, over } = event;
      if (!over) return;

      // Determine the target column's state ID
      let targetStateId: string | null = null;

      if (typeof over.id === "string" && over.id.startsWith("column-")) {
        targetStateId = over.id.replace("column-", "");
      } else {
        // Dropped over another ticket card - find its column
        const overTicket = ticketsQuery.data?.find((t) => t.id === over.id);
        if (overTicket) {
          targetStateId = overTicket.current_state.id;
        }
      }

      if (!targetStateId) return;

      const draggedTicket = ticketsQuery.data?.find((t) => t.id === active.id);
      if (!draggedTicket) return;

      // Only transition if the state actually changed
      if (draggedTicket.current_state.id === targetStateId) return;

      transitionMutation.mutate({
        ticketId: draggedTicket.id,
        newStateId: targetStateId,
      });
    },
    [ticketsQuery.data, transitionMutation]
  );

  const isLoading = statesQuery.isLoading || ticketsQuery.isLoading;
  const isError = statesQuery.isError || ticketsQuery.isError;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const sortedStates = [...(statesQuery.data ?? [])].sort(
    (a, b) => a.order_index - b.order_index
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("kanban.title")}
        </h1>
        <div className="flex items-center gap-4">
          <div className="w-52">
            <Select
              options={viewOptions}
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value as KanbanView)}
            />
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
          >
            {t("kanban.createTicket")}
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 pb-4" style={{ minHeight: "calc(100% - 2rem)" }}>
            {sortedStates.map((state) => (
              <KanbanColumn
                key={state.id}
                state={state}
                tickets={ticketsByState.get(state.id) ?? []}
              />
            ))}
          </div>

          {/* Drag overlay - shows a ghost card while dragging */}
          <DragOverlay>
            {activeTicket ? <KanbanCard ticket={activeTicket} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
      {/* Create Ticket Modal */}
      <TicketCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          ticketsQuery.refetch();
        }}
      />
    </div>
  );
}
