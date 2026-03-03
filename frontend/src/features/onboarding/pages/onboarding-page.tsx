import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GuestLayout } from "@/features/guest-intake/components/guest-layout";
import { useSubmitOnboarding } from "../api/onboarding-api";

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const submitMutation = useSubmitOnboarding();

  const [form, setForm] = useState({
    contact_name: "",
    contact_email: "",
    client_name: "",
    client_type: "corporate" as "natural" | "corporate",
    entity_name: "",
    jurisdiction: "bvi" as "bvi" | "panama" | "belize",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const isValid =
    form.contact_name.trim() &&
    form.contact_email.trim() &&
    form.client_name.trim() &&
    form.entity_name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    submitMutation.mutate(form, {
      onSuccess: (data) => {
        navigate(`/guest/${data.guest_link_token}`);
      },
    });
  };

  return (
    <GuestLayout>
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("onboarding.title")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("onboarding.description")}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contact Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("onboarding.contactName")}
              </label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => updateField("contact_name", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                required
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("onboarding.contactEmail")}
              </label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => updateField("contact_email", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                required
              />
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("onboarding.clientName")}
              </label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => updateField("client_name", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                required
              />
            </div>

            {/* Client Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("onboarding.clientType")}
              </label>
              <select
                value={form.client_type}
                onChange={(e) => updateField("client_type", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
              >
                <option value="corporate">{t("onboarding.corporate")}</option>
                <option value="natural">{t("onboarding.natural")}</option>
              </select>
            </div>

            {/* Entity Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("onboarding.entityName")}
              </label>
              <input
                type="text"
                value={form.entity_name}
                onChange={(e) => updateField("entity_name", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
                required
              />
            </div>

            {/* Jurisdiction */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                {t("onboarding.jurisdiction")}
              </label>
              <select
                value={form.jurisdiction}
                onChange={(e) => updateField("jurisdiction", e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-arifa-navy focus:outline-none focus:ring-1 focus:ring-arifa-navy"
              >
                <option value="bvi">{t("onboarding.jurisdictions.bvi")}</option>
                <option value="panama">
                  {t("onboarding.jurisdictions.panama")}
                </option>
                <option value="belize">
                  {t("onboarding.jurisdictions.belize")}
                </option>
              </select>
            </div>

            {/* Error */}
            {submitMutation.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {t("onboarding.error")}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full"
              loading={submitMutation.isPending}
              disabled={!isValid}
            >
              {submitMutation.isPending
                ? t("onboarding.submitting")
                : t("onboarding.submit")}
            </Button>
          </form>
        </Card>
      </div>
    </GuestLayout>
  );
}
