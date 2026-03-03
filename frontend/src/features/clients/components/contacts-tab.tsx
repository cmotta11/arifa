import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-display/data-table";
import { Spinner } from "@/components/ui/spinner";
import {
  useClientContacts,
  useCreateClientContact,
  useUpdateClientContact,
  useDeleteClientContact,
} from "../api/clients-api";
import type { ClientContact } from "@/types";

interface ContactsTabProps {
  clientId: string;
}

interface ContactFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  has_portal_access: boolean;
}

const emptyForm: ContactFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position: "",
  has_portal_access: false,
};

export function ContactsTab({ clientId }: ContactsTabProps) {
  const { t } = useTranslation();
  const contactsQuery = useClientContacts(clientId);
  const createMutation = useCreateClientContact();
  const updateMutation = useUpdateClientContact(clientId);
  const deleteMutation = useDeleteClientContact(clientId);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ContactFormData>(emptyForm);

  const contacts = contactsQuery.data?.results ?? [];

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (contact: ClientContact) => {
    setEditingId(contact.id);
    setFormData({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      position: contact.position,
      has_portal_access: contact.has_portal_access,
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: formData },
        { onSuccess: () => setShowModal(false) },
      );
    } else {
      createMutation.mutate(
        { client_id: clientId, ...formData },
        { onSuccess: () => setShowModal(false) },
      );
    }
  };

  const handleDelete = (contactId: string) => {
    if (window.confirm(t("clients.contacts.deleteConfirm"))) {
      deleteMutation.mutate(contactId);
    }
  };

  const handleTogglePortalAccess = (contact: ClientContact) => {
    updateMutation.mutate({
      id: contact.id,
      data: { has_portal_access: !contact.has_portal_access },
    });
  };

  const columns = [
    {
      key: "name",
      header: t("clients.contacts.firstName"),
      render: (row: Record<string, unknown>) => (
        <span className="font-medium">
          {String(row.first_name ?? "")} {String(row.last_name ?? "")}
        </span>
      ),
    },
    {
      key: "email",
      header: t("clients.contacts.email"),
      render: (row: Record<string, unknown>) => String(row.email ?? ""),
    },
    {
      key: "phone",
      header: t("clients.contacts.phone"),
      render: (row: Record<string, unknown>) => String(row.phone ?? "") || "—",
    },
    {
      key: "position",
      header: t("clients.contacts.position"),
      render: (row: Record<string, unknown>) => String(row.position ?? "") || "—",
    },
    {
      key: "has_portal_access",
      header: t("clients.contacts.portalAccess"),
      render: (row: Record<string, unknown>) => {
        const contact = row as unknown as ClientContact;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePortalAccess(contact);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-arifa-navy focus:ring-offset-2 ${
              contact.has_portal_access ? "bg-arifa-navy" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                contact.has_portal_access ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        );
      },
    },
    {
      key: "actions",
      header: t("common.actions"),
      render: (row: Record<string, unknown>) => {
        const contact = row as unknown as ClientContact;
        return (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(contact);
              }}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(contact.id);
              }}
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  if (contactsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("clients.contacts.title")}
        </h3>
        <Button onClick={openCreate}>{t("clients.contacts.addContact")}</Button>
      </div>

      <Card>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-500">
            {t("clients.contacts.noContacts")}
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={contacts as unknown as Record<string, unknown>[]}
            emptyMessage={t("clients.contacts.noContacts")}
            keyExtractor={(row) => String(row.id)}
          />
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingId
                ? t("clients.contacts.editContact")
                : t("clients.contacts.addContact")}
            </h3>
            <div className="space-y-3">
              <Input
                label={t("clients.contacts.firstName")}
                value={formData.first_name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, first_name: e.target.value }))
                }
                required
              />
              <Input
                label={t("clients.contacts.lastName")}
                value={formData.last_name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, last_name: e.target.value }))
                }
              />
              <Input
                label={t("clients.contacts.email")}
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                required
              />
              <Input
                label={t("clients.contacts.phone")}
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <Input
                label={t("clients.contacts.position")}
                value={formData.position}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, position: e.target.value }))
                }
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.has_portal_access}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      has_portal_access: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-arifa-navy focus:ring-arifa-navy"
                />
                {t("clients.contacts.portalAccess")}
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
