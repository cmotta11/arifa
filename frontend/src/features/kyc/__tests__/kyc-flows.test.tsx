import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { KYCSubmission, Party } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseKYCDetail = vi.fn();
const mockUseKYCParties = vi.fn();
const mockUseKYCDocuments = vi.fn();
const mockUseKYCRisk = vi.fn();
const mockUseUpdateKYC = vi.fn();
const mockUseSubmitKYC = vi.fn();
const mockUseUploadDocument = vi.fn();
const mockUseDeleteParty = vi.fn();
const mockUseScreenParty = vi.fn();
const mockUseAddParty = vi.fn();
const mockUseUpdateParty = vi.fn();

vi.mock("../api/kyc-api", () => ({
  useKYCDetail: (...args: unknown[]) => mockUseKYCDetail(...args),
  useKYCParties: (...args: unknown[]) => mockUseKYCParties(...args),
  useKYCDocuments: (...args: unknown[]) => mockUseKYCDocuments(...args),
  useKYCRisk: (...args: unknown[]) => mockUseKYCRisk(...args),
  useUpdateKYC: () => mockUseUpdateKYC(),
  useSubmitKYC: () => mockUseSubmitKYC(),
  useUploadDocument: () => mockUseUploadDocument(),
  useDeleteParty: () => mockUseDeleteParty(),
  useAddParty: () => mockUseAddParty(),
  useUpdateParty: () => mockUseUpdateParty(),
}));

vi.mock("@/features/compliance/api/compliance-api", () => ({
  useScreenParty: () => mockUseScreenParty(),
}));

// Mock the PersonSearchDialog to avoid complex rendering
vi.mock("../components/person-search-dialog", () => ({
  PersonSearchDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="person-search-dialog">Person Search</div> : null,
}));

// Mock the ReviewSummary
vi.mock("../components/review-summary", () => ({
  ReviewSummary: () => <div data-testid="review-summary">Review Summary</div>,
}));

// Mock FormField
vi.mock("@/components/forms/form-field", () => ({
  FormField: ({
    children,
    label,
    error,
  }: {
    children: ReactNode;
    label: string;
    error?: string;
  }) => (
    <div>
      <label>{label}</label>
      {children}
      {error && <span role="alert">{error}</span>}
    </div>
  ),
}));

// Mock the validation schema
vi.mock("../validation/kyc-schemas", () => ({
  partyBaseSchema: {
    parse: (data: unknown) => data,
  },
}));

vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => async (values: unknown) => ({
    values,
    errors: {},
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = createQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function makeMockKYC(overrides: Partial<KYCSubmission> = {}): KYCSubmission {
  return {
    id: "kyc-001",
    ticket: "ticket-001",
    status: "draft",
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    proposed_entity_data: {},
    field_comments: {},
    created_at: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

function makeMockParty(overrides: Partial<Party> = {}): Party {
  return {
    id: "party-001",
    kyc_submission: "kyc-001",
    person: null,
    party_type: "natural",
    role: "ubo",
    name: "John Doe",
    nationality: "PA",
    country_of_residence: "PA",
    pep_status: false,
    ownership_percentage: 50,
    date_of_birth: "1990-01-01",
    identification_number: "ABC-123",
    screening_status: null,
    ...overrides,
  };
}

function mockMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
    reset: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// KYCFormShell Tests
// ---------------------------------------------------------------------------

describe("KYCFormShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const kyc = makeMockKYC();
    mockUseKYCDetail.mockReturnValue({
      data: kyc,
      isLoading: false,
      isError: false,
    });
    mockUseKYCParties.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUseKYCDocuments.mockReturnValue({
      data: [],
      isLoading: false,
    });
    mockUseKYCRisk.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockUseUpdateKYC.mockReturnValue(mockMutation());
    mockUseSubmitKYC.mockReturnValue(mockMutation());
    mockUseUploadDocument.mockReturnValue(mockMutation());
    mockUseDeleteParty.mockReturnValue(mockMutation());
    mockUseScreenParty.mockReturnValue(mockMutation());
    mockUseAddParty.mockReturnValue(mockMutation());
    mockUseUpdateParty.mockReturnValue(mockMutation());
  });

  async function renderFormShell() {
    const { KYCFormShell } = await import("../components/kyc-form-shell");
    return render(
      <Wrapper>
        <KYCFormShell kycId="kyc-001" />
      </Wrapper>,
    );
  }

  it("renders step indicator with all five steps", async () => {
    await renderFormShell();

    // Step labels appear in both the step indicator and the step content,
    // so we use getAllByText for the first step which is active.
    expect(screen.getAllByText("steps.entityInfo").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("steps.parties")).toBeInTheDocument();
    expect(screen.getByText("steps.uboDeclaration")).toBeInTheDocument();
    expect(screen.getByText("steps.documents")).toBeInTheDocument();
    expect(screen.getByText("steps.review")).toBeInTheDocument();
  });

  it("displays entity info step by default (first step)", async () => {
    await renderFormShell();

    // Entity info step renders KYC details (h2 heading + field labels)
    expect(screen.getAllByText("steps.entityInfo").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("fields.kycId")).toBeInTheDocument();
    expect(screen.getByText("kyc-001")).toBeInTheDocument();
  });

  it("shows loading spinner when KYC data is loading", async () => {
    mockUseKYCDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    await renderFormShell();

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows error message when KYC fails to load", async () => {
    mockUseKYCDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    await renderFormShell();

    expect(screen.getByText("errors.loadFailed")).toBeInTheDocument();
  });

  it("navigates to next step when Next button is clicked", async () => {
    const user = userEvent.setup();

    // Return resolved on mutate with onSettled callback
    mockUseUpdateKYC.mockReturnValue({
      ...mockMutation(),
      mutate: vi.fn((_args: unknown, opts?: { onSettled?: () => void }) => {
        opts?.onSettled?.();
      }),
    });

    await renderFormShell();

    const nextButton = screen.getByRole("button", { name: "navigation.next" });
    await user.click(nextButton);

    // After navigating to step 2 (parties), the step indicator and step content
    // both show "steps.parties", so we check for at least 2 occurrences
    expect(screen.getAllByText("steps.parties").length).toBeGreaterThanOrEqual(2);
  });

  it("disables Previous button on first step", async () => {
    await renderFormShell();

    const prevButton = screen.getByRole("button", { name: "navigation.previous" });
    expect(prevButton).toBeDisabled();
  });

  it("does not show Next button on last step (review)", async () => {
    const user = userEvent.setup();

    mockUseUpdateKYC.mockReturnValue({
      ...mockMutation(),
      mutate: vi.fn((_args: unknown, opts?: { onSettled?: () => void }) => {
        opts?.onSettled?.();
      }),
    });

    await renderFormShell();

    // Click through all steps to reach the review step
    const nextButton = screen.getByRole("button", { name: "navigation.next" });
    for (let i = 0; i < 4; i++) {
      await user.click(nextButton);
    }

    // On the review step, Next button should not be present
    expect(screen.queryByRole("button", { name: "navigation.next" })).not.toBeInTheDocument();
  });

  it("renders document upload area in documents step", async () => {
    const user = userEvent.setup();

    mockUseUpdateKYC.mockReturnValue({
      ...mockMutation(),
      mutate: vi.fn((_args: unknown, opts?: { onSettled?: () => void }) => {
        opts?.onSettled?.();
      }),
    });

    await renderFormShell();

    // Navigate to documents step (step 4 = index 3)
    const nextButton = screen.getByRole("button", { name: "navigation.next" });
    for (let i = 0; i < 3; i++) {
      await user.click(nextButton);
    }

    // Steps.documents appears in both indicator and step content
    expect(screen.getAllByText("steps.documents").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("documents.uploadLabel")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PartyList Tests
// ---------------------------------------------------------------------------

describe("PartyList", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDeleteParty.mockReturnValue(mockMutation());
    mockUseScreenParty.mockReturnValue(mockMutation());
    // PartyForm is rendered inside the modal, so these also need mocking
    mockUseAddParty.mockReturnValue(mockMutation());
    mockUseUpdateParty.mockReturnValue(mockMutation());
  });

  async function renderPartyList(props: {
    parties?: Party[];
    isLoading?: boolean;
    readonly?: boolean;
  }) {
    const { PartyList } = await import("../components/party-list");
    return render(
      <Wrapper>
        <PartyList
          kycId="kyc-001"
          parties={props.parties ?? []}
          isLoading={props.isLoading ?? false}
          readonly={props.readonly ?? false}
        />
      </Wrapper>,
    );
  }

  it("renders party cards with name and role badges", async () => {
    const parties = [
      makeMockParty({ id: "p1", name: "Alice Smith", role: "ubo" }),
      makeMockParty({ id: "p2", name: "Bob Jones", role: "director" }),
    ];

    await renderPartyList({ parties });

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    expect(screen.getByText("roles.ubo")).toBeInTheDocument();
    expect(screen.getByText("roles.director")).toBeInTheDocument();
  });

  it("shows empty state when no parties exist", async () => {
    await renderPartyList({ parties: [] });

    expect(screen.getByText("party.empty")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", async () => {
    await renderPartyList({ isLoading: true });

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows Add Party button when not readonly", async () => {
    await renderPartyList({ parties: [], readonly: false });

    expect(screen.getByRole("button", { name: "party.addFirst" })).toBeInTheDocument();
  });

  it("hides Add Party button when readonly", async () => {
    const parties = [makeMockParty()];
    await renderPartyList({ parties, readonly: true });

    expect(screen.queryByText("party.add")).not.toBeInTheDocument();
  });

  it("opens delete confirmation modal when delete button is clicked", async () => {
    const user = userEvent.setup();
    const parties = [makeMockParty({ id: "p1", name: "Alice Smith" })];

    await renderPartyList({ parties });

    const deleteButton = screen.getByRole("button", { name: "actions.delete" });
    await user.click(deleteButton);

    expect(screen.getByText("party.deleteConfirm")).toBeInTheDocument();
  });

  it("opens add party modal when add button is clicked", async () => {
    const user = userEvent.setup();
    const parties = [makeMockParty()];

    await renderPartyList({ parties });

    const addButton = screen.getByText("party.add");
    await user.click(addButton);

    expect(screen.getByText("party.addTitle")).toBeInTheDocument();
  });

  it("displays ownership percentage total for UBOs", async () => {
    const parties = [
      makeMockParty({
        id: "p1",
        name: "Shareholder A",
        role: "shareholder",
        ownership_percentage: 60,
      }),
      makeMockParty({
        id: "p2",
        name: "Shareholder B",
        role: "ubo",
        ownership_percentage: 40,
      }),
    ];

    await renderPartyList({ parties });

    expect(screen.getByText("100% / 100%")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// PartyForm Tests
// ---------------------------------------------------------------------------

describe("PartyForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAddParty.mockReturnValue(mockMutation());
    mockUseUpdateParty.mockReturnValue(mockMutation());
  });

  async function renderPartyForm(props: {
    party?: Party | null;
    onSuccess?: () => void;
    onCancel?: () => void;
  }) {
    const { PartyForm } = await import("../components/party-form");
    return render(
      <Wrapper>
        <PartyForm
          kycId="kyc-001"
          party={props.party ?? null}
          onSuccess={props.onSuccess}
          onCancel={props.onCancel}
        />
      </Wrapper>,
    );
  }

  it("renders form fields for new party", async () => {
    await renderPartyForm({});

    expect(screen.getByText("fields.partyType")).toBeInTheDocument();
    expect(screen.getByText("fields.role")).toBeInTheDocument();
    expect(screen.getByText("fields.name")).toBeInTheDocument();
    expect(screen.getByText("fields.nationality")).toBeInTheDocument();
    expect(screen.getByText("fields.countryOfResidence")).toBeInTheDocument();
  });

  it("shows 'Add Party' button label for new party", async () => {
    await renderPartyForm({});

    expect(screen.getByRole("button", { name: "actions.addParty" })).toBeInTheDocument();
  });

  it("shows 'Update Party' button label when editing", async () => {
    const party = makeMockParty();
    await renderPartyForm({ party });

    expect(screen.getByRole("button", { name: "actions.updateParty" })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    await renderPartyForm({ onCancel });

    const cancelButton = screen.getByRole("button", { name: "actions.cancel" });
    await user.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders PEP status toggle", async () => {
    await renderPartyForm({});

    expect(screen.getByText("fields.pepStatus")).toBeInTheDocument();
  });

  it("shows link-existing-person button when creating (not editing)", async () => {
    await renderPartyForm({});

    expect(screen.getByText("party.linkExisting")).toBeInTheDocument();
  });

  it("hides link-existing-person button when editing a party", async () => {
    const party = makeMockParty();
    await renderPartyForm({ party });

    expect(screen.queryByText("party.linkExisting")).not.toBeInTheDocument();
  });

  it("renders date of birth and identification for natural person type", async () => {
    await renderPartyForm({});

    // Default party_type is "natural" so these fields should show
    expect(screen.getByText("fields.dateOfBirth")).toBeInTheDocument();
    expect(screen.getByText("fields.identificationNumber")).toBeInTheDocument();
  });
});
