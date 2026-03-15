import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import type { EconomicSubstanceSubmission } from "@/types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
    onClick,
  }: {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <div data-testid="card" className={className} onClick={onClick}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/navigation/stepper", () => ({
  Stepper: ({
    steps,
    currentStep,
  }: {
    steps: { label: string }[];
    currentStep: number;
  }) => (
    <div data-testid="stepper">
      {steps.map((s, i) => (
        <span
          key={s.label}
          data-testid={`stepper-step-${i + 1}`}
          data-active={i + 1 === currentStep}
        >
          {s.label}
        </span>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ui/searchable-select", () => ({
  SearchableSelect: ({
    options,
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
  }) => (
    <select
      data-testid="searchable-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
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

function makeMockSubmission(
  overrides: Partial<EconomicSubstanceSubmission> = {},
): EconomicSubstanceSubmission {
  return {
    id: "es-001",
    entity: "entity-001",
    entity_name: "ACME Corp",
    fiscal_year: 2025,
    status: "in_progress",
    flow_answers: {},
    current_step: "relevant_activities",
    shareholders_data: [],
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    field_comments: {},
    attention_reason: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ESQuestionRenderer Tests
// ---------------------------------------------------------------------------

describe("ESQuestionRenderer", () => {
  async function renderRenderer(
    stepOverrides: Record<string, unknown> = {},
    props: Record<string, unknown> = {},
  ) {
    const { ESQuestionRenderer } = await import(
      "../components/es-question-renderer"
    );

    const step = {
      key: "test_step",
      label: "Test Question",
      description: "Test description",
      type: "yes_no" as const,
      ...stepOverrides,
    };

    return render(
      <Wrapper>
        <ESQuestionRenderer
          step={step as any}
          value={props.value ?? undefined}
          onChange={(props.onChange as any) ?? vi.fn()}
          attentionReason={(props.attentionReason as string) ?? ""}
          entityName={(props.entityName as string) ?? ""}
          disabled={(props.disabled as boolean) ?? false}
        />
      </Wrapper>,
    );
  }

  it("renders yes/no buttons for yes_no type", async () => {
    await renderRenderer({ type: "yes_no" });

    expect(screen.getByText("Test Question")).toBeInTheDocument();
    expect(screen.getByText("es.flow.yes")).toBeInTheDocument();
    expect(screen.getByText("es.flow.no")).toBeInTheDocument();
  });

  it("calls onChange with true when Yes is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    await renderRenderer({ type: "yes_no" }, { onChange });

    await user.click(screen.getByText("es.flow.yes"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when No is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    await renderRenderer({ type: "yes_no" }, { onChange });

    await user.click(screen.getByText("es.flow.no"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders multi-select checkboxes for multi_select type", async () => {
    await renderRenderer({
      type: "multi_select",
      options: [
        { value: "banking", label: "Banking business" },
        { value: "insurance", label: "Insurance business" },
      ],
    });

    expect(screen.getByText("Banking business")).toBeInTheDocument();
    expect(screen.getByText("Insurance business")).toBeInTheDocument();
  });

  it("toggles multi-select options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    await renderRenderer(
      {
        type: "multi_select",
        options: [
          { value: "banking", label: "Banking business" },
          { value: "insurance", label: "Insurance business" },
        ],
      },
      { onChange, value: [] },
    );

    const bankingCheckbox = screen.getByLabelText("Banking business");
    await user.click(bankingCheckbox);

    expect(onChange).toHaveBeenCalledWith(["banking"]);
  });

  it("renders country select for country_select type", async () => {
    await renderRenderer({
      type: "country_select",
      description: "Select a country",
    });

    expect(screen.getByText("Test Question")).toBeInTheDocument();
    expect(screen.getByTestId("searchable-select")).toBeInTheDocument();
  });

  it("renders terminal completed screen for terminal type", async () => {
    await renderRenderer({
      type: "terminal",
      terminalType: "completed",
      label: "All Done",
      description: "You have completed the flow.",
    });

    expect(screen.getByText("All Done")).toBeInTheDocument();
    expect(screen.getByText("es.flow.readyToSubmit")).toBeInTheDocument();
  });

  it("renders attention screen for terminal attention type", async () => {
    await renderRenderer(
      {
        type: "terminal",
        terminalType: "attention",
      },
      {
        attentionReason: "Entity does not meet requirements",
        entityName: "ACME Corp",
      },
    );

    expect(screen.getByText("es.attention.title")).toBeInTheDocument();
  });

  it("shows field comment when provided", async () => {
    const { ESQuestionRenderer } = await import(
      "../components/es-question-renderer"
    );

    render(
      <Wrapper>
        <ESQuestionRenderer
          step={{
            key: "test",
            label: "Test",
            type: "yes_no",
          }}
          value={undefined}
          onChange={vi.fn()}
          fieldComment="Please review this answer"
        />
      </Wrapper>,
    );

    expect(screen.getByText("Please review this answer")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ESFlowForm Tests (branching navigation & save-as-draft)
// ---------------------------------------------------------------------------

describe("ESFlowForm", () => {
  async function renderFlowForm(
    submissionOverrides: Partial<EconomicSubstanceSubmission> = {},
    props: Record<string, unknown> = {},
  ) {
    const { ESFlowForm } = await import("../components/es-flow-form");
    const submission = makeMockSubmission(submissionOverrides);

    return render(
      <Wrapper>
        <ESFlowForm
          submission={submission}
          onAdvanceStep={
            (props.onAdvanceStep as any) ?? vi.fn().mockResolvedValue(undefined)
          }
          onUpdateSubmission={
            (props.onUpdateSubmission as any) ??
            vi.fn().mockResolvedValue(undefined)
          }
          onSubmit={
            (props.onSubmit as any) ?? vi.fn().mockResolvedValue(undefined)
          }
          isSaving={(props.isSaving as boolean) ?? false}
          isSubmitting={(props.isSubmitting as boolean) ?? false}
          disabled={(props.disabled as boolean) ?? false}
        />
      </Wrapper>,
    );
  }

  it("renders stepper with all flow steps", async () => {
    await renderFlowForm();

    const stepper = screen.getByTestId("stepper");
    expect(stepper).toBeInTheDocument();

    // Should have 9 steps (8 questions + review)
    const steps = screen.getAllByTestId(/^stepper-step-/);
    expect(steps.length).toBe(9);
  });

  it("starts on first step (relevant_activities)", async () => {
    await renderFlowForm();

    const firstStep = screen.getByTestId("stepper-step-1");
    expect(firstStep.dataset.active).toBe("true");
  });

  it("advances to next step when Next is clicked", async () => {
    const user = userEvent.setup();
    const onAdvanceStep = vi.fn().mockResolvedValue(undefined);

    await renderFlowForm(
      {
        flow_answers: { relevant_activities: ["banking"] },
      },
      { onAdvanceStep },
    );

    const nextButton = screen.getByText("es.flow.next");
    await user.click(nextButton);

    expect(onAdvanceStep).toHaveBeenCalledWith(
      "relevant_activities",
      ["banking"],
    );
  });

  it("disables Back button on the first step", async () => {
    await renderFlowForm();

    const backButton = screen.getByText("es.flow.back");
    expect(backButton).toBeDisabled();
  });

  it("shows saving indicator when isSaving is true", async () => {
    await renderFlowForm({}, { isSaving: true });

    expect(screen.getByText("es.flow.saving")).toBeInTheDocument();
  });

  it("disables Next when no answer is provided for yes_no step", async () => {
    const user = userEvent.setup();
    const onAdvanceStep = vi.fn().mockResolvedValue(undefined);

    // Start on step 2 (directed_managed, yes_no type)
    await renderFlowForm(
      {
        current_step: "directed_managed",
        flow_answers: { relevant_activities: ["banking"] },
      },
      { onAdvanceStep },
    );

    // The Next button should be present but the canAdvance logic
    // should prevent advance since no answer is set for directed_managed
    const nextButton = screen.getByText("es.flow.next");
    expect(nextButton).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// ESReviewSubmit Tests
// ---------------------------------------------------------------------------

describe("ESReviewSubmit", () => {
  async function renderReview(
    submissionOverrides: Partial<EconomicSubstanceSubmission> = {},
    props: Record<string, unknown> = {},
  ) {
    const { ESReviewSubmit } = await import("../components/es-review-submit");
    const submission = makeMockSubmission({
      flow_answers: {
        relevant_activities: ["banking", "insurance"],
        directed_managed: true,
        ciga_in_jurisdiction: false,
        tax_residence: "PA",
      },
      shareholders_data: [
        { name: "Alice", type: "natural", percentage: 60 },
        { name: "Bob Corp", type: "corporate", percentage: 40 },
      ],
      ...submissionOverrides,
    });

    return render(
      <Wrapper>
        <ESReviewSubmit
          submission={submission}
          onSubmit={(props.onSubmit as any) ?? vi.fn()}
          isSubmitting={(props.isSubmitting as boolean) ?? false}
          disabled={(props.disabled as boolean) ?? false}
        />
      </Wrapper>,
    );
  }

  it("renders the review title and description", async () => {
    await renderReview();

    expect(screen.getByText("es.review.title")).toBeInTheDocument();
    expect(screen.getByText("es.review.description")).toBeInTheDocument();
  });

  it("renders collapsible accordion sections for answered steps", async () => {
    await renderReview();

    // Should see section headers for non-terminal steps
    expect(
      screen.getByText(
        "economicSubstance.flow.steps.relevantActivities.label",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("economicSubstance.flow.steps.directedManaged.label"),
    ).toBeInTheDocument();
  });

  it("toggles accordion sections on click", async () => {
    const user = userEvent.setup();
    await renderReview();

    // Find the first accordion button and click to collapse
    const sectionButton = screen.getByText(
      "economicSubstance.flow.steps.relevantActivities.label",
    );
    await user.click(sectionButton);

    // Click again to re-expand
    await user.click(sectionButton);

    // Section should still be findable
    expect(sectionButton).toBeInTheDocument();
  });

  it("submit button is disabled until declaration checkbox is checked", async () => {
    await renderReview();

    const submitButton = screen.getByText("es.review.submit");
    expect(submitButton).toBeDisabled();
  });

  it("enables submit button after checking declaration", async () => {
    const user = userEvent.setup();
    await renderReview();

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    const submitButton = screen.getByText("es.review.submit");
    expect(submitButton).not.toBeDisabled();
  });

  it("calls onSubmit when submit button is clicked after checking declaration", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    await renderReview({}, { onSubmit });

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    const submitButton = screen.getByText("es.review.submit");
    await user.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders shareholders table in review", async () => {
    await renderReview();

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob Corp")).toBeInTheDocument();
    expect(screen.getByText("60.00%")).toBeInTheDocument();
    expect(screen.getByText("40.00%")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ESAttentionScreen Tests
// ---------------------------------------------------------------------------

describe("ESAttentionScreen", () => {
  async function renderAttention(props: {
    attentionReason?: string;
    entityName?: string;
  }) {
    const { ESAttentionScreen } = await import(
      "../components/es-attention-screen"
    );
    return render(
      <Wrapper>
        <ESAttentionScreen
          attentionReason={props.attentionReason ?? ""}
          entityName={props.entityName ?? "Test Entity"}
        />
      </Wrapper>,
    );
  }

  it("renders the attention title", async () => {
    await renderAttention({});

    expect(screen.getByText("es.attention.title")).toBeInTheDocument();
  });

  it("displays the attention reason when provided", async () => {
    await renderAttention({
      attentionReason: "Entity does not meet substance requirements",
    });

    expect(
      screen.getByText("Entity does not meet substance requirements"),
    ).toBeInTheDocument();
    expect(screen.getByText("es.attention.reasonLabel")).toBeInTheDocument();
  });

  it("does not display reason box when reason is empty", async () => {
    await renderAttention({ attentionReason: "" });

    expect(
      screen.queryByText("es.attention.reasonLabel"),
    ).not.toBeInTheDocument();
  });

  it("renders contact information section", async () => {
    await renderAttention({});

    expect(screen.getByText("es.attention.contactTitle")).toBeInTheDocument();
    expect(
      screen.getByText("es.attention.contactDescription"),
    ).toBeInTheDocument();
  });
});
