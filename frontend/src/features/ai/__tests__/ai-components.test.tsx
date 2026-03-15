import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockChatMutate = vi.fn();
const mockSuggestMutate = vi.fn();
const mockExplainMutate = vi.fn();

// Mutable mock state so individual tests can override return values
let explainRiskReturnValue: Record<string, unknown> = {
  mutate: mockExplainMutate,
  isPending: false,
  data: undefined,
  isError: false,
};

vi.mock("@/features/ai/api/ai-api", () => ({
  useAIChat: () => ({
    mutate: mockChatMutate,
    isPending: false,
    data: undefined,
    isError: false,
  }),
  useAISuggestions: () => ({
    mutate: mockSuggestMutate,
    isPending: false,
    data: {
      suggestions: [
        { field: "registered_agent", value: "ARIFA Law", confidence: 95 },
        { field: "fiscal_year_end", value: "December 31", confidence: 70 },
        { field: "status", value: "active", confidence: 45 },
      ],
    },
    isError: false,
  }),
  useAIExplainRisk: () => explainRiskReturnValue,
}));

// Mock heroicons
vi.mock("@heroicons/react/24/outline", () => ({
  ChatBubbleLeftRightIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chat-icon" {...props} />
  ),
  PaperAirplaneIcon: (props: Record<string, unknown>) => (
    <svg data-testid="send-icon" {...props} />
  ),
  XMarkIcon: (props: Record<string, unknown>) => (
    <svg data-testid="close-icon" {...props} />
  ),
  SparklesIcon: (props: Record<string, unknown>) => (
    <svg data-testid="sparkles-icon" {...props} />
  ),
}));

vi.mock("@heroicons/react/24/solid", () => ({
  SparklesIcon: (props: Record<string, unknown>) => (
    <svg data-testid="sparkles-icon-solid" {...props} />
  ),
}));

vi.mock("@heroicons/react/20/solid", () => ({
  ChevronDownIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-down" {...props} />
  ),
  ChevronUpIcon: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-up" {...props} />
  ),
}));

// Mock Spinner so we don't depend on its internal structure
vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <div data-testid="spinner" role="status" aria-label="Loading" />,
}));

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// AIChatWidget Tests
// ---------------------------------------------------------------------------

describe("AIChatWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderWidget() {
    const { AIChatWidget } = await import("../components/ai-chat-widget");
    return render(
      <Wrapper>
        <AIChatWidget />
      </Wrapper>,
    );
  }

  it("renders the floating toggle button", async () => {
    await renderWidget();

    const toggleButton = screen.getByRole("button", { name: "ai.expand" });
    expect(toggleButton).toBeInTheDocument();
  });

  it("opens chat panel when toggle button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    const toggleButton = screen.getByRole("button", { name: "ai.expand" });
    await user.click(toggleButton);

    expect(screen.getByText("ai.chatTitle")).toBeInTheDocument();
    // "ai.placeholder" appears both as <p> text and as input placeholder attribute
    // getByText only matches text content, not placeholder attributes, so this is fine
    expect(screen.getByText("ai.placeholder")).toBeInTheDocument();
  });

  it("closes chat panel when toggle button is clicked again", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    // Open
    await user.click(screen.getByRole("button", { name: "ai.expand" }));
    expect(screen.getByText("ai.chatTitle")).toBeInTheDocument();

    // Close
    await user.click(screen.getByRole("button", { name: "ai.collapse" }));
    expect(screen.queryByText("ai.chatTitle")).not.toBeInTheDocument();
  });

  it("sends a message when form is submitted", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    // Open the widget
    await user.click(screen.getByRole("button", { name: "ai.expand" }));

    // Type and send message
    const input = screen.getByPlaceholderText("ai.placeholder");
    await user.type(input, "What is KYC?");
    await user.click(screen.getByRole("button", { name: "ai.send" }));

    expect(mockChatMutate).toHaveBeenCalledTimes(1);
    expect(mockChatMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "What is KYC?",
        context: expect.objectContaining({
          page: expect.any(String),
          language: "en",
        }),
      }),
      expect.any(Object),
    );
  });

  it("displays user message in chat after sending", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    await user.click(screen.getByRole("button", { name: "ai.expand" }));

    const input = screen.getByPlaceholderText("ai.placeholder");
    await user.type(input, "Hello AI");
    await user.click(screen.getByRole("button", { name: "ai.send" }));

    expect(screen.getByText("Hello AI")).toBeInTheDocument();
  });

  it("clears input after sending a message", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    await user.click(screen.getByRole("button", { name: "ai.expand" }));

    const input = screen.getByPlaceholderText("ai.placeholder") as HTMLInputElement;
    await user.type(input, "Test message");
    await user.click(screen.getByRole("button", { name: "ai.send" }));

    expect(input.value).toBe("");
  });

  it("disables send button when input is empty", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    await user.click(screen.getByRole("button", { name: "ai.expand" }));

    const sendButton = screen.getByRole("button", { name: "ai.send" });
    expect(sendButton).toBeDisabled();
  });

  it("enforces 2-second cooldown between sends", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    await user.click(screen.getByRole("button", { name: "ai.expand" }));

    const input = screen.getByPlaceholderText("ai.placeholder");

    // First send
    await user.type(input, "First");
    await user.click(screen.getByRole("button", { name: "ai.send" }));
    expect(mockChatMutate).toHaveBeenCalledTimes(1);

    // Immediate second send (within cooldown)
    await user.type(input, "Second");
    await user.click(screen.getByRole("button", { name: "ai.send" }));
    // Should still be 1 because cooldown hasn't elapsed
    expect(mockChatMutate).toHaveBeenCalledTimes(1);

    // Advance past cooldown
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    // Now a third send should work
    await user.type(input, "Third");
    await user.click(screen.getByRole("button", { name: "ai.send" }));
    expect(mockChatMutate).toHaveBeenCalledTimes(2);
  });

  it("does not send empty messages", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderWidget();

    await user.click(screen.getByRole("button", { name: "ai.expand" }));

    const input = screen.getByPlaceholderText("ai.placeholder");
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "ai.send" }));

    expect(mockChatMutate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AIFieldSuggestions Tests
// ---------------------------------------------------------------------------

describe("AIFieldSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderSuggestions(props: Record<string, unknown> = {}) {
    const { AIFieldSuggestions } = await import(
      "../components/ai-field-suggestions"
    );
    return render(
      <Wrapper>
        <AIFieldSuggestions
          entityType={(props.entityType as string) ?? "corporation"}
          jurisdiction={(props.jurisdiction as string) ?? "bvi"}
          formSection={(props.formSection as string) ?? "entity_info"}
          onApply={(props.onApply as (field: string, value: string) => void) ?? vi.fn()}
        />
      </Wrapper>,
    );
  }

  it("renders suggestion items with field names and values", async () => {
    await renderSuggestions();

    expect(screen.getByText(/registered_agent/)).toBeInTheDocument();
    expect(screen.getByText(/ARIFA Law/)).toBeInTheDocument();
    expect(screen.getByText(/fiscal_year_end/)).toBeInTheDocument();
    expect(screen.getByText(/December 31/)).toBeInTheDocument();
  });

  it("renders confidence badges with percentage", async () => {
    await renderSuggestions();

    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("renders title heading", async () => {
    await renderSuggestions();

    expect(screen.getByText("ai.suggestions.title")).toBeInTheDocument();
  });

  it("renders Apply button for each suggestion", async () => {
    await renderSuggestions();

    const applyButtons = screen.getAllByText("ai.suggestions.apply");
    expect(applyButtons).toHaveLength(3);
  });

  it("calls onApply with field and value when Apply is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    await renderSuggestions({ onApply });

    const applyButtons = screen.getAllByText("ai.suggestions.apply");
    await user.click(applyButtons[0]);

    expect(onApply).toHaveBeenCalledWith("registered_agent", "ARIFA Law");
  });

  it("applies different confidence badge colors based on confidence level", async () => {
    await renderSuggestions();

    // 95% = green (>= 80)
    const highConfidence = screen.getByText("95%");
    expect(highConfidence.className).toContain("green");

    // 70% = yellow (50-79)
    const medConfidence = screen.getByText("70%");
    expect(medConfidence.className).toContain("yellow");

    // 45% = gray (<50)
    const lowConfidence = screen.getByText("45%");
    expect(lowConfidence.className).toContain("gray");
  });

  it("triggers mutation on mount with correct params", async () => {
    await renderSuggestions({
      entityType: "llc",
      jurisdiction: "panama",
      formSection: "parties",
    });

    expect(mockSuggestMutate).toHaveBeenCalledWith({
      entity_type: "llc",
      jurisdiction: "panama",
      form_section: "parties",
    });
  });
});

// ---------------------------------------------------------------------------
// AIRiskExplanation Tests
// ---------------------------------------------------------------------------

describe("AIRiskExplanation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset to default (no data) state
    explainRiskReturnValue = {
      mutate: mockExplainMutate,
      isPending: false,
      data: undefined,
      isError: false,
    };
  });

  async function renderRiskExplanation(props: Record<string, unknown> = {}) {
    const { AIRiskExplanation } = await import(
      "../components/ai-risk-explanation"
    );
    return render(
      <Wrapper>
        <AIRiskExplanation
          entityId={(props.entityId as string) ?? "entity-001"}
          riskAssessmentId={
            (props.riskAssessmentId as string) ?? "risk-001"
          }
        />
      </Wrapper>,
    );
  }

  it("renders the explain button initially (after expanding the shell)", async () => {
    const user = userEvent.setup();
    await renderRiskExplanation();

    // The AIAssistantShell starts collapsed (defaultOpen=false), so we need
    // to click the toggle to expand it and reveal the children
    const toggle = screen.getByRole("button", {
      name: "ai.expand ai.risk.title",
    });
    await user.click(toggle);

    expect(screen.getByText("ai.risk.explain")).toBeInTheDocument();
  });

  it("calls explainRisk mutation when explain button is clicked", async () => {
    const user = userEvent.setup();
    await renderRiskExplanation();

    // Expand the shell first
    const toggle = screen.getByRole("button", {
      name: "ai.expand ai.risk.title",
    });
    await user.click(toggle);

    await user.click(screen.getByText("ai.risk.explain"));

    expect(mockExplainMutate).toHaveBeenCalledWith({
      entityId: "entity-001",
      riskAssessmentId: "risk-001",
    });
  });

  it("renders AI assistant shell with correct title", async () => {
    await renderRiskExplanation();

    // The title is always visible as the toggle label, even when collapsed
    expect(screen.getByText("ai.risk.title")).toBeInTheDocument();
  });

  it("renders the collapsible shell (defaultOpen=false) with chevron-down", async () => {
    await renderRiskExplanation();

    // The title should be visible as the toggle label
    expect(screen.getByText("ai.risk.title")).toBeInTheDocument();
    // The chevron-down icon indicates the shell is collapsed
    expect(screen.getByTestId("chevron-down")).toBeInTheDocument();
  });

  it("shows explanation text when data is available", async () => {
    const user = userEvent.setup();

    // Set the mock to return data
    explainRiskReturnValue = {
      mutate: mockExplainMutate,
      isPending: false,
      data: {
        explanation: "This entity is medium risk because...",
        factors: [
          { name: "Jurisdiction Risk", impact: "medium", score: 15 },
          { name: "PEP Exposure", impact: "high", score: 20 },
        ],
      },
      isError: false,
    };

    await renderRiskExplanation();

    // Expand the shell to see the content
    const toggle = screen.getByRole("button", {
      name: "ai.expand ai.risk.title",
    });
    await user.click(toggle);

    expect(
      screen.getByText("This entity is medium risk because..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Jurisdiction Risk")).toBeInTheDocument();
    expect(screen.getByText("PEP Exposure")).toBeInTheDocument();
  });
});
