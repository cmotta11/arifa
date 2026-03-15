import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { FormField } from "@/components/forms/form-field";
import type {
  WorkflowDefinition,
  WorkflowCategory,
  WorkflowState,
  WorkflowTransition,
  Role,
} from "@/types";
import {
  useWorkflowDefinitions,
  useCreateWorkflowDefinition,
  useUpdateWorkflowDefinition,
  useDeleteWorkflowDefinition,
  useCloneWorkflow,
  useWorkflowStates,
  useCreateWorkflowState,
  useUpdateWorkflowState,
  useDeleteWorkflowState,
  useWorkflowTransitions,
  useCreateWorkflowTransition,
  useUpdateWorkflowTransition,
  useDeleteWorkflowTransition,
} from "../api/admin-api";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const definitionSchema = z.object({
  name: z.string().min(1),
  display_name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  is_active: z.boolean(),
});

const cloneSchema = z.object({
  new_name: z.string().min(1),
  new_display_name: z.string().min(1),
});

const stateSchema = z.object({
  name: z.string().min(1),
  order_index: z.coerce.number().min(0),
  is_initial: z.boolean(),
  is_final: z.boolean(),
});

const transitionSchema = z.object({
  name: z.string().min(1),
  from_state: z.string().min(1),
  to_state: z.string().min(1),
  allowed_roles: z.array(z.string()).min(1),
});

type DefinitionForm = z.infer<typeof definitionSchema>;
type CloneForm = z.infer<typeof cloneSchema>;
type StateForm = z.infer<typeof stateSchema>;
type TransitionForm = z.infer<typeof transitionSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<WorkflowCategory, string> = {
  incorporation: "bg-blue-50 text-blue-700",
  compliance: "bg-green-50 text-green-700",
  documents: "bg-yellow-50 text-yellow-700",
  legal_support: "bg-purple-50 text-purple-700",
  registry: "bg-orange-50 text-orange-700",
  accounting: "bg-pink-50 text-pink-700",
  archive: "bg-gray-50 text-gray-700",
  custom: "bg-indigo-50 text-indigo-700",
};

const CATEGORY_OPTIONS: { value: WorkflowCategory; label: string }[] = [
  { value: "incorporation", label: "Incorporation" },
  { value: "compliance", label: "Compliance" },
  { value: "documents", label: "Documents" },
  { value: "legal_support", label: "Legal Support" },
  { value: "registry", label: "Registry" },
  { value: "accounting", label: "Accounting" },
  { value: "archive", label: "Archive" },
  { value: "custom", label: "Custom" },
];

const ROLE_BADGE_CLASSES: Record<Role, string> = {
  director: "bg-purple-50 text-purple-700",
  compliance_officer: "bg-blue-50 text-blue-700",
  coordinator: "bg-green-50 text-green-700",
  gestora: "bg-yellow-50 text-yellow-700",
  client: "bg-gray-100 text-gray-600",
};

const ALL_ROLE_KEYS: { value: Role; labelKey: string }[] = [
  { value: "director", labelKey: "roles.director" },
  { value: "compliance_officer", labelKey: "roles.compliance_officer" },
  { value: "coordinator", labelKey: "roles.coordinator" },
  { value: "gestora", labelKey: "roles.gestora" },
  { value: "client", labelKey: "roles.client" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowConfig() {
  const { t } = useTranslation();

  // Master-detail state
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<
    string | null
  >(null);

  // Definition queries & mutations
  const definitionsQuery = useWorkflowDefinitions();
  const createDefinition = useCreateWorkflowDefinition();
  const updateDefinition = useUpdateWorkflowDefinition();
  const deleteDefinition = useDeleteWorkflowDefinition();
  const cloneWorkflow = useCloneWorkflow();

  // State / transition queries (scoped when a definition is selected)
  const statesQuery = useWorkflowStates(selectedDefinitionId ?? undefined);
  const transitionsQuery = useWorkflowTransitions(
    selectedDefinitionId ?? undefined,
  );

  const createState = useCreateWorkflowState();
  const updateState = useUpdateWorkflowState();
  const deleteState = useDeleteWorkflowState();

  const createTransition = useCreateWorkflowTransition();
  const updateTransition = useUpdateWorkflowTransition();
  const deleteTransition = useDeleteWorkflowTransition();

  // Definition modals
  const [defModalOpen, setDefModalOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<WorkflowDefinition | null>(
    null,
  );
  const [deletingDef, setDeletingDef] = useState<WorkflowDefinition | null>(
    null,
  );
  const [cloningDef, setCloningDef] = useState<WorkflowDefinition | null>(
    null,
  );

  // State / transition modals
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<WorkflowState | null>(null);
  const [deletingState, setDeletingState] = useState<WorkflowState | null>(
    null,
  );
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [editingTransition, setEditingTransition] =
    useState<WorkflowTransition | null>(null);
  const [deletingTransition, setDeletingTransition] =
    useState<WorkflowTransition | null>(null);

  // Forms
  const defForm = useForm<DefinitionForm>({
    resolver: zodResolver(definitionSchema),
    defaultValues: {
      name: "",
      display_name: "",
      description: "",
      category: "custom",
      is_active: true,
    },
  });

  const cloneForm = useForm<CloneForm>({
    resolver: zodResolver(cloneSchema),
    defaultValues: { new_name: "", new_display_name: "" },
  });

  const stateForm = useForm<StateForm>({
    resolver: zodResolver(stateSchema),
    defaultValues: {
      name: "",
      order_index: 0,
      is_initial: false,
      is_final: false,
    },
  });

  const transitionForm = useForm<TransitionForm>({
    resolver: zodResolver(transitionSchema),
    defaultValues: {
      name: "",
      from_state: "",
      to_state: "",
      allowed_roles: [],
    },
  });

  // Derived data
  const sortedStates = useMemo(
    () =>
      [...(statesQuery.data ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
    [statesQuery.data],
  );

  const stateOptions = sortedStates.map((s) => ({
    value: s.id,
    label: `${s.order_index}. ${s.name}`,
  }));

  const selectedDef = useMemo(
    () =>
      definitionsQuery.data?.find((d) => d.id === selectedDefinitionId) ?? null,
    [definitionsQuery.data, selectedDefinitionId],
  );

  // =====================================================================
  // Definition handlers
  // =====================================================================

  const openCreateDef = () => {
    defForm.reset({
      name: "",
      display_name: "",
      description: "",
      category: "custom",
      is_active: true,
    });
    setEditingDef(null);
    setDefModalOpen(true);
  };

  const openEditDef = (def: WorkflowDefinition) => {
    defForm.reset({
      name: def.name,
      display_name: def.display_name,
      description: def.description,
      category: def.category,
      is_active: def.is_active,
    });
    setEditingDef(def);
    setDefModalOpen(true);
  };

  const handleDefSubmit = (data: DefinitionForm) => {
    if (editingDef) {
      updateDefinition.mutate(
        {
          id: editingDef.id,
          display_name: data.display_name,
          description: data.description,
          category: data.category,
          is_active: data.is_active,
        },
        {
          onSuccess: () => {
            setDefModalOpen(false);
            setEditingDef(null);
          },
        },
      );
    } else {
      createDefinition.mutate(data, {
        onSuccess: () => {
          setDefModalOpen(false);
          defForm.reset();
        },
      });
    }
  };

  const handleDeleteDef = () => {
    if (!deletingDef) return;
    deleteDefinition.mutate(deletingDef.id, {
      onSuccess: () => setDeletingDef(null),
    });
  };

  const handleCloneSubmit = (data: CloneForm) => {
    if (!cloningDef) return;
    cloneWorkflow.mutate(
      { id: cloningDef.id, ...data },
      {
        onSuccess: () => {
          setCloningDef(null);
          cloneForm.reset();
        },
      },
    );
  };

  // =====================================================================
  // State handlers
  // =====================================================================

  const openCreateState = () => {
    stateForm.reset({
      name: "",
      order_index: sortedStates.length,
      is_initial: false,
      is_final: false,
    });
    setEditingState(null);
    setStateModalOpen(true);
  };

  const openEditState = (state: WorkflowState) => {
    stateForm.reset({
      name: state.name,
      order_index: state.order_index,
      is_initial: state.is_initial,
      is_final: state.is_final,
    });
    setEditingState(state);
    setStateModalOpen(true);
  };

  const handleStateSubmit = (data: StateForm) => {
    if (editingState) {
      updateState.mutate(
        { id: editingState.id, ...data },
        {
          onSuccess: () => {
            setStateModalOpen(false);
            setEditingState(null);
          },
        },
      );
    } else {
      createState.mutate(
        {
          ...data,
          workflow_definition_id: selectedDefinitionId ?? undefined,
        },
        {
          onSuccess: () => {
            setStateModalOpen(false);
            stateForm.reset();
          },
        },
      );
    }
  };

  const handleDeleteState = () => {
    if (!deletingState) return;
    deleteState.mutate(deletingState.id, {
      onSuccess: () => setDeletingState(null),
    });
  };

  // =====================================================================
  // Transition handlers
  // =====================================================================

  const openCreateTransition = () => {
    transitionForm.reset({
      name: "",
      from_state: "",
      to_state: "",
      allowed_roles: [],
    });
    setEditingTransition(null);
    setTransitionModalOpen(true);
  };

  const openEditTransition = (trans: WorkflowTransition) => {
    transitionForm.reset({
      name: trans.name,
      from_state: trans.from_state.id,
      to_state: trans.to_state.id,
      allowed_roles: trans.allowed_roles,
    });
    setEditingTransition(trans);
    setTransitionModalOpen(true);
  };

  const handleTransitionSubmit = (data: TransitionForm) => {
    const payload = {
      name: data.name,
      from_state: data.from_state,
      to_state: data.to_state,
      allowed_roles: data.allowed_roles as Role[],
    };

    if (editingTransition) {
      updateTransition.mutate(
        { id: editingTransition.id, ...payload },
        {
          onSuccess: () => {
            setTransitionModalOpen(false);
            setEditingTransition(null);
          },
        },
      );
    } else {
      createTransition.mutate(payload, {
        onSuccess: () => {
          setTransitionModalOpen(false);
          transitionForm.reset();
        },
      });
    }
  };

  const handleDeleteTransition = () => {
    if (!deletingTransition) return;
    deleteTransition.mutate(deletingTransition.id, {
      onSuccess: () => setDeletingTransition(null),
    });
  };

  // =====================================================================
  // Transition table columns
  // =====================================================================

  const transitionColumns = [
    {
      key: "name",
      header: t("admin.workflow.transitionName"),
      render: (row: Record<string, unknown>) => (
        <span className="font-medium text-gray-900">
          {String(row.name ?? "")}
        </span>
      ),
    },
    {
      key: "from_state",
      header: t("admin.workflow.fromState"),
      render: (row: Record<string, unknown>) => {
        const state = row.from_state as WorkflowState | undefined;
        return state?.name ?? "-";
      },
    },
    {
      key: "to_state",
      header: t("admin.workflow.toState"),
      render: (row: Record<string, unknown>) => {
        const state = row.to_state as WorkflowState | undefined;
        return state?.name ?? "-";
      },
    },
    {
      key: "allowed_roles",
      header: t("admin.workflow.allowedRoles"),
      render: (row: Record<string, unknown>) => {
        const roles = (row.allowed_roles as Role[]) ?? [];
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <span
                key={role}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[role]}`}
              >
                {role.replace("_", " ")}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEditTransition(row as unknown as WorkflowTransition);
            }}
          >
            {t("common.edit")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingTransition(row as unknown as WorkflowTransition);
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ];

  // =====================================================================
  // MASTER VIEW — Definitions grid
  // =====================================================================

  if (selectedDefinitionId === null) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("admin.workflow.definitions")}
          </h2>
          <Button size="sm" onClick={openCreateDef}>
            {t("admin.workflow.addDefinition")}
          </Button>
        </div>

        {/* Definitions grid */}
        {definitionsQuery.data?.length === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-500">
            {t("admin.workflow.noDefinitions")}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(definitionsQuery.data ?? []).map((def) => (
            <div
              key={def.id}
              onClick={() => setSelectedDefinitionId(def.id)}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {def.display_name}
                </h3>
                <Badge color={def.is_active ? "green" : "gray"}>
                  {def.is_active
                    ? t("admin.workflow.definitionActive")
                    : t("admin.workflow.definitionInactive")}
                </Badge>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[def.category] ?? CATEGORY_COLORS.custom}`}
                >
                  {def.category_display}
                </span>
                <span className="text-xs text-gray-500">
                  {t("admin.workflow.stateCount", {
                    count: def.state_count,
                  })}
                </span>
              </div>
              {def.description && (
                <p className="mb-3 text-xs text-gray-500 line-clamp-2">
                  {def.description}
                </p>
              )}
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditDef(def);
                  }}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    cloneForm.reset({
                      new_name: `${def.name}_copy`,
                      new_display_name: `${def.display_name} (Copy)`,
                    });
                    setCloningDef(def);
                  }}
                >
                  {t("admin.workflow.cloneDefinition")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingDef(def);
                  }}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================= */}
        {/* Create / Edit Definition Modal                                 */}
        {/* ============================================================= */}
        <Modal
          isOpen={defModalOpen}
          onClose={() => {
            setDefModalOpen(false);
            setEditingDef(null);
          }}
          title={
            editingDef
              ? t("admin.workflow.editDefinition")
              : t("admin.workflow.addDefinition")
          }
        >
          <form
            onSubmit={defForm.handleSubmit(handleDefSubmit)}
            className="space-y-4"
          >
            <FormField
              label={t("admin.workflow.definitionName")}
              error={defForm.formState.errors.name?.message}
              required
            >
              <Input
                {...defForm.register("name")}
                disabled={!!editingDef}
                error={defForm.formState.errors.name?.message}
              />
            </FormField>
            <FormField
              label={t("admin.workflow.definitionDisplayName")}
              error={defForm.formState.errors.display_name?.message}
              required
            >
              <Input
                {...defForm.register("display_name")}
                error={defForm.formState.errors.display_name?.message}
              />
            </FormField>
            <FormField
              label={t("admin.workflow.definitionDescription")}
              error={defForm.formState.errors.description?.message}
            >
              <Input
                {...defForm.register("description")}
                error={defForm.formState.errors.description?.message}
              />
            </FormField>
            <FormField
              label={t("admin.workflow.definitionCategory")}
              error={defForm.formState.errors.category?.message}
              required
            >
              <Select
                options={CATEGORY_OPTIONS}
                {...defForm.register("category")}
                error={defForm.formState.errors.category?.message}
              />
            </FormField>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...defForm.register("is_active")}
              />
              <span className="text-sm text-gray-700">
                {t("admin.workflow.definitionActive")}
              </span>
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setDefModalOpen(false);
                  setEditingDef(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={
                  createDefinition.isPending || updateDefinition.isPending
                }
              >
                {editingDef
                  ? t("common.save")
                  : t("admin.workflow.addDefinition")}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Clone Definition Modal */}
        <Modal
          isOpen={!!cloningDef}
          onClose={() => setCloningDef(null)}
          title={t("admin.workflow.cloneDefinition")}
        >
          <form
            onSubmit={cloneForm.handleSubmit(handleCloneSubmit)}
            className="space-y-4"
          >
            <FormField
              label={t("admin.workflow.newName")}
              error={cloneForm.formState.errors.new_name?.message}
              required
            >
              <Input
                {...cloneForm.register("new_name")}
                error={cloneForm.formState.errors.new_name?.message}
              />
            </FormField>
            <FormField
              label={t("admin.workflow.newDisplayName")}
              error={cloneForm.formState.errors.new_display_name?.message}
              required
            >
              <Input
                {...cloneForm.register("new_display_name")}
                error={cloneForm.formState.errors.new_display_name?.message}
              />
            </FormField>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setCloningDef(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={cloneWorkflow.isPending}>
                {t("admin.workflow.cloneDefinition")}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Definition Confirm */}
        <ConfirmDialog
          isOpen={!!deletingDef}
          title={t("admin.workflow.deleteDefinition")}
          message={t("admin.workflow.deleteDefinitionConfirm", {
            name: deletingDef?.display_name ?? "",
          })}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          variant="danger"
          loading={deleteDefinition.isPending}
          onConfirm={handleDeleteDef}
          onCancel={() => setDeletingDef(null)}
        />
      </div>
    );
  }

  // =====================================================================
  // DETAIL VIEW — States & Transitions scoped to selected definition
  // =====================================================================

  return (
    <div className="space-y-8">
      {/* Back button + definition header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSelectedDefinitionId(null)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("admin.workflow.backToDefinitions")}
        </button>
        {selectedDef && (
          <>
            <span className="text-lg font-semibold text-gray-900">
              {selectedDef.display_name}
            </span>
            <Badge color={selectedDef.is_active ? "green" : "gray"}>
              {selectedDef.is_active
                ? t("admin.workflow.definitionActive")
                : t("admin.workflow.definitionInactive")}
            </Badge>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* STATES SECTION                                                     */}
      {/* ================================================================= */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("admin.workflow.states")}
          </h2>
          <Button size="sm" onClick={openCreateState}>
            {t("admin.workflow.addState")}
          </Button>
        </div>

        {/* Visual flow diagram */}
        <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            {sortedStates.map((state, index) => (
              <div key={state.id} className="flex items-center gap-2">
                <div
                  className={`
                    relative flex min-w-[120px] flex-col items-center rounded-lg border-2 px-4 py-3
                    ${state.is_initial ? "border-green-400 bg-green-50" : ""}
                    ${state.is_final ? "border-red-400 bg-red-50" : ""}
                    ${!state.is_initial && !state.is_final ? "border-gray-300 bg-white" : ""}
                  `}
                >
                  <span className="text-xs font-medium text-gray-500">
                    #{state.order_index}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {state.name}
                  </span>
                  <div className="mt-1 flex gap-1">
                    {state.is_initial && (
                      <Badge color="green">
                        {t("admin.workflow.isInitial")}
                      </Badge>
                    )}
                    {state.is_final && (
                      <Badge color="red">
                        {t("admin.workflow.isFinal")}
                      </Badge>
                    )}
                  </div>
                </div>
                {index < sortedStates.length - 1 && (
                  <div className="flex items-center text-gray-400">
                    <div className="h-0.5 w-6 bg-gray-300" />
                    <svg
                      className="h-4 w-4 -ml-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
            {sortedStates.length === 0 && (
              <span className="text-sm text-gray-500">
                {t("admin.workflow.noStates")}
              </span>
            )}
          </div>
        </div>

        {/* States list */}
        <div className="space-y-2">
          {sortedStates.map((state) => (
            <div
              key={state.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                  {state.order_index}
                </span>
                <span className="font-medium text-gray-900">
                  {state.name}
                </span>
                <div className="flex gap-1">
                  {state.is_initial && (
                    <Badge color="green">
                      {t("admin.workflow.isInitial")}
                    </Badge>
                  )}
                  {state.is_final && (
                    <Badge color="red">{t("admin.workflow.isFinal")}</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditState(state)}
                >
                  {t("common.edit")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeletingState(state)}
                >
                  {t("common.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================= */}
      {/* TRANSITIONS SECTION                                                */}
      {/* ================================================================= */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("admin.workflow.transitions")}
          </h2>
          <Button size="sm" onClick={openCreateTransition}>
            {t("admin.workflow.addTransition")}
          </Button>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <DataTable
            columns={transitionColumns}
            data={
              (transitionsQuery.data ?? []) as unknown as Record<
                string,
                unknown
              >[]
            }
            loading={transitionsQuery.isLoading}
            emptyMessage={t("admin.workflow.noTransitions")}
            keyExtractor={(row) => String(row.id)}
          />
        </div>
      </section>

      {/* ================================================================= */}
      {/* STATE MODAL                                                        */}
      {/* ================================================================= */}
      <Modal
        isOpen={stateModalOpen}
        onClose={() => {
          setStateModalOpen(false);
          setEditingState(null);
        }}
        title={
          editingState
            ? t("admin.workflow.editState")
            : t("admin.workflow.addState")
        }
      >
        <form
          onSubmit={stateForm.handleSubmit(handleStateSubmit)}
          className="space-y-4"
        >
          <FormField
            label={t("admin.workflow.stateName")}
            error={stateForm.formState.errors.name?.message}
            required
          >
            <Input
              {...stateForm.register("name")}
              error={stateForm.formState.errors.name?.message}
            />
          </FormField>
          <FormField
            label={t("admin.workflow.orderIndex")}
            error={stateForm.formState.errors.order_index?.message}
            required
          >
            <Input
              type="number"
              min={0}
              {...stateForm.register("order_index")}
              error={stateForm.formState.errors.order_index?.message}
            />
          </FormField>
          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...stateForm.register("is_initial")}
              />
              <span className="text-sm text-gray-700">
                {t("admin.workflow.isInitial")}
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...stateForm.register("is_final")}
              />
              <span className="text-sm text-gray-700">
                {t("admin.workflow.isFinal")}
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setStateModalOpen(false);
                setEditingState(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={createState.isPending || updateState.isPending}
            >
              {editingState ? t("common.save") : t("admin.workflow.addState")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================================================================= */}
      {/* TRANSITION MODAL                                                   */}
      {/* ================================================================= */}
      <Modal
        isOpen={transitionModalOpen}
        onClose={() => {
          setTransitionModalOpen(false);
          setEditingTransition(null);
        }}
        title={
          editingTransition
            ? t("admin.workflow.editTransition")
            : t("admin.workflow.addTransition")
        }
      >
        <form
          onSubmit={transitionForm.handleSubmit(handleTransitionSubmit)}
          className="space-y-4"
        >
          <FormField
            label={t("admin.workflow.transitionName")}
            error={transitionForm.formState.errors.name?.message}
            required
          >
            <Input
              {...transitionForm.register("name")}
              error={transitionForm.formState.errors.name?.message}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t("admin.workflow.fromState")}
              error={transitionForm.formState.errors.from_state?.message}
              required
            >
              <Select
                options={stateOptions}
                placeholder={t("common.select")}
                {...transitionForm.register("from_state")}
                error={transitionForm.formState.errors.from_state?.message}
              />
            </FormField>
            <FormField
              label={t("admin.workflow.toState")}
              error={transitionForm.formState.errors.to_state?.message}
              required
            >
              <Select
                options={stateOptions}
                placeholder={t("common.select")}
                {...transitionForm.register("to_state")}
                error={transitionForm.formState.errors.to_state?.message}
              />
            </FormField>
          </div>
          <Controller
            control={transitionForm.control}
            name="allowed_roles"
            render={({ field, fieldState }) => (
              <FormField
                label={t("admin.workflow.allowedRoles")}
                error={fieldState.error?.message}
                required
              >
                <div className="space-y-2 rounded-md border border-gray-200 p-3">
                  {ALL_ROLE_KEYS.map((role) => (
                    <label
                      key={role.value}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={field.value.includes(role.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            field.onChange([...field.value, role.value]);
                          } else {
                            field.onChange(
                              field.value.filter((r) => r !== role.value),
                            );
                          }
                        }}
                      />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[role.value]}`}
                      >
                        {t(role.labelKey)}
                      </span>
                    </label>
                  ))}
                </div>
              </FormField>
            )}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setTransitionModalOpen(false);
                setEditingTransition(null);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              loading={createTransition.isPending || updateTransition.isPending}
            >
              {editingTransition
                ? t("common.save")
                : t("admin.workflow.addTransition")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={!!deletingState}
        title={t("admin.workflow.deleteState")}
        message={t("admin.workflow.deleteStateConfirm", {
          name: deletingState?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteState.isPending}
        onConfirm={handleDeleteState}
        onCancel={() => setDeletingState(null)}
      />

      <ConfirmDialog
        isOpen={!!deletingTransition}
        title={t("admin.workflow.deleteTransition")}
        message={t("admin.workflow.deleteTransitionConfirm", {
          name: deletingTransition?.name ?? "",
        })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteTransition.isPending}
        onConfirm={handleDeleteTransition}
        onCancel={() => setDeletingTransition(null)}
      />
    </div>
  );
}
