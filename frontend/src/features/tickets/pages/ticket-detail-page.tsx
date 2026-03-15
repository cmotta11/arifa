import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Ticket, WorkflowTransition } from "@/types";
import {
  getTicket,
  getTicketLogs,
  getAvailableTransitions,
  transitionTicket,
  assignTicket,
  getUsers,
} from "../api/tickets-api";
import { TicketTimeline } from "../components/ticket-timeline";
import { formatDate } from "@/lib/format";

const priorityColorMap: Record<Ticket["priority"], "gray" | "green" | "yellow" | "red"> = {
  low: "gray",
  medium: "green",
  high: "yellow",
  urgent: "red",
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // --- Queries ---

  const ticketQuery = useQuery({
    queryKey: ["tickets", id],
    queryFn: () => getTicket(id!),
    enabled: !!id,
  });

  const logsQuery = useQuery({
    queryKey: ["tickets", id, "logs"],
    queryFn: () => getTicketLogs(id!),
    enabled: !!id,
  });

  const transitionsQuery = useQuery({
    queryKey: ["tickets", id, "transitions"],
    queryFn: () => getAvailableTransitions(id!),
    enabled: !!id,
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  // --- Mutations ---

  const transitionMutation = useMutation({
    mutationFn: (transition: WorkflowTransition) =>
      transitionTicket(id!, transition.to_state.id, comment),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["tickets", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets", id, "logs"] });
      queryClient.invalidateQueries({
        queryKey: ["tickets", id, "transitions"],
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (userId: string) => assignTicket(id!, userId),
    onSuccess: () => {
      setSelectedUserId("");
      queryClient.invalidateQueries({ queryKey: ["tickets", id] });
    },
  });

  // --- Loading/Error States ---

  if (ticketQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  if (ticketQuery.isError || !ticketQuery.data) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
          {t("common.error")}
        </div>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => navigate(-1)}
        >
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const ticket = ticketQuery.data;
  const transitions = transitionsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const users = usersQuery.data ?? [];

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`,
  }));

  return (
    <div className="p-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-primary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("common.back")}
      </button>

      {/* Page title + status badge */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">{ticket.title}</h1>
        <Badge color="blue">{ticket.current_state.name}</Badge>
        <Badge color={priorityColorMap[ticket.priority]}>
          {t(`priority.${ticket.priority}`)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: metadata + transitions + assign */}
        <div className="space-y-6 lg:col-span-1">
          {/* Ticket Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>{t("tickets.metadata")}</CardTitle>
            </CardHeader>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("tickets.client")}</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.client.name}
                </dd>
              </div>
              {ticket.entity && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">{t("tickets.entity")}</dt>
                  <dd className="font-medium text-gray-900">
                    {ticket.entity.name}
                  </dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("tickets.status")}</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.current_state.name}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("tickets.priority")}</dt>
                <dd>
                  <Badge color={priorityColorMap[ticket.priority]}>
                    {t(`priority.${ticket.priority}`)}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("tickets.dueDate")}</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(ticket.due_date)}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("tickets.assignedTo")}</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.assigned_to
                    ? `${ticket.assigned_to.first_name} ${ticket.assigned_to.last_name}`
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">{t("tickets.createdAt")}</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(ticket.created_at)}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Transition Section */}
          {transitions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("tickets.transition")}</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {transitions.map((transition) => (
                  <Button
                    key={transition.id}
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    loading={
                      transitionMutation.isPending &&
                      transitionMutation.variables?.id === transition.id
                    }
                    onClick={() => transitionMutation.mutate(transition)}
                  >
                    {transition.name || transition.to_state.name}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Assign Section */}
          <Card>
            <CardHeader>
              <CardTitle>{t("tickets.assign")}</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <Select
                options={userOptions}
                placeholder={t("tickets.selectUser")}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              />
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                disabled={!selectedUserId}
                loading={assignMutation.isPending}
                onClick={() => {
                  if (selectedUserId) {
                    assignMutation.mutate(selectedUserId);
                  }
                }}
              >
                {t("tickets.assign")}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right column: Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("tickets.timeline")}</CardTitle>
            </CardHeader>

            {logsQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : (
              <TicketTimeline logs={logs} />
            )}

            {/* Comment box */}
            <div className="mt-6 border-t border-surface-border pt-4">
              <div className="flex gap-3">
                <Input
                  placeholder={t("tickets.addComment")}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      comment.trim() &&
                      transitions.length > 0
                    ) {
                      e.preventDefault();
                      // Transition to current state (adds comment only)
                      transitionMutation.mutate({
                        id: "comment",
                        from_state: ticket.current_state,
                        to_state: ticket.current_state,
                        allowed_roles: [],
                        name: "Comment",
                      });
                    }
                  }}
                />
                <Button
                  variant="primary"
                  size="md"
                  disabled={!comment.trim()}
                  loading={transitionMutation.isPending}
                  onClick={() => {
                    if (comment.trim()) {
                      // Transition to current state (adds comment only)
                      transitionMutation.mutate({
                        id: "comment",
                        from_state: ticket.current_state,
                        to_state: ticket.current_state,
                        allowed_roles: [],
                        name: "Comment",
                      });
                    }
                  }}
                >
                  {t("tickets.submitComment")}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
