import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/overlay/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { Spinner } from "@/components/ui/spinner";
import { useClients } from "@/features/clients/api/clients-api";
import { useCreateTicket } from "../api/tickets-api";
import { getUsers } from "../api/tickets-api";
import { useQuery } from "@tanstack/react-query";
import type { Entity, PaginatedResponse } from "@/types";
import { api } from "@/lib/api-client";

interface TicketCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TicketCreateModal({
  isOpen,
  onClose,
  onSuccess,
}: TicketCreateModalProps) {
  const { t } = useTranslation();
  const createMutation = useCreateTicket();
  const clientsQuery = useClients();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [entityId, setEntityId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch entities for the selected client
  const entitiesQuery = useQuery({
    queryKey: ["entities", "byClient", clientId],
    queryFn: () =>
      api.get<PaginatedResponse<Entity>>("/core/entities/", {
        client_id: clientId,
        per_page: "100",
      }),
    enabled: !!clientId,
  });

  const clients = clientsQuery.data?.results ?? [];
  const entities = entitiesQuery.data?.results ?? [];
  const users = usersQuery.data ?? [];

  const priorityOptions = [
    { value: "low", label: t("tickets.form.priorityLow") },
    { value: "medium", label: t("tickets.form.priorityMedium") },
    { value: "high", label: t("tickets.form.priorityHigh") },
    { value: "urgent", label: t("tickets.form.priorityUrgent") },
  ];

  const clientOptions = clients.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const entityOptions = entities.map((e) => ({
    value: e.id,
    label: e.name,
  }));

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`.trim() || u.email,
  }));

  const resetForm = () => {
    setTitle("");
    setClientId("");
    setEntityId("");
    setPriority("medium");
    setDueDate("");
    setAssignedToId("");
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = t("tickets.form.titleRequired");
    }
    if (!clientId) {
      newErrors.client_id = t("tickets.form.clientRequired");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    createMutation.mutate(
      {
        title: title.trim(),
        client_id: clientId,
        entity_id: entityId || null,
        priority,
        due_date: dueDate || null,
        assigned_to_id: assignedToId || null,
      },
      {
        onSuccess: () => {
          handleClose();
          onSuccess?.();
        },
      },
    );
  };

  // Reset entity when client changes
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    setEntityId("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("tickets.create")}
      className="max-w-lg"
    >
      {clientsQuery.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title */}
          <FormField
            label={t("tickets.form.title")}
            error={errors.title}
            required
            htmlFor="ticket-title"
          >
            <Input
              id="ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tickets.form.titlePlaceholder")}
            />
          </FormField>

          {/* Client */}
          <FormField
            label={t("tickets.client")}
            error={errors.client_id}
            required
            htmlFor="ticket-client"
          >
            <Select
              id="ticket-client"
              options={clientOptions}
              value={clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              placeholder={t("tickets.form.selectClient")}
            />
          </FormField>

          {/* Entity (conditional on client) */}
          {clientId && (
            <FormField
              label={t("tickets.entity")}
              htmlFor="ticket-entity"
            >
              <Select
                id="ticket-entity"
                options={[
                  { value: "", label: t("tickets.form.noEntity") },
                  ...entityOptions,
                ]}
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
              />
            </FormField>
          )}

          {/* Priority */}
          <FormField
            label={t("tickets.priority")}
            htmlFor="ticket-priority"
          >
            <Select
              id="ticket-priority"
              options={priorityOptions}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </FormField>

          {/* Due Date */}
          <FormField
            label={t("tickets.dueDate")}
            htmlFor="ticket-due-date"
          >
            <Input
              id="ticket-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>

          {/* Assigned To */}
          <FormField
            label={t("tickets.assignedTo")}
            htmlFor="ticket-assigned-to"
          >
            <Select
              id="ticket-assigned-to"
              options={[
                { value: "", label: t("tickets.form.unassigned") },
                ...userOptions,
              ]}
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
            />
          </FormField>

          {/* Error Banner */}
          {createMutation.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
              {t("tickets.form.createFailed")}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <Button variant="ghost" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={createMutation.isPending}
            >
              {t("tickets.create")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
