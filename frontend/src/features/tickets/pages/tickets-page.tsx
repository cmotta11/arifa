import { useCallback, useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import { ListBulletIcon, ViewColumnsIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/data-display/data-table";
import { ROUTES } from "@/config/routes";
import { useAuth } from "@/lib/auth/auth-context";
import type { Ticket } from "@/types";
import {
  getWorkflowDefinitions,
  getWorkflowStates,
  getTickets,
  transitionTicket,
  type KanbanView,
} from "@/features/kanban/api/kanban-api";
import { KanbanColumn } from "@/features/kanban/components/kanban-column";
import { KanbanCard } from "@/features/kanban/components/kanban-card";
import { TicketCreateModal } from "../components/ticket-create-modal";

type PageView = "list" | "board";

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

function getDefaultKanbanView(role: string | undefined): KanbanView {
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

const EMPTY_SET = new Set<string>();
const NOOP = () => {};

const priorityColors: Record<string, "gray" | "green" | "yellow" | "red"> = {
  low: "gray",
  medium: "green",
  high: "yellow",
  urgent: "red",
};

export default function TicketsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [pageView, setPageView] = useState<PageView>("list");
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const viewOptions = useViewOptions();
  const [selectedView, setSelectedView] = useState<KanbanView>(
    getDefaultKanbanView(user?.role),
  );
  const [selectedWorkflowDefId, setSelectedWorkflowDefId] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

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

  const ticketsKey = [
    "kanban",
    "tickets",
    selectedView,
    selectedWorkflowDefId,
  ];

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
      const previousTickets =
        queryClient.getQueryData<Ticket[]>(ticketsKey);
      queryClient.setQueryData<Ticket[]>(ticketsKey, (old) => {
        if (!old) return old;
        const targetState = statesQuery.data?.find(
          (s) => s.id === newStateId,
        );
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

  // Group tickets by state for kanban view
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
      if (!draggedTicket) return;
      if (draggedTicket.current_state.id === targetStateId) return;

      transitionMutation.mutate({
        ticketId: draggedTicket.id,
        newStateId: targetStateId,
      });
    },
    [ticketsQuery.data, transitionMutation],
  );

  // List view columns
  const listColumns = useMemo(
    () => [
      {
        key: "title",
        header: t("tickets.title"),
        render: (row: Ticket) => (
          <span className="font-medium text-gray-900">{row.title}</span>
        ),
      },
      {
        key: "client",
        header: t("tickets.client"),
        render: (row: Ticket) => row.client?.name ?? "—",
      },
      {
        key: "current_state",
        header: t("tickets.status"),
        render: (row: Ticket) => (
          <Badge color="blue">{row.current_state?.name}</Badge>
        ),
      },
      {
        key: "priority",
        header: t("tickets.priority"),
        render: (row: Ticket) => (
          <Badge color={priorityColors[row.priority] ?? "gray"}>
            {row.priority}
          </Badge>
        ),
      },
      {
        key: "assigned_to",
        header: t("tickets.assignedTo"),
        render: (row: Ticket) =>
          row.assigned_to
            ? `${row.assigned_to.first_name} ${row.assigned_to.last_name}`
            : "—",
      },
      {
        key: "due_date",
        header: t("tickets.dueDate"),
        render: (row: Ticket) =>
          row.due_date ? new Date(row.due_date).toLocaleDateString() : "—",
      },
    ],
    [t],
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
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          {t("tickets.title")}
        </h1>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="inline-flex rounded-md border border-gray-300 bg-white">
            <button
              type="button"
              onClick={() => setPageView("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${
                pageView === "list"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-50"
              } rounded-l-md`}
            >
              <ListBulletIcon className="h-4 w-4" />
              {t("tickets.views.list")}
            </button>
            <button
              type="button"
              onClick={() => setPageView("board")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${
                pageView === "board"
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-50"
              } rounded-r-md`}
            >
              <ViewColumnsIcon className="h-4 w-4" />
              {t("tickets.views.board")}
            </button>
          </div>

          {/* Workflow definition selector (board view only) */}
          {pageView === "board" && (
            <div className="w-52">
              <Select
                options={[
                  { value: "", label: t("kanban.allWorkflows") },
                  ...(definitionsQuery.data ?? [])
                    .filter((d) => d.is_active)
                    .map((d) => ({ value: d.id, label: d.display_name })),
                ]}
                value={selectedWorkflowDefId}
                onChange={(e) => setSelectedWorkflowDefId(e.target.value)}
              />
            </div>
          )}

          {/* Role-based view selector */}
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
            {t("tickets.create")}
          </Button>
        </div>
      </div>

      {/* Content */}
      {pageView === "list" ? (
        <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
          <DataTable
            columns={listColumns}
            data={
              ticketsQuery.data ?? []
            }
            loading={false}
            emptyMessage={t("tickets.noTickets")}
            onRowClick={(row) =>
              navigate(
                ROUTES.TICKET_DETAIL.replace(":id", row.id as string),
              )
            }
            keyExtractor={(row) => row.id as string}
          />
        </div>
      ) : (
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
                  selectedTicketIds={EMPTY_SET}
                  onToggleSelect={NOOP}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTicket ? <KanbanCard ticket={activeTicket} /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
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
