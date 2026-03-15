import { useCallback, useMemo, useRef, useState } from "react";
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
import {
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import { StatCard } from "@/components/data-display/stat-card";
import { Spinner } from "@/components/ui/spinner";
import type { Ticket } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getWorkflowStates,
  getTickets,
  transitionTicket,
} from "@/features/kanban/api/kanban-api";
import { KanbanColumn } from "@/features/kanban/components/kanban-column";
import { KanbanCard } from "@/features/kanban/components/kanban-card";

const DOC_PROCESSING_STATES = [
  "DOC_PROCESSING",
  "NOTARY",
  "REGISTRY",
  "DELIVERED",
];

export default function GestoraDashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Fetch all workflow states (filter to relevant ones)
  const statesQuery = useQuery({
    queryKey: ["gestora", "states"],
    queryFn: () => getWorkflowStates(),
  });

  // Fetch only tickets assigned to current user via gestora view
  const ticketsQuery = useQuery({
    queryKey: ["gestora", "tickets"],
    queryFn: () => getTickets("gestora"),
  });

  const ticketsKey = ["gestora", "tickets"];

  const transitionMutation = useMutation({
    mutationFn: ({ ticketId, newStateId }: { ticketId: string; newStateId: string }) =>
      transitionTicket(ticketId, newStateId),
    onMutate: async ({ ticketId, newStateId }) => {
      await queryClient.cancelQueries({ queryKey: ticketsKey });
      const previousTickets = queryClient.getQueryData<Ticket[]>(ticketsKey);

      queryClient.setQueryData<Ticket[]>(ticketsKey, (old) => {
        if (!old) return old;
        const targetState = relevantStates.find((s) => s.id === newStateId);
        if (!targetState) return old;
        return old.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, current_state: targetState } : ticket,
        );
      });

      return { previousTickets };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(ticketsKey, context.previousTickets);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ticketsKey });
    },
  });

  const transitionMutationRef = useRef(transitionMutation);
  transitionMutationRef.current = transitionMutation;

  // Filter states to DOC_PROCESSING workflow stages
  const relevantStates = useMemo(() => {
    if (!statesQuery.data) return [];
    return statesQuery.data
      .filter(
        (s) =>
          DOC_PROCESSING_STATES.some((name) =>
            s.name.toUpperCase().includes(name),
          ) || s.workflow_definition_name?.startsWith("INC_"),
      )
      .sort((a, b) => a.order_index - b.order_index);
  }, [statesQuery.data]);

  // Use all states if no DOC_PROCESSING states found
  const displayStates = relevantStates.length > 0
    ? relevantStates
    : [...(statesQuery.data ?? [])].sort((a, b) => a.order_index - b.order_index);

  // Group tickets by state
  const ticketsByState = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const state of displayStates) {
      map.set(state.id, []);
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
  }, [displayStates, ticketsQuery.data]);

  // Quick stats
  const stats = useMemo(() => {
    const allTickets = ticketsQuery.data ?? [];
    const myTickets = allTickets.filter(
      (t) => t.assigned_to?.id === user?.id,
    );
    const pendingDeeds = allTickets.filter((t) =>
      t.current_state.name.toUpperCase().includes("DOC_PROCESSING"),
    );
    const inNotary = allTickets.filter((t) =>
      t.current_state.name.toUpperCase().includes("NOTARY"),
    );
    const today = new Date().toISOString().slice(0, 10);
    const completedToday = allTickets.filter(
      (t) =>
        t.current_state.is_final &&
        t.updated_at.slice(0, 10) === today,
    );

    return {
      myActive: myTickets.length,
      pendingDeeds: pendingDeeds.length,
      inNotary: inNotary.length,
      completedToday: completedToday.length,
    };
  }, [ticketsQuery.data, user?.id]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const ticket = ticketsQuery.data?.find((t) => t.id === event.active.id);
      if (ticket) setActiveTicket(ticket);
    },
    [ticketsQuery.data],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTicket(null);
      const { active, over } = event;
      if (!over) return;

      let targetStateId: string | null = null;
      if (typeof over.id === "string" && over.id.startsWith("column-")) {
        targetStateId = over.id.replace("column-", "");
      } else {
        const overTicket = ticketsQuery.data?.find((t) => t.id === over.id);
        if (overTicket) targetStateId = overTicket.current_state.id;
      }

      if (!targetStateId) return;

      const draggedTicket = ticketsQuery.data?.find((t) => t.id === active.id);
      if (!draggedTicket || draggedTicket.current_state.id === targetStateId) return;

      transitionMutationRef.current.mutate({
        ticketId: draggedTicket.id,
        newStateId: targetStateId,
      });
    },
    [ticketsQuery.data],
  );

  const isLoading = statesQuery.isLoading || ticketsQuery.isLoading;
  const isError = statesQuery.isError || ticketsQuery.isError;

  if (isLoading && !statesQuery.data) {
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

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("incorporation.gestora.title")}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {t("incorporation.gestora.description")}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("incorporation.gestora.myActive")}
          value={stats.myActive}
          icon={<FolderOpenIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.gestora.pendingDeeds")}
          value={stats.pendingDeeds}
          icon={<DocumentTextIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.gestora.inNotary")}
          value={stats.inNotary}
          icon={<ClipboardDocumentCheckIcon className="h-5 w-5" />}
        />
        <StatCard
          label={t("incorporation.gestora.completedToday")}
          value={stats.completedToday}
          icon={<CheckCircleIcon className="h-5 w-5" />}
        />
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div
            className="flex gap-4 pb-4"
            style={{ minHeight: "calc(100% - 2rem)" }}
          >
            {displayStates.map((state) => (
              <KanbanColumn
                key={state.id}
                state={state}
                tickets={ticketsByState.get(state.id) ?? []}
                selectedTicketIds={new Set<string>()}
                onToggleSelect={() => {}}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTicket ? <KanbanCard ticket={activeTicket} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
