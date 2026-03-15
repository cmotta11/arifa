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
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Ticket, WorkflowState } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import { TicketCreateModal } from "@/features/tickets/components/ticket-create-modal";
import {
  getWorkflowDefinitions,
  getWorkflowStates,
  getTickets,
  transitionTicket,
  bulkTransitionTickets,
  type KanbanView,
} from "../api/kanban-api";
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
  const [selectedWorkflowDefId, setSelectedWorkflowDefId] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(
    new Set(),
  );
  const [bulkTargetStateId, setBulkTargetStateId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Workflow definitions query
  const definitionsQuery = useQuery({
    queryKey: ["workflow", "definitions"],
    queryFn: getWorkflowDefinitions,
  });

  const statesQuery = useQuery({
    queryKey: ["workflow", "states", selectedWorkflowDefId],
    queryFn: () => getWorkflowStates(selectedWorkflowDefId || undefined),
  });

  const ticketsQuery = useQuery({
    queryKey: ["kanban", "tickets", selectedView, selectedWorkflowDefId],
    queryFn: () =>
      getTickets(selectedView, selectedWorkflowDefId || undefined),
  });

  const ticketsKey = ["kanban", "tickets", selectedView, selectedWorkflowDefId];

  const transitionMutation = useMutation({
    mutationFn: ({
      ticketId,
      newStateId,
    }: {
      ticketId: string;
      newStateId: string;
    }) => transitionTicket(ticketId, newStateId),
    onMutate: async ({ ticketId, newStateId }) => {
      await queryClient.cancelQueries({ queryKey: ticketsKey });

      const previousTickets = queryClient.getQueryData<Ticket[]>(ticketsKey);

      queryClient.setQueryData<Ticket[]>(ticketsKey, (old) => {
        if (!old) return old;
        const targetState = statesQuery.data?.find((s) => s.id === newStateId);
        if (!targetState) return old;

        return old.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, current_state: targetState }
            : ticket,
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

  const bulkTransitionMutation = useMutation({
    mutationFn: ({
      ticketIds,
      newStateId,
    }: {
      ticketIds: string[];
      newStateId: string;
    }) => bulkTransitionTickets(ticketIds, newStateId),
    onSuccess: () => {
      setSelectedTicketIds(new Set());
      setBulkTargetStateId("");
      queryClient.invalidateQueries({ queryKey: ticketsKey });
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
        if (overTicket) {
          targetStateId = overTicket.current_state.id;
        }
      }

      if (!targetStateId) return;

      const draggedTicket = ticketsQuery.data?.find(
        (t) => t.id === active.id,
      );
      if (!draggedTicket) return;

      if (draggedTicket.current_state.id === targetStateId) return;

      transitionMutationRef.current.mutate({
        ticketId: draggedTicket.id,
        newStateId: targetStateId,
      });
    },
    [ticketsQuery.data],
  );

  const toggleTicketSelection = useCallback((ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(ticketId)) {
        next.delete(ticketId);
      } else {
        next.add(ticketId);
      }
      return next;
    });
  }, []);

  const handleBulkTransition = () => {
    if (selectedTicketIds.size === 0 || !bulkTargetStateId) return;
    bulkTransitionMutation.mutate({
      ticketIds: Array.from(selectedTicketIds),
      newStateId: bulkTargetStateId,
    });
  };

  const handleWorkflowChange = (defId: string) => {
    setSelectedWorkflowDefId(defId);
    setSelectedTicketIds(new Set());
    setBulkTargetStateId("");
  };

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

  const sortedStates = [...(statesQuery.data ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  const definitionOptions = [
    { value: "", label: t("kanban.allWorkflows") },
    ...(definitionsQuery.data ?? [])
      .filter((d) => d.is_active)
      .map((d) => ({ value: d.id, label: d.display_name })),
  ];

  const stateOptions: { value: string; label: string }[] = sortedStates.map(
    (s) => ({ value: s.id, label: s.name }),
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("kanban.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select
              options={definitionOptions}
              value={selectedWorkflowDefId}
              onChange={(e) => handleWorkflowChange(e.target.value)}
            />
          </div>
          <div className="w-44">
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

      {/* Bulk Actions Toolbar */}
      {selectedTicketIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-gray-700">
            {t("kanban.bulkSelected", { count: selectedTicketIds.size })}
          </span>
          <div className="w-48">
            <Select
              options={[
                { value: "", label: t("kanban.bulkMoveTo") },
                ...stateOptions,
              ]}
              value={bulkTargetStateId}
              onChange={(e) => setBulkTargetStateId(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleBulkTransition}
            disabled={!bulkTargetStateId}
            loading={bulkTransitionMutation.isPending}
          >
            {t("kanban.bulkMove")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTicketIds(new Set())}
          >
            {t("common.cancel")}
          </Button>
        </div>
      )}

      {/* Board */}
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
            {sortedStates.map((state) => (
              <KanbanColumn
                key={state.id}
                state={state}
                tickets={ticketsByState.get(state.id) ?? []}
                selectedTicketIds={selectedTicketIds}
                onToggleSelect={toggleTicketSelection}
              />
            ))}
          </div>

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
