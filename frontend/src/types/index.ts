export type Role =
  | "coordinator"
  | "compliance_officer"
  | "gestora"
  | "director"
  | "client";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  client_id: string | null;
  client_name: string | null;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Client {
  id: string;
  aderant_client_id: string | null;
  name: string;
  client_type: "natural" | "corporate";
  category: "silver" | "gold" | "platinum";
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  name: string;
  jurisdiction: "bvi" | "panama" | "belize";
  client: Client;
  incorporation_date: string | null;
  status: "pending" | "active" | "dissolved" | "struck_off";
  created_at: string;
  updated_at: string;
}

export interface Matter {
  id: string;
  aderant_matter_id: string | null;
  client: Client;
  entity: Entity | null;
  description: string;
  status: "open" | "closed" | "on_hold";
  opened_date: string;
  created_at: string;
  updated_at: string;
}

export interface JurisdictionRiskRef {
  id: string;
  country_code: string;
  country_name: string;
  risk_weight: number;
}

export type PersonStatus = "pending_approval" | "approved" | "rejected";

export interface Person {
  id: string;
  full_name: string;
  last_name: string;
  person_type: "natural" | "corporate";
  nationality: JurisdictionRiskRef | null;
  country_of_residence: JurisdictionRiskRef | null;
  date_of_birth: string | null;
  identification_number: string;
  identification_type: "passport" | "cedula" | "corporate_registry" | "";
  pep_status: boolean;
  status: PersonStatus;
  client: Client | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  order_index: number;
  is_initial: boolean;
  is_final: boolean;
}

export interface WorkflowTransition {
  id: string;
  from_state: WorkflowState;
  to_state: WorkflowState;
  allowed_roles: Role[];
  name: string;
}

export interface Ticket {
  id: string;
  title: string;
  client: Client;
  entity: Entity | null;
  current_state: WorkflowState;
  assigned_to: User | null;
  created_by: User;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketLog {
  id: string;
  ticket: string;
  changed_by: User | null;
  previous_state: WorkflowState | null;
  new_state: WorkflowState;
  comment: string;
  timestamp: string;
}

export interface KYCSubmission {
  id: string;
  ticket: string;
  status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "sent_back";
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  proposed_entity_data: Record<string, unknown>;
  field_comments: Record<string, string>;
  created_at: string;
}

export interface Party {
  id: string;
  kyc_submission: string;
  person: string | null;
  party_type: "natural" | "corporate";
  role: string;
  name: string;
  nationality: string;
  country_of_residence: string;
  pep_status: boolean;
  ownership_percentage: number | null;
  date_of_birth: string | null;
  identification_number: string;
}

export interface RiskAssessment {
  id: string;
  kyc_submission: string | null;
  entity: string | null;
  entity_name: string | null;
  person: string | null;
  person_name: string | null;
  total_score: number;
  risk_level: "low" | "medium" | "high";
  breakdown_json: Record<string, { score: number; max_score: number; detail: Record<string, unknown> }>;
  is_current: boolean;
  assessed_at: string;
  trigger: string;
  matrix_config: string | null;
  matrix_config_snapshot: Record<string, unknown> | null;
  input_data_snapshot: Record<string, unknown> | null;
  triggered_rules: TriggeredRule[];
  is_auto_triggered: boolean;
  assessed_by: string | null;
  snapshot: string | null;
}

export interface TriggeredRule {
  condition: string;
  detail: string;
  forced_level: string;
}

export interface RiskFactorConfig {
  id: string;
  code: string;
  category: "entity" | "person";
  max_score: number;
  description: string;
  scoring_rules_json: Record<string, unknown>;
}

export interface AutomaticTriggerRule {
  id: string;
  condition: string;
  forced_risk_level: "low" | "medium" | "high";
  is_active: boolean;
  description: string;
}

export interface RiskMatrixConfig {
  id: string;
  name: string;
  jurisdiction: string;
  entity_type: string;
  version: number;
  is_active: boolean;
  high_risk_threshold: number;
  medium_risk_threshold: number;
  created_by: string | null;
  notes: string;
  factors: RiskFactorConfig[];
  trigger_rules: AutomaticTriggerRule[];
  created_at: string;
  updated_at: string;
}

export interface ComplianceSnapshot {
  id: string;
  name: string;
  snapshot_date: string;
  created_by: string | null;
  status: "running" | "completed" | "failed";
  total_entities: number;
  total_persons: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  notes: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RFI {
  id: string;
  kyc_submission: string;
  requested_by: User;
  requested_fields: string[];
  notes: string;
  status: "open" | "responded" | "closed";
  response_text: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorldCheckCase {
  id: string;
  party: string;
  case_system_id: string;
  screening_status: string;
  last_screened_at: string | null;
  ongoing_monitoring_enabled: boolean;
  match_data_json: Record<string, unknown>;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface DocumentUpload {
  id: string;
  kyc_submission: string | null;
  party: string | null;
  document_type:
    | "passport"
    | "cedula"
    | "utility_bill"
    | "corporate_registry"
    | "proof_of_address"
    | "source_of_wealth"
    | "other";
  original_filename: string;
  sharepoint_file_id: string;
  sharepoint_web_url: string;
  sharepoint_drive_item_id: string;
  uploaded_by: string | null;
  file_size: number;
  mime_type: string;
  llm_extraction_json: Record<string, unknown>;
  llm_extraction_status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Corporate Structure types
// ---------------------------------------------------------------------------

export type RiskLevel = "low" | "medium" | "high" | "ultra_high";

export interface EntityOfficer {
  id: string;
  entity: string;
  officer_person: Person | null;
  officer_entity: { id: string; name: string } | null;
  positions: string[];
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShareIssuance {
  id: string;
  share_class: string;
  shareholder_person: Person | null;
  shareholder_entity: { id: string; name: string } | null;
  num_shares: number;
  issue_date: string | null;
  certificate_number: string;
  is_jtwros: boolean;
  jtwros_partner_name: string;
  is_trustee: boolean;
  trustee_for: string;
  created_at: string;
  updated_at: string;
}

export interface ShareClass {
  id: string;
  entity: string;
  name: string;
  currency: string;
  par_value: string | null;
  authorized_shares: number | null;
  voting_rights: boolean;
  issuances: ShareIssuance[];
  created_at: string;
  updated_at: string;
}

export interface ActivityCatalog {
  id: string;
  name: string;
  default_risk_level: RiskLevel;
}

export interface EntityActivity {
  id: string;
  entity: string;
  activity: ActivityCatalog;
  countries: JurisdictionRiskRef[];
  country_risk_level: RiskLevel;
  risk_level: RiskLevel;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface SourceOfFundsCatalog {
  id: string;
  name: string;
  default_risk_level: RiskLevel;
}

export interface SourceOfFunds {
  id: string;
  entity: string;
  source: SourceOfFundsCatalog;
  countries: JurisdictionRiskRef[];
  country_risk_level: RiskLevel;
  risk_level: RiskLevel;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface SourceOfWealth {
  id: string;
  person: string;
  description: string;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Ownership tree & UBO types
// ---------------------------------------------------------------------------

export interface OwnershipNode {
  type: "person" | "entity";
  id: string;
  name: string;
  pct: number;
  person?: Person;
  children: OwnershipNode[];
}

export interface UBOEntry {
  person: Person;
  effective_pct: number;
  via: string[];
}

export interface OwnershipTreeResponse {
  tree: OwnershipNode[];
  ubos: UBOEntry[];
}

export interface ClientContact {
  id: string;
  client: string;
  user: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  has_portal_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuestLink {
  id: string;
  token: string;
  created_by: string;
  expires_at: string;
  is_active: boolean;
  ticket: string | null;
  kyc_submission: string | null;
  client_name: string | null;
  entity_name: string | null;
}

export interface IntegrationStatus {
  configured: boolean;
  message: string;
}

export interface IntegrationStatusResponse {
  worldcheck: IntegrationStatus;
  sharepoint: IntegrationStatus;
  llm_extraction: IntegrationStatus;
  aderant_erp: IntegrationStatus;
  gotenberg: IntegrationStatus;
  microsoft_sso: IntegrationStatus;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  entity_type: string;
  jurisdiction: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedDocument {
  id: string;
  ticket: string;
  template: string;
  template_name: string;
  generated_file: string;
  format: "docx" | "pdf";
  generated_by: string;
  generated_by_email: string;
  sharepoint_file_id: string;
  created_at: string;
  updated_at: string;
}
