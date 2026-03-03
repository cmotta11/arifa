import { z } from "zod";

// ─── Party Schemas ──────────────────────────────────────────────────────────

export const partyBaseSchema = z.object({
  party_type: z.enum(["natural", "corporate"], {
    required_error: "validation.partyTypeRequired",
  }),
  role: z.enum(
    ["ubo", "director", "shareholder", "protector", "authorized_signatory"],
    { required_error: "validation.roleRequired" }
  ),
  name: z
    .string({ required_error: "validation.nameRequired" })
    .min(1, "validation.nameRequired")
    .max(255, "validation.nameTooLong"),
  nationality: z
    .string({ required_error: "validation.nationalityRequired" })
    .min(1, "validation.nationalityRequired"),
  country_of_residence: z
    .string({ required_error: "validation.countryRequired" })
    .min(1, "validation.countryRequired"),
  pep_status: z.boolean().default(false),
  ownership_percentage: z
    .number()
    .min(0, "validation.ownershipMin")
    .max(100, "validation.ownershipMax")
    .nullable()
    .default(null),
  date_of_birth: z.string().nullable().default(null),
  identification_number: z.string().default(""),
});

export const naturalPersonSchema = partyBaseSchema.extend({
  party_type: z.literal("natural"),
  date_of_birth: z
    .string({ required_error: "validation.dobRequired" })
    .min(1, "validation.dobRequired"),
  identification_number: z
    .string({ required_error: "validation.idRequired" })
    .min(1, "validation.idRequired"),
});

export const corporatePersonSchema = partyBaseSchema.extend({
  party_type: z.literal("corporate"),
  identification_number: z
    .string({ required_error: "validation.idRequired" })
    .min(1, "validation.idRequired"),
});

/**
 * Combined party schema that applies conditional validation
 * based on party_type.
 */
export const partySchema = z.discriminatedUnion("party_type", [
  naturalPersonSchema,
  corporatePersonSchema,
]);

/**
 * Refinement: UBO and shareholder roles require ownership_percentage.
 */
export const partyWithOwnershipSchema = partyBaseSchema.superRefine(
  (data, ctx) => {
    const requiresOwnership = data.role === "ubo" || data.role === "shareholder";

    if (requiresOwnership && (data.ownership_percentage === null || data.ownership_percentage === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validation.ownershipRequired",
        path: ["ownership_percentage"],
      });
    }

    if (data.party_type === "natural") {
      if (!data.date_of_birth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.dobRequired",
          path: ["date_of_birth"],
        });
      }
      if (!data.identification_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.idRequired",
          path: ["identification_number"],
        });
      }
    }

    if (data.party_type === "corporate") {
      if (!data.identification_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validation.idRequired",
          path: ["identification_number"],
        });
      }
    }
  }
);

// ─── KYC Submission Schema ──────────────────────────────────────────────────

export const kycSubmitSchema = z.object({
  parties: z
    .array(partyBaseSchema)
    .min(1, "validation.atLeastOneParty"),
  hasDocuments: z.boolean().refine((val) => val === true, {
    message: "validation.documentsRequired",
  }),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type PartyFormData = z.infer<typeof partyBaseSchema>;
export type NaturalPersonFormData = z.infer<typeof naturalPersonSchema>;
export type CorporatePersonFormData = z.infer<typeof corporatePersonSchema>;
export type KYCSubmitValidation = z.infer<typeof kycSubmitSchema>;
