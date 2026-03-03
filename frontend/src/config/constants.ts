export const ROLES = {
  COORDINATOR: "coordinator",
  COMPLIANCE_OFFICER: "compliance_officer",
  GESTORA: "gestora",
  DIRECTOR: "director",
  CLIENT: "client",
} as const;

export const KYC_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export const TICKET_PRIORITIES = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;
