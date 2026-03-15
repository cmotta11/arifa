import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/data-display/data-table";
import { Modal } from "@/components/overlay/modal";
import { ConfirmDialog } from "@/components/overlay/confirm-dialog";
import { FormField } from "@/components/forms/form-field";
import type { Role } from "@/types";
import { useClients } from "@/features/clients/api/clients-api";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useSendMagicLink,
  type AdminUser,
  type UserFilters,
} from "../api/admin-api";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().optional().default(""),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    role: z.enum(["coordinator", "compliance_officer", "gestora", "director", "client"]),
    client_id: z.string().optional().nullable().default(null),
  })
  .refine(
    (data) => data.role === "client" || (data.password && data.password.length >= 8),
    { message: "Password must be at least 8 characters", path: ["password"] },
  );

const editUserSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum(["coordinator", "compliance_officer", "gestora", "director", "client"]),
  is_active: z.boolean(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_BADGE_CLASSES: Record<Role, string> = {
  director: "bg-purple-50 text-purple-700",
  compliance_officer: "bg-blue-50 text-blue-700",
  coordinator: "bg-green-50 text-green-700",
  gestora: "bg-yellow-50 text-yellow-700",
  client: "bg-gray-100 text-gray-600",
};

const ROLE_OPTIONS = [
  { value: "director", label: "Director" },
  { value: "compliance_officer", label: "Compliance Officer" },
  { value: "coordinator", label: "Coordinator" },
  { value: "gestora", label: "Gestora" },
  { value: "client", label: "Client" },
];

const ACTIVE_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[role]}`}
    >
      {role.replace("_", " ")}
    </span>
  );
}

function ActiveDot({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          active ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserManagement() {
  const { t } = useTranslation();

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");

  const filters: UserFilters = useMemo(() => {
    const f: UserFilters = {};
    if (roleFilter) f.role = roleFilter as Role;
    if (activeFilter !== "") f.is_active = activeFilter === "true";
    return f;
  }, [roleFilter, activeFilter]);

  // Queries & mutations
  const usersQuery = useUsers(filters);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const sendMagicLink = useSendMagicLink();
  const clientsQuery = useClients();

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  // Create form
  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      role: "coordinator",
      client_id: null,
    },
  });
  const watchedRole = useWatch({ control: createForm.control, name: "role" });

  // Edit form
  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
  });

  const handleCreateSubmit = (data: CreateUserForm) => {
    createUser.mutate(data, {
      onSuccess: () => {
        setCreateModalOpen(false);
        createForm.reset();
      },
    });
  };

  const handleEditSubmit = (data: EditUserForm) => {
    if (!editingUser) return;
    updateUser.mutate(
      { id: editingUser.id, ...data },
      {
        onSuccess: () => {
          setEditingUser(null);
          editForm.reset();
        },
      },
    );
  };

  const handleDeactivate = () => {
    if (!deletingUser) return;
    deleteUser.mutate(deletingUser.id, {
      onSuccess: () => setDeletingUser(null),
    });
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    editForm.reset({
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
    });
  };

  // Table columns
  const columns = [
    {
      key: "email",
      header: t("admin.users.email"),
      render: (row: Record<string, unknown>) => (
        <span className="font-medium text-gray-900">
          {String(row.email ?? "")}
        </span>
      ),
    },
    {
      key: "name",
      header: t("admin.users.name"),
      render: (row: Record<string, unknown>) =>
        `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`,
    },
    {
      key: "role",
      header: t("admin.users.role"),
      render: (row: Record<string, unknown>) => (
        <RoleBadge role={row.role as Role} />
      ),
    },
    {
      key: "is_active",
      header: t("admin.users.status"),
      render: (row: Record<string, unknown>) => (
        <ActiveDot active={row.is_active as boolean} />
      ),
    },
    {
      key: "date_joined",
      header: t("admin.users.dateJoined"),
      render: (row: Record<string, unknown>) => {
        const date = row.date_joined as string | undefined;
        return date ? new Date(date).toLocaleDateString() : "-";
      },
    },
    {
      key: "actions",
      header: t("admin.users.actions"),
      render: (row: Record<string, unknown>) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(row as unknown as AdminUser);
            }}
          >
            {t("common.edit")}
          </Button>
          {(row.role as string) === "client" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                sendMagicLink.mutate(String(row.id));
              }}
              loading={sendMagicLink.isPending}
            >
              {t("admin.users.sendMagicLink")}
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setDeletingUser(row as unknown as AdminUser);
            }}
          >
            {t("common.deactivate")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-48">
          <Select
            options={[{ value: "", label: t("admin.users.allRoles") }, ...ROLE_OPTIONS]}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            placeholder={t("admin.users.filterByRole")}
          />
        </div>
        <div className="w-40">
          <Select
            options={ACTIVE_OPTIONS}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          />
        </div>
        <div className="ml-auto">
          <Button onClick={() => setCreateModalOpen(true)}>
            {t("admin.users.createUser")}
          </Button>
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={usersQuery.data ?? []}
          loading={usersQuery.isLoading}
          emptyMessage={t("admin.users.noUsers")}
          keyExtractor={(row) => String(row.id)}
        />
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          createForm.reset();
        }}
        title={t("admin.users.createUser")}
      >
        <form
          onSubmit={createForm.handleSubmit(handleCreateSubmit)}
          className="space-y-4"
        >
          <FormField
            label={t("admin.users.email")}
            error={createForm.formState.errors.email?.message}
            required
          >
            <Input
              type="email"
              {...createForm.register("email")}
              error={createForm.formState.errors.email?.message}
            />
          </FormField>
          <FormField
            label={t("admin.users.role")}
            error={createForm.formState.errors.role?.message}
            required
          >
            <Select
              options={ROLE_OPTIONS}
              {...createForm.register("role")}
              error={createForm.formState.errors.role?.message}
            />
          </FormField>
          {watchedRole !== "client" && (
            <FormField
              label={t("admin.users.password")}
              error={createForm.formState.errors.password?.message}
              required
            >
              <Input
                type="password"
                {...createForm.register("password")}
                error={createForm.formState.errors.password?.message}
              />
            </FormField>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t("admin.users.firstName")}
              error={createForm.formState.errors.first_name?.message}
              required
            >
              <Input
                {...createForm.register("first_name")}
                error={createForm.formState.errors.first_name?.message}
              />
            </FormField>
            <FormField
              label={t("admin.users.lastName")}
              error={createForm.formState.errors.last_name?.message}
              required
            >
              <Input
                {...createForm.register("last_name")}
                error={createForm.formState.errors.last_name?.message}
              />
            </FormField>
          </div>
          {watchedRole === "client" && (
            <FormField label={t("admin.users.client")}>
              <Select
                options={[
                  { value: "", label: t("admin.users.selectClient") },
                  ...(clientsQuery.data?.results ?? []).map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                {...createForm.register("client_id")}
              />
            </FormField>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setCreateModalOpen(false);
                createForm.reset();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={createUser.isPending}>
              {t("admin.users.createUser")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => {
          setEditingUser(null);
          editForm.reset();
        }}
        title={t("admin.users.editUser")}
      >
        <form
          onSubmit={editForm.handleSubmit(handleEditSubmit)}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label={t("admin.users.firstName")}
              error={editForm.formState.errors.first_name?.message}
              required
            >
              <Input
                {...editForm.register("first_name")}
                error={editForm.formState.errors.first_name?.message}
              />
            </FormField>
            <FormField
              label={t("admin.users.lastName")}
              error={editForm.formState.errors.last_name?.message}
              required
            >
              <Input
                {...editForm.register("last_name")}
                error={editForm.formState.errors.last_name?.message}
              />
            </FormField>
          </div>
          <FormField
            label={t("admin.users.role")}
            error={editForm.formState.errors.role?.message}
            required
          >
            <Select
              options={ROLE_OPTIONS}
              {...editForm.register("role")}
              error={editForm.formState.errors.role?.message}
            />
          </FormField>
          <FormField label={t("admin.users.activeStatus")}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                {...editForm.register("is_active")}
              />
              <span className="text-sm text-gray-700">
                {t("admin.users.isActive")}
              </span>
            </label>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setEditingUser(null);
                editForm.reset();
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={updateUser.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Deactivate Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingUser}
        title={t("admin.users.deactivateUser")}
        message={t("admin.users.deactivateConfirm", {
          name: deletingUser
            ? `${deletingUser.first_name} ${deletingUser.last_name}`
            : "",
        })}
        confirmLabel={t("common.deactivate")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleteUser.isPending}
        onConfirm={handleDeactivate}
        onCancel={() => setDeletingUser(null)}
      />
    </div>
  );
}
