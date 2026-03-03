import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import type { Party, Person } from "@/types";
import { partyBaseSchema, type PartyFormData } from "../validation/kyc-schemas";
import { useAddParty, useUpdateParty } from "../api/kyc-api";
import { PersonSearchDialog } from "./person-search-dialog";

// ─── Props ──────────────────────────────────────────────────────────────────

interface PartyFormProps {
  kycId: string;
  party?: Party | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PARTY_TYPE_OPTIONS = [
  { value: "natural", label: "Natural Person" },
  { value: "corporate", label: "Corporate Entity" },
];

const ROLE_OPTIONS = [
  { value: "ubo", label: "Ultimate Beneficial Owner" },
  { value: "director", label: "Director" },
  { value: "shareholder", label: "Shareholder" },
  { value: "protector", label: "Protector" },
  { value: "authorized_signatory", label: "Authorized Signatory" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function PartyForm({ kycId, party, onSuccess, onCancel }: PartyFormProps) {
  const { t } = useTranslation("kyc");
  const isEditing = !!party;
  const [personSearchOpen, setPersonSearchOpen] = useState(false);

  const addPartyMutation = useAddParty();
  const updatePartyMutation = useUpdateParty();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PartyFormData>({
    resolver: zodResolver(partyBaseSchema),
    defaultValues: {
      party_type: party?.party_type ?? "natural",
      role: (party?.role as PartyFormData["role"]) ?? "ubo",
      name: party?.name ?? "",
      nationality: party?.nationality ?? "",
      country_of_residence: party?.country_of_residence ?? "",
      pep_status: party?.pep_status ?? false,
      ownership_percentage: party?.ownership_percentage ?? null,
      date_of_birth: party?.date_of_birth ?? null,
      identification_number: party?.identification_number ?? "",
    },
  });

  const partyType = watch("party_type");
  const role = watch("role");
  const showOwnership = role === "ubo" || role === "shareholder";
  const showNaturalFields = partyType === "natural";

  // Reset form when party changes (e.g., switching from edit to new)
  useEffect(() => {
    if (party) {
      reset({
        party_type: party.party_type,
        role: party.role as PartyFormData["role"],
        name: party.name,
        nationality: party.nationality,
        country_of_residence: party.country_of_residence,
        pep_status: party.pep_status,
        ownership_percentage: party.ownership_percentage,
        date_of_birth: party.date_of_birth,
        identification_number: party.identification_number,
      });
    }
  }, [party, reset]);

  const onSubmit = async (data: PartyFormData) => {
    try {
      if (isEditing && party) {
        await updatePartyMutation.mutateAsync({
          partyId: party.id,
          kycId,
          data,
        });
      } else {
        await addPartyMutation.mutateAsync({
          kycId,
          data,
        });
      }
      onSuccess?.();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handlePersonLinked = (person: Person) => {
    setValue("name", person.full_name);
    setValue("nationality", person.nationality?.country_code ?? "");
    setValue("country_of_residence", person.country_of_residence?.country_code ?? "");
    setValue("pep_status", person.pep_status);
    setValue("date_of_birth", person.date_of_birth);
    setValue("identification_number", person.identification_number);
    setValue("party_type", person.person_type);
    setPersonSearchOpen(false);
  };

  const isPending = addPartyMutation.isPending || updatePartyMutation.isPending;

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Link Existing Person */}
        {!isEditing && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPersonSearchOpen(true)}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              {t("party.linkExisting")}
            </Button>
          </div>
        )}

        {/* Party Type & Role */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label={t("fields.partyType")}
            error={errors.party_type?.message ? t(errors.party_type.message) : undefined}
            required
            htmlFor="party_type"
          >
            <Select
              id="party_type"
              options={PARTY_TYPE_OPTIONS}
              {...register("party_type")}
            />
          </FormField>

          <FormField
            label={t("fields.role")}
            error={errors.role?.message ? t(errors.role.message) : undefined}
            required
            htmlFor="role"
          >
            <Select
              id="role"
              options={ROLE_OPTIONS}
              {...register("role")}
            />
          </FormField>
        </div>

        {/* Name */}
        <FormField
          label={t("fields.name")}
          error={errors.name?.message ? t(errors.name.message) : undefined}
          required
          htmlFor="name"
        >
          <Input
            id="name"
            placeholder={t("fields.namePlaceholder")}
            {...register("name")}
          />
        </FormField>

        {/* Nationality & Country of Residence */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            label={t("fields.nationality")}
            error={
              errors.nationality?.message
                ? t(errors.nationality.message)
                : undefined
            }
            required
            htmlFor="nationality"
          >
            <Input
              id="nationality"
              placeholder={t("fields.nationalityPlaceholder")}
              {...register("nationality")}
            />
          </FormField>

          <FormField
            label={t("fields.countryOfResidence")}
            error={
              errors.country_of_residence?.message
                ? t(errors.country_of_residence.message)
                : undefined
            }
            required
            htmlFor="country_of_residence"
          >
            <Input
              id="country_of_residence"
              placeholder={t("fields.countryPlaceholder")}
              {...register("country_of_residence")}
            />
          </FormField>
        </div>

        {/* Ownership Percentage (conditional) */}
        {showOwnership && (
          <FormField
            label={t("fields.ownershipPercentage")}
            error={
              errors.ownership_percentage?.message
                ? t(errors.ownership_percentage.message)
                : undefined
            }
            htmlFor="ownership_percentage"
          >
            <Controller
              name="ownership_percentage"
              control={control}
              render={({ field }) => (
                <Input
                  id="ownership_percentage"
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  placeholder="0"
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    field.onChange(val === "" ? null : Number(val));
                  }}
                />
              )}
            />
          </FormField>
        )}

        {/* Natural Person Fields */}
        {showNaturalFields && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label={t("fields.dateOfBirth")}
              error={
                errors.date_of_birth?.message
                  ? t(errors.date_of_birth.message)
                  : undefined
              }
              htmlFor="date_of_birth"
            >
              <Input
                id="date_of_birth"
                type="date"
                {...register("date_of_birth")}
              />
            </FormField>

            <FormField
              label={t("fields.identificationNumber")}
              error={
                errors.identification_number?.message
                  ? t(errors.identification_number.message)
                  : undefined
              }
              htmlFor="identification_number"
            >
              <Input
                id="identification_number"
                placeholder={t("fields.idPlaceholder")}
                {...register("identification_number")}
              />
            </FormField>
          </div>
        )}

        {/* Corporate ID field */}
        {!showNaturalFields && (
          <FormField
            label={t("fields.registryNumber")}
            error={
              errors.identification_number?.message
                ? t(errors.identification_number.message)
                : undefined
            }
            htmlFor="identification_number"
          >
            <Input
              id="identification_number"
              placeholder={t("fields.registryPlaceholder")}
              {...register("identification_number")}
            />
          </FormField>
        )}

        {/* PEP Status */}
        <div className="flex items-center gap-3">
          <Controller
            name="pep_status"
            control={control}
            render={({ field }) => (
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-arifa-navy peer-checked:after:translate-x-full" />
              </label>
            )}
          />
          <span className="text-sm font-medium text-gray-700">
            {t("fields.pepStatus")}
          </span>
        </div>

        {/* Error Banner */}
        {(addPartyMutation.isError || updatePartyMutation.isError) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-error">
            {t("errors.saveFailed")}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("actions.cancel")}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={isPending || isSubmitting}
          >
            {isEditing ? t("actions.updateParty") : t("actions.addParty")}
          </Button>
        </div>
      </form>

      {/* Person Search Dialog */}
      <PersonSearchDialog
        isOpen={personSearchOpen}
        onClose={() => setPersonSearchOpen(false)}
        onSelect={handlePersonLinked}
      />
    </>
  );
}
